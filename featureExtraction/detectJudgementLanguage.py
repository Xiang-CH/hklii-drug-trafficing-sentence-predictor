from __future__ import annotations

import re
from typing import Any

from bs4 import BeautifulSoup
from pymongo import UpdateOne
from tqdm import tqdm

from db import DB

LANGUAGE_FIELD = "language"
BATCH_SIZE = 500

CJK_RE = re.compile(r"[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]")
LATIN_RE = re.compile(r"[A-Za-z]")


def html_to_text(html: Any) -> str:
    if not html or not isinstance(html, str):
        return ""
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(separator=" ", strip=True)


def detect_language(text: str) -> str:
    if not text:
        return "unknown"

    cjk_count = len(CJK_RE.findall(text))
    latin_count = len(LATIN_RE.findall(text))
    total = cjk_count + latin_count

    if total == 0:
        return "unknown"

    cjk_ratio = cjk_count / total
    if cjk_count >= 50 and cjk_ratio >= 0.30:
        return "chinese"
    return "english"


def build_judgement_text(doc: dict[str, Any]) -> str:
    parts = [
        html_to_text(doc.get("html")),
        html_to_text(doc.get("appeal_html")),
        html_to_text(doc.get("corrigendum_html")),
    ]
    return " ".join(part for part in parts if part).strip()


def flush_updates(collection, ops: list[UpdateOne]) -> int:
    if not ops:
        return 0
    result = collection.bulk_write(ops, ordered=False)
    return result.modified_count


def main() -> None:
    db = DB()
    collection = db.get_judgements_collection()

    cursor = collection.find(
        {},
        {
            "_id": 1,
            "html": 1,
            "appeal_html": 1,
            "corrigendum_html": 1,
        },
    )

    ops: list[UpdateOne] = []
    total = 0
    modified_total = 0

    for doc in tqdm(cursor, desc="Detecting language", total=collection.count_documents({})):
        text = build_judgement_text(doc)
        language = detect_language(text)
        ops.append(
            UpdateOne(
                {"_id": doc["_id"]},
                {"$set": {LANGUAGE_FIELD: language}},
            )
        )

        total += 1
        if len(ops) >= BATCH_SIZE:
            modified_total += flush_updates(collection, ops)
            ops = []

    modified_total += flush_updates(collection, ops)

    print(f"Processed: {total}")
    print(f"Updated: {modified_total}")


if __name__ == "__main__":
    main()
