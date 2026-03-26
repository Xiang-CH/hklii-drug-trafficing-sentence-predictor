from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

from pymongo.collection import Collection
from tqdm import tqdm

from .case_text import build_case_text
from .client import create_db, create_langfuse, create_openai_client
from .config import (
    EXTRACT_CONCURRENCY,
    EXTRACT_LIMIT,
    MODEL,
    MUST_INCLUDE_TRIALS,
    RERUN_ALL,
)
from .pipeline import extract_all_features


@dataclass(frozen=True)
class ProcessResult:
    status: str
    source_id: Any = None
    message: str | None = None


def should_skip_extraction(
    source_id: Any, extracted_features_collection: Collection
) -> bool:
    if RERUN_ALL:
        return False
    return (
        extracted_features_collection.count_documents(
            {"source_judgement_id": source_id}
        )
        > 0
    )


def build_must_include_filter(must_include_trials: list[str]) -> dict | None:
    if not must_include_trials:
        return None
    return {"trial": {"$in": must_include_trials}}


def build_docs_to_process(
    judgements_collection: Collection, extracted_features_collection: Collection
) -> tuple[list[dict], int]:
    base_filter = {
        "_id": {"$nin": extracted_features_collection.distinct("source_judgement_id")}
    }
    must_include_filter = build_must_include_filter(MUST_INCLUDE_TRIALS)

    must_include_docs: list[dict] = []
    if must_include_filter:
        must_include_docs = list(
            judgements_collection.find({"$and": [base_filter, must_include_filter]})
        )

    must_include_ids = {doc["_id"] for doc in must_include_docs if doc.get("_id")}
    normal_filter: dict[str, Any] = base_filter.copy()
    if must_include_ids:
        normal_filter = {
            "$and": [base_filter, {"_id": {"$nin": list(must_include_ids)}}]
        }

    normal_total = judgements_collection.count_documents(normal_filter)
    cursor = judgements_collection.find(normal_filter)
    if EXTRACT_LIMIT > 0:
        cursor = cursor.limit(EXTRACT_LIMIT)

    docs_to_process = must_include_docs + list(cursor)
    return docs_to_process, normal_total + len(must_include_docs)


def process_judgement_doc(
    judgement_doc: dict,
    extracted_features_collection: Collection,
) -> ProcessResult:
    source_id = judgement_doc.get("_id")
    if source_id is None:
        return ProcessResult(status="skipped", message="Skipping document without _id.")

    if should_skip_extraction(source_id, extracted_features_collection):
        return ProcessResult(status="skipped", source_id=source_id)

    case_txt, judgement_type = build_case_text(judgement_doc)
    if not case_txt:
        return ProcessResult(
            status="skipped",
            source_id=source_id,
            message=f"Skipping {source_id}: empty html content",
        )

    client = create_openai_client()
    langfuse = create_langfuse()

    try:
        judgement_data, defendants_data, trials_data, trace_id = extract_all_features(
            case_txt=case_txt,
            judgement_type=judgement_type,
            client=client,
            langfuse=langfuse,
        )
        extracted_doc = {
            "source_judgement_id": source_id,
            "trial": judgement_doc.get("trial"),
            "appeal": judgement_doc.get("appeal"),
            "corrigendum": judgement_doc.get("corrigendum"),
            "judgement": judgement_data.model_dump(mode="json"),
            "defendants": defendants_data.model_dump(mode="json"),
            "trials": trials_data.model_dump(mode="json"),
            "model": MODEL,
            "judgement_type": judgement_type,
            "trace_id": trace_id,
        }
        extracted_features_collection.insert_one(extracted_doc)
        langfuse.flush()
        return ProcessResult(status="processed", source_id=source_id)
    except Exception as exc:
        langfuse.flush()
        return ProcessResult(status="failed", source_id=source_id, message=str(exc))


def main() -> None:
    db = create_db()
    judgements_collection = db.get_judgements_collection()
    extracted_features_collection = db.get_extracted_features_collection()

    docs_to_process, judgement_count = build_docs_to_process(
        judgements_collection, extracted_features_collection
    )

    print(
        f"Found {judgement_count} unprocessed judgement records in judgement-html collection."
    )
    if MUST_INCLUDE_TRIALS:
        print(
            f"Must-include configured: matched {sum(1 for doc in docs_to_process if doc.get('trial') in MUST_INCLUDE_TRIALS)} records from {len(MUST_INCLUDE_TRIALS)} trial values."
        )
    print(f"Using concurrency={EXTRACT_CONCURRENCY}.")

    processed = 0
    skipped = 0
    failed = 0
    first_insert_logged = False

    with ThreadPoolExecutor(max_workers=EXTRACT_CONCURRENCY) as executor:
        futures = [
            executor.submit(
                process_judgement_doc, judgement_doc, extracted_features_collection
            )
            for judgement_doc in docs_to_process
        ]

        for future in tqdm(
            as_completed(futures), total=len(futures), desc="Judgements"
        ):
            result = future.result()

            if result.message:
                print(result.message)

            if result.status == "processed":
                processed += 1
                if not first_insert_logged:
                    print(
                        f"Inserted extracted features for source {result.source_id} into llm-extracted features."
                    )
                    first_insert_logged = True
            elif result.status == "skipped":
                skipped += 1
            else:
                failed += 1
                print(f"Failed to process source {result.source_id}: {result.message}")

    print(
        f"Extraction completed. processed={processed}, skipped={skipped}, failed={failed}, total={judgement_count}"
    )
