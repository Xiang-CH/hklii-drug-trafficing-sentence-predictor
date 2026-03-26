import argparse
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo.collection import Collection

from db import DB

VERIFIED_FEATURES_COLLECTION_NAME = "verified-features"
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


@dataclass(frozen=True)
class DuplicateGroup:
    filename: str | None
    year: str | None
    docs: list[dict[str, Any]]
    extraction_docs: list[dict[str, Any]]
    verified_docs: list[dict[str, Any]]


@dataclass
class Summary:
    groups: int = 0
    judgement_updates: int = 0
    judgement_deletes: int = 0
    extraction_updates: int = 0
    extraction_deletes: int = 0
    verified_updates: int = 0
    verified_deletes: int = 0


def normalize_object_id(value: Any) -> str | None:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, str) and ObjectId.is_valid(value):
        return str(ObjectId(value))
    return None


def is_present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value != ""
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True


def coerce_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return (
            value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        )
    if isinstance(value, str):
        try:
            normalized = value.replace("Z", "+00:00")
            parsed = datetime.fromisoformat(normalized)
            return (
                parsed
                if parsed.tzinfo is not None
                else parsed.replace(tzinfo=timezone.utc)
            )
        except ValueError:
            return None
    return None


def document_timestamp(doc: dict[str, Any]) -> datetime:
    values = [
        coerce_datetime(doc.get("updated_at")),
        coerce_datetime(doc.get("updatedAt")),
        coerce_datetime(doc.get("verified_at")),
        coerce_datetime(doc.get("created_at")),
    ]
    object_id = doc.get("_id")
    if isinstance(object_id, ObjectId):
        values.append(object_id.generation_time)
    present_values = [value for value in values if value is not None]
    return max(present_values) if present_values else EPOCH


def build_id_filter(field_name: str, object_ids: list[ObjectId]) -> dict[str, Any]:
    return {
        "$or": [
            {field_name: {"$in": object_ids}},
            {field_name: {"$in": [str(object_id) for object_id in object_ids]}},
        ]
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--year")
    parser.add_argument("--filename")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


def find_duplicate_groups(
    judgements_collection: Collection,
    extracted_collection: Collection,
    verified_collection: Collection,
    *,
    year: str | None,
    filename: str | None,
    limit: int,
) -> list[DuplicateGroup]:
    match_filter: dict[str, Any] = {}
    if year:
        match_filter["year"] = year
    if filename:
        match_filter["filename"] = filename

    pipeline: list[dict[str, Any]] = []
    if match_filter:
        pipeline.append({"$match": match_filter})
    pipeline.extend(
        [
            {
                "$group": {
                    "_id": {
                        "filename": "$filename",
                        "year": "$year",
                    },
                    "ids": {"$push": "$_id"},
                    "count": {"$sum": 1},
                }
            },
            {"$match": {"count": {"$gt": 1}}},
            {"$sort": {"_id.year": -1, "_id.filename": 1}},
        ]
    )
    if limit > 0:
        pipeline.append({"$limit": limit})

    raw_groups = list(judgements_collection.aggregate(pipeline, allowDiskUse=True))
    if not raw_groups:
        return []

    duplicate_ids = [
        object_id
        for group in raw_groups
        for object_id in group["ids"]
        if isinstance(object_id, ObjectId)
    ]

    judgement_docs = list(judgements_collection.find({"_id": {"$in": duplicate_ids}}))
    extracted_docs = list(
        extracted_collection.find(build_id_filter("source_judgement_id", duplicate_ids))
    )
    verified_docs = list(
        verified_collection.find(build_id_filter("source_judgement_id", duplicate_ids))
    )

    judgement_map = {
        normalize_object_id(doc.get("_id")): doc for doc in judgement_docs if doc.get("_id")
    }
    extracted_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for doc in extracted_docs:
        source_id = normalize_object_id(doc.get("source_judgement_id"))
        if source_id:
            extracted_by_source[source_id].append(doc)

    verified_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for doc in verified_docs:
        source_id = normalize_object_id(doc.get("source_judgement_id"))
        if source_id:
            verified_by_source[source_id].append(doc)

    groups: list[DuplicateGroup] = []
    for raw_group in raw_groups:
        docs = [
            judgement_map[source_id]
            for source_id in (
                normalize_object_id(object_id) for object_id in raw_group["ids"]
            )
            if source_id and source_id in judgement_map
        ]
        extraction_docs = [
            doc
            for doc_list in (
                extracted_by_source.get(normalize_object_id(object_id) or "", [])
                for object_id in raw_group["ids"]
            )
            for doc in doc_list
        ]
        group_verified_docs = [
            doc
            for doc_list in (
                verified_by_source.get(normalize_object_id(object_id) or "", [])
                for object_id in raw_group["ids"]
            )
            for doc in doc_list
        ]
        groups.append(
            DuplicateGroup(
                filename=raw_group["_id"].get("filename"),
                year=raw_group["_id"].get("year"),
                docs=docs,
                extraction_docs=extraction_docs,
                verified_docs=group_verified_docs,
            )
        )

    return groups


def choose_keeper(group: DuplicateGroup) -> dict[str, Any]:
    extraction_counts: dict[str, int] = defaultdict(int)
    for doc in group.extraction_docs:
        source_id = normalize_object_id(doc.get("source_judgement_id"))
        if source_id:
            extraction_counts[source_id] += 1

    verified_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for doc in group.verified_docs:
        source_id = normalize_object_id(doc.get("source_judgement_id"))
        if source_id:
            verified_by_source[source_id].append(doc)

    def score(doc: dict[str, Any]) -> tuple[bool, bool, bool, datetime, str]:
        source_id = normalize_object_id(doc.get("_id")) or ""
        verified_docs = verified_by_source.get(source_id, [])
        has_verified = any(item.get("is_verified") is True for item in verified_docs)
        has_extraction = extraction_counts.get(source_id, 0) > 0
        return (
            is_present(doc.get("assigned_to")),
            has_extraction,
            has_verified,
            document_timestamp(doc),
            source_id,
        )

    return max(group.docs, key=score)


def choose_primary_extraction(
    extraction_docs: list[dict[str, Any]], keeper_id: ObjectId
) -> dict[str, Any] | None:
    if not extraction_docs:
        return None
    keeper_id_str = str(keeper_id)

    def score(doc: dict[str, Any]) -> tuple[bool, datetime, str]:
        return (
            normalize_object_id(doc.get("source_judgement_id")) == keeper_id_str,
            document_timestamp(doc),
            normalize_object_id(doc.get("_id")) or "",
        )

    return max(extraction_docs, key=score)


def choose_primary_verified(
    verified_docs: list[dict[str, Any]], keeper_id: ObjectId
) -> dict[str, Any] | None:
    if not verified_docs:
        return None
    keeper_id_str = str(keeper_id)

    def score(doc: dict[str, Any]) -> tuple[bool, bool, datetime, str]:
        return (
            doc.get("is_verified") is True,
            normalize_object_id(doc.get("source_judgement_id")) == keeper_id_str,
            document_timestamp(doc),
            normalize_object_id(doc.get("_id")) or "",
        )

    return max(verified_docs, key=score)


def build_judgement_update(
    keeper: dict[str, Any], duplicate_docs: list[dict[str, Any]]
) -> dict[str, Any]:
    update_fields: dict[str, Any] = {}

    for duplicate_doc in duplicate_docs:
        if duplicate_doc.get("_id") == keeper.get("_id"):
            continue

        for field_name, field_value in duplicate_doc.items():
            if field_name == "_id":
                continue

            keeper_value = update_fields.get(field_name, keeper.get(field_name))
            if field_name in {"updated_at", "updatedAt"}:
                if document_timestamp({field_name: field_value}) > document_timestamp(
                    {field_name: keeper_value}
                ):
                    update_fields[field_name] = field_value
                continue

            if not is_present(keeper_value) and is_present(field_value):
                update_fields[field_name] = field_value

    return update_fields


def build_extraction_update(
    extraction_doc: dict[str, Any] | None, keeper: dict[str, Any]
) -> dict[str, Any]:
    if extraction_doc is None:
        return {}
    update_fields = {
        "source_judgement_id": keeper["_id"],
        "trial": keeper.get("trial"),
        "appeal": keeper.get("appeal"),
        "corrigendum": keeper.get("corrigendum"),
    }
    current_values = {
        "source_judgement_id": extraction_doc.get("source_judgement_id"),
        "trial": extraction_doc.get("trial"),
        "appeal": extraction_doc.get("appeal"),
        "corrigendum": extraction_doc.get("corrigendum"),
    }
    return {
        field_name: field_value
        for field_name, field_value in update_fields.items()
        if current_values.get(field_name) != field_value
    }


def build_verified_update(
    verified_doc: dict[str, Any] | None,
    keeper: dict[str, Any],
    primary_extraction_id: ObjectId | None,
) -> dict[str, Any]:
    if verified_doc is None:
        return {}

    update_fields: dict[str, Any] = {}
    if verified_doc.get("source_judgement_id") != keeper["_id"]:
        update_fields["source_judgement_id"] = keeper["_id"]
    if (
        primary_extraction_id is not None
        and verified_doc.get("source_llm_extraction_id") != primary_extraction_id
    ):
        update_fields["source_llm_extraction_id"] = primary_extraction_id
    return update_fields


def apply_group(
    group: DuplicateGroup,
    judgements_collection: Collection,
    extracted_collection: Collection,
    verified_collection: Collection,
    *,
    apply: bool,
    summary: Summary,
) -> None:
    keeper = choose_keeper(group)
    keeper_id = keeper["_id"]
    keeper_id_str = str(keeper_id)

    judgement_update = build_judgement_update(keeper, group.docs)
    judgement_ids_to_delete = [
        doc["_id"] for doc in group.docs if doc.get("_id") != keeper_id
    ]

    primary_extraction = choose_primary_extraction(group.extraction_docs, keeper_id)
    primary_extraction_id = (
        primary_extraction.get("_id")
        if primary_extraction is not None and isinstance(primary_extraction.get("_id"), ObjectId)
        else None
    )
    extraction_update = build_extraction_update(primary_extraction, keeper)
    extraction_ids_to_delete = [
        doc["_id"]
        for doc in group.extraction_docs
        if primary_extraction is not None and doc.get("_id") != primary_extraction.get("_id")
    ]

    primary_verified = choose_primary_verified(group.verified_docs, keeper_id)
    verified_update = build_verified_update(
        primary_verified, keeper, primary_extraction_id
    )
    verified_ids_to_delete = [
        doc["_id"]
        for doc in group.verified_docs
        if primary_verified is not None and doc.get("_id") != primary_verified.get("_id")
    ]

    summary.groups += 1
    summary.judgement_updates += int(bool(judgement_update))
    summary.judgement_deletes += len(judgement_ids_to_delete)
    summary.extraction_updates += int(bool(extraction_update))
    summary.extraction_deletes += len(extraction_ids_to_delete)
    summary.verified_updates += int(bool(verified_update))
    summary.verified_deletes += len(verified_ids_to_delete)

    mode = "APPLY" if apply else "DRY RUN"
    print(
        f"[{mode}] {group.year or '?'} / {group.filename or '?'} "
        f"keep={keeper_id_str} "
        f"delete_judgements={len(judgement_ids_to_delete)} "
        f"delete_extractions={len(extraction_ids_to_delete)} "
        f"delete_verified={len(verified_ids_to_delete)}"
    )

    if not apply:
        return

    if judgement_update:
        judgements_collection.update_one({"_id": keeper_id}, {"$set": judgement_update})

    if primary_extraction is not None and extraction_update:
        extracted_collection.update_one(
            {"_id": primary_extraction["_id"]}, {"$set": extraction_update}
        )

    if extraction_ids_to_delete and primary_extraction_id is not None:
        verified_collection.update_many(
            build_id_filter("source_llm_extraction_id", extraction_ids_to_delete),
            {"$set": {"source_llm_extraction_id": primary_extraction_id}},
        )
        extracted_collection.delete_many({"_id": {"$in": extraction_ids_to_delete}})

    if primary_verified is not None and verified_update:
        verified_collection.update_one(
            {"_id": primary_verified["_id"]}, {"$set": verified_update}
        )

    if verified_ids_to_delete:
        verified_collection.delete_many({"_id": {"$in": verified_ids_to_delete}})

    if judgement_ids_to_delete:
        judgements_collection.delete_many({"_id": {"$in": judgement_ids_to_delete}})


def main() -> None:
    args = parse_args()
    db = DB()
    judgements_collection = db.get_judgements_collection()
    extracted_collection = db.get_extracted_features_collection()
    verified_collection = db.database.get_collection(VERIFIED_FEATURES_COLLECTION_NAME)

    groups = find_duplicate_groups(
        judgements_collection,
        extracted_collection,
        verified_collection,
        year=args.year,
        filename=args.filename,
        limit=args.limit,
    )

    if not groups:
        print("No duplicate judgement groups found.")
        return

    summary = Summary()
    for group in groups:
        apply_group(
            group,
            judgements_collection,
            extracted_collection,
            verified_collection,
            apply=args.apply,
            summary=summary,
        )

    mode = "Applied" if args.apply else "Planned"
    print(
        f"{mode} deduplication for {summary.groups} groups. "
        f"judgement_updates={summary.judgement_updates}, "
        f"judgement_deletes={summary.judgement_deletes}, "
        f"extraction_updates={summary.extraction_updates}, "
        f"extraction_deletes={summary.extraction_deletes}, "
        f"verified_updates={summary.verified_updates}, "
        f"verified_deletes={summary.verified_deletes}"
    )


if __name__ == "__main__":
    main()
