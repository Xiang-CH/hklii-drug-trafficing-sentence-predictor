import os
import re
import json

from db import DB

# from openai import OpenAI
from langfuse.openai import openai  # Langfuse OpenAI wrapper for observability
from openai._exceptions import OpenAIError
from bs4 import BeautifulSoup
from pydantic import ValidationError
from tqdm import tqdm
from langfuse import observe

from schema import Judgement, Defendants, Trials
from utils.htmlToText import html_to_text_with_tables

from langfuse import Langfuse
from dotenv import load_dotenv

load_dotenv()
langfuse = Langfuse()

RERUN_ALL = False
MAX_RETRIES = 5
MODEL = os.getenv("MODEL", "gpt-5-mini")

# 0 means no limit
EXTRACT_LIMIT = int(os.getenv("EXTRACT_LIMIT", "0"))

# Define schemas with their specific prompts in sequence order
SCHEMA_CONFIGS = {
    "judgement": {
        "model": Judgement,
        "prompt": (
            "Extract the judgement metadata according to the provided schema. "
            "There may be multiple charges in a single defendant; single charge for multiple defendants; "
            "or multiple charges for multiple defendants; etc. So ensure to capture all charges and link them to the correct defendants. "
            "If a feature is not mentioned in the case, set the corresponding field to null, "
            "but check the case text thoroughly."
        ),
    },
    "defendants": {
        "model": Defendants,
        "prompt": (
            "Extract all defendant information according to the provided schema. "
            "Here are the list of defendant ids and names: \n{defendant_ids_and_names}.\n\n "
            "If a feature is not mentioned in the case, set the corresponding field to null, "
            "but check the case text thoroughly."
        ),
    },
    "trials": {
        "model": Trials,
        "prompt": (
            "Extract all trial information according to the provided schema. "
            "You need to extract the information for each charge to defendant pair separately. "
            "Here are the list of charge to defendant mappings extracted from the judgement: \n{charge_to_defendants}.\n\n "
            "If a feature is not mentioned in the case, set the corresponding field to null, "
            "but check the case text thoroughly."
        ),
    },
}

# Extraction order - each can use context from previous extractions
EXTRACTION_ORDER = ["judgement", "defendants", "trials"]

os.chdir(os.path.dirname(os.path.abspath(__file__)))
db = DB()
judgements_collection = db.get_judgements_collection()
extracted_features_collection = db.get_extracted_features_collection()
client = openai.OpenAI(
    base_url=os.getenv("OPENAI_BASE_URL"),
)


@observe(name="extract_single_schema")
def extract_single_schema(
    schema_name: str,
    case_txt: str,
    judgement_type: str,
    output_path: str,
    previous_extractions: dict[str, dict] | None = None,
) -> Judgement | Defendants | Trials:
    """Extract a single schema, optionally using context from previous extractions."""
    config = SCHEMA_CONFIGS[schema_name]
    schema_model = config["model"]
    base_prompt = config["prompt"]

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            error_context = ""
            if last_error:
                error_context = f"\n\nPrevious attempt failed with error: {last_error}. Please try again carefully."

            full_input = case_txt + error_context

            if schema_name == "defendants":
                base_prompt = base_prompt.format(
                    defendant_ids_and_names="\n".join(
                        [
                            f"{d.id}. {d.name}"
                            for d in previous_extractions["defendants"]
                        ]
                    )
                )
            elif schema_name == "trials":
                charge_to_defendants_list = []
                for charge in previous_extractions["charge_to_defendants"]:
                    charge_to_defendants_list.append(
                        f"Charge {charge.charge_no}. {charge.charge_name}"
                    )
                    for defendant in charge.defendants_of_charge:
                        charge_to_defendants_list.append(
                            f"  -> On Defendant {defendant.defendant_id}: {defendant.defendant_name}"
                        )
                base_prompt = base_prompt.format(
                    charge_to_defendants="\n".join(charge_to_defendants_list)
                )

            response = client.responses.parse(
                name=f"{schema_name}-extraction-{attempt + 1}",
                model=MODEL,
                instructions=base_prompt,
                input=full_input,
                reasoning={"summary": "detailed"},
                text_format=schema_model,
                metadata={
                    "judgement_type": judgement_type,
                    "schema_name": schema_name,
                    "attempt": str(attempt + 1),
                },
            )

            # Check if parsing succeeded
            if response.output_parsed is None:
                # Check for refusal
                if hasattr(response, "refusal") and response.refusal:
                    raise ValueError(
                        f"Model refused to generate output: {response.refusal}"
                    )
                # Check raw output for debugging
                raw_output = getattr(response, "output_text", None) or getattr(
                    response, "output", None
                )
                raise ValueError(f"Failed to parse response. Raw output: {raw_output}")

            output_dict = response.output_parsed.model_dump(mode="json")

            with open(output_path, "w") as f:
                output_dict_with_trace = output_dict.copy()
                output_dict_with_trace["tracing_id"] = langfuse.get_current_trace_id()
                f.write(
                    json.dumps(output_dict_with_trace, indent=2, ensure_ascii=False)
                )

            return response.output_parsed  # Return for use in subsequent extractions

        except (OpenAIError, ValidationError, ValueError) as e:
            # print(f"Attempt {attempt + 1} failed for {schema_name}: {str(e)}")
            if isinstance(e, ValidationError):
                last_error = str(e)
            if attempt == MAX_RETRIES - 1:
                print(
                    f"Failed to extract {schema_name} for {judgement_type} after {MAX_RETRIES} attempts: {last_error}"
                )
                raise

    return {}


@observe(name="extract_all_features")
def extract_all_features(
    case_txt: str, judgement_type: str
) -> tuple[Judgement, Defendants, Trials]:
    """Extract all features in sequence, passing context between extractions."""
    langfuse.update_current_trace(
        input={"judgement_type": judgement_type, "model": MODEL},
        tags=["feature-extraction"],
    )

    previous_extractions: dict[str, dict] = {}
    extracted_by_schema: dict[str, Judgement | Defendants | Trials] = {}

    for schema_name in tqdm(EXTRACTION_ORDER, desc="Schemas", leave=False):
        # Extract with context from previous extractions
        extracted_data = extract_single_schema(
            schema_name=schema_name,
            case_txt=case_txt,
            judgement_type=judgement_type,
            output_path=os.devnull,
            previous_extractions=previous_extractions if previous_extractions else None,
        )

        extracted_by_schema[schema_name] = extracted_data

        # Store for use in subsequent extractions
        if schema_name == "judgement":
            previous_extractions["defendants"] = extracted_data.defendants
            previous_extractions["charge_to_defendants"] = extracted_data.charges

    langfuse.update_current_trace(
        output={"schemas_extracted": list(previous_extractions.keys())}
    )

    return (
        extracted_by_schema["judgement"],
        extracted_by_schema["defendants"],
        extracted_by_schema["trials"],
        langfuse.get_current_trace_id(),
    )


def build_case_text(judgement_doc: dict) -> tuple[str, str]:
    has_appeal = bool(judgement_doc.get("appeal"))
    has_corrigendum = bool(judgement_doc.get("corrigendum"))

    judgement_type = "standard"
    if has_appeal:
        judgement_type = "appeal"
    elif has_corrigendum:
        judgement_type = "corrigendum"

    case_txt = ""
    if judgement_doc.get("html"):
        case_html = BeautifulSoup(judgement_doc["html"], "html.parser")
        case_txt += html_to_text_with_tables(case_html)

    if has_appeal and judgement_doc.get("appeal_html"):
        appeal_html = BeautifulSoup(judgement_doc["appeal_html"], "html.parser")
        case_txt += html_to_text_with_tables(appeal_html)

    if has_corrigendum and judgement_doc.get("corrigendum_html"):
        corrigendum_html = BeautifulSoup(
            judgement_doc["corrigendum_html"], "html.parser"
        )
        case_txt += html_to_text_with_tables(corrigendum_html)

    case_txt = re.sub(r"\n\s*\n", "\n\n", case_txt).strip()

    return case_txt, judgement_type


def should_skip_extraction(source_id) -> bool:
    if RERUN_ALL:
        return False
    return (
        extracted_features_collection.count_documents(
            {"source_judgement_id": source_id}
        )
        > 0
    )


if __name__ == "__main__":
    filter = {
        "_id": {"$nin": extracted_features_collection.distinct("source_judgement_id")}
    }
    judgement_count = judgements_collection.count_documents(filter)
    print(
        f"Found {judgement_count} unprocessed judgement records in judgement-html collection."
    )

    cursor = judgements_collection.find(filter)
    if EXTRACT_LIMIT > 0:
        cursor = cursor.limit(EXTRACT_LIMIT)

    processed = 0
    skipped = 0
    for judgement_doc in tqdm(
        cursor,
        desc="Judgements",
        total=min(judgement_count, EXTRACT_LIMIT)
        if EXTRACT_LIMIT > 0
        else judgement_count,
    ):
        source_id = judgement_doc.get("_id")
        if source_id is None:
            print("Skipping document without _id.")
            skipped += 1
            continue

        if should_skip_extraction(source_id):
            skipped += 1
            continue

        case_txt, judgement_type = build_case_text(judgement_doc)
        if not case_txt:
            print(f"Skipping {source_id}: empty html content")
            skipped += 1
            continue

        judgement_data, defendants_data, trials_data, trace_id = extract_all_features(
            case_txt, judgement_type
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
        processed += 1
        if processed == 1:
            print(
                f"Inserted extracted features for source {source_id} into llm-extracted features."
            )

        langfuse.flush()

    print(
        f"Extraction completed. processed={processed}, skipped={skipped}, total={judgement_count}"
    )

    # Flush Langfuse to ensure all traces are sent
    langfuse.flush()
