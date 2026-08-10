"""Build the case-recommendation corpus from verified trial features.

Reads the shared verified-features cache, attaches each case's judgment language
so HKLII URLs can point at the English (/en/cases/...) or Chinese (/tc/cases/...)
version, computes guideline starting points, and emits:

- notebooks/predictionModel/case_recommender_corpus.json
- predictorBackend/src/case_recommender_corpus.json (read by the backend at runtime)

The starting-point buckets below mirror predictorBackend/src/guidelineModel.ts
(single source of truth). Run from the repo root:

    featureExtraction/.venv/bin/python notebooks/predictionModel/build_case_recommender_corpus.py
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient

prediction_model_dir = Path(__file__).resolve().parent
notebook_dir = prediction_model_dir.parent
repo_root = notebook_dir.parent
sys.path.insert(0, str(notebook_dir))

from linear_interpolation_model import (  # noqa: E402
    clean_quantity,
    flatten_documents,
    load_documents,
    trial_catalogue_key,
)

ROLE_WORKBOOK = prediction_model_dir / "Role Sentence Adjustments_updated 2026.07.30.xlsx"
JSON_OUT = prediction_model_dir / "case_recommender_corpus.json"
BACKEND_JSON_OUT = repo_root / "predictorBackend/src/case_recommender_corpus.json"
LANGUAGE_CACHE = notebook_dir / ".cache/case_recommender_languages.json"

DRUG_VERIFIED_TO_FAMILY = {
    "Cocaine": "Cocaine",
    "Heroin": "Heroin",
    "Methamphetamine": "Methamphetamine",
    "Ketamine": "Ketamine",
    "Fluorodeschloroketamine": "Ketamine",
    "Nimetazepam": "Nimetazepam",
    "Ecstasy": "Ecstasy",
    "Cannabis": "Cannabis",
    "THC/CBD": "Cannabis",
}
SUPPORTED_FAMILIES = {
    "Cocaine",
    "Ketamine",
    "Methamphetamine",
    "Heroin",
    "Cannabis",
    "Ecstasy",
    "Nimetazepam",
    "Midazolam",
}
AGGRAVATING_MODEL_MAP = {
    "Multiple drugs": "Multiple Drugs",
    "Persistent offender": "Persistent offender",
    "On bail": "On bail",
    "Refugee claimant": "Refugee/Asylum",
    "Use of minors": "Use of minors",
}
MITIGATING_MODEL_FACTORS = {
    "Self-consumption",
    "Assistance - limited",
    "Assistance - useful",
    "Assistance - testify",
    "Assistance - risk",
    "Young offender",
    "Medical conditions",
    "Family illness",
    "Rehabilitation programme",
}
ASSISTANCE_TIER = {
    "Assistance - limited": 1,
    "Assistance - useful": 2,
    "Assistance - testify": 3,
    "Assistance - risk": 4,
}
PLEA_EARLY = {"Up to committal", "Plea day"}
PLEA_LATE = {"After committal", "After dates fixed", "First day", "During trial"}

FAMILY = {
    "Cocaine": "Cocaine",
    "Ketamine": "Ketamine",
    "Fluorodeschloroketamine": "Ketamine",
    "Methamphetamine": "Methamphetamine",
    "Heroin": "Heroin",
    "Cannabis/THC": "Cannabis",
    "Ecstasy": "Ecstasy",
    "Nimetazepam": "Nimetazepam",
}

GUIDELINE_BUCKETS = {
    "Cocaine": [
        {"low_q": 0, "high_q": 10, "low_s": 24, "high_s": 60, "kind": "bounded"},
        {"low_q": 10, "high_q": 50, "low_s": 60, "high_s": 96, "kind": "bounded"},
        {"low_q": 50, "high_q": 200, "low_s": 96, "high_s": 144, "kind": "bounded"},
        {"low_q": 200, "high_q": 500, "low_s": 144, "high_s": 192, "kind": "bounded"},
        {"low_q": 500, "high_q": 1500, "low_s": 192, "high_s": 240, "kind": "bounded"},
        {"low_q": 1500, "high_q": 5000, "low_s": 240, "high_s": 288, "kind": "bounded"},
        {"low_q": 5000, "high_q": 15000, "low_s": 288, "high_s": 324, "kind": "bounded"},
        {"low_q": 15000, "high_q": 30000, "low_s": 324, "high_s": 360, "kind": "bounded"},
        {"low_q": 30000, "high_q": None, "low_s": 0, "high_s": 420, "kind": "discretionTop"},
    ],
    "Ketamine": [
        {"low_q": 0, "high_q": 1, "low_s": 0, "high_s": 24, "kind": "discretionStart"},
        {"low_q": 1, "high_q": 10, "low_s": 24, "high_s": 48, "kind": "bounded"},
        {"low_q": 10, "high_q": 50, "low_s": 48, "high_s": 72, "kind": "bounded"},
        {"low_q": 50, "high_q": 300, "low_s": 72, "high_s": 108, "kind": "bounded"},
        {"low_q": 300, "high_q": 600, "low_s": 108, "high_s": 144, "kind": "bounded"},
        {"low_q": 600, "high_q": 1000, "low_s": 144, "high_s": 168, "kind": "bounded"},
        {"low_q": 1000, "high_q": 2000, "low_s": 168, "high_s": 216, "kind": "bounded"},
        {"low_q": 2000, "high_q": 3000, "low_s": 216, "high_s": 240, "kind": "bounded"},
        {"low_q": 3000, "high_q": None, "low_s": 240, "high_s": None, "kind": "openUp"},
    ],
    "Methamphetamine": [
        {"low_q": 0, "high_q": 10, "low_s": 36, "high_s": 84, "kind": "bounded"},
        {"low_q": 10, "high_q": 70, "low_s": 84, "high_s": 132, "kind": "bounded"},
        {"low_q": 70, "high_q": 300, "low_s": 132, "high_s": 180, "kind": "bounded"},
        {"low_q": 300, "high_q": 600, "low_s": 180, "high_s": 216, "kind": "bounded"},
        {"low_q": 600, "high_q": 1500, "low_s": 216, "high_s": 240, "kind": "bounded"},
        {"low_q": 1500, "high_q": 5000, "low_s": 240, "high_s": 288, "kind": "bounded"},
        {"low_q": 5000, "high_q": 15000, "low_s": 288, "high_s": 324, "kind": "bounded"},
        {"low_q": 15000, "high_q": 30000, "low_s": 324, "high_s": 360, "kind": "bounded"},
        {"low_q": 30000, "high_q": None, "low_s": 0, "high_s": 420, "kind": "discretionTop"},
    ],
    "Heroin": [
        {"low_q": 0, "high_q": 10, "low_s": 24, "high_s": 60, "kind": "bounded"},
        {"low_q": 10, "high_q": 50, "low_s": 60, "high_s": 96, "kind": "bounded"},
        {"low_q": 50, "high_q": 200, "low_s": 96, "high_s": 144, "kind": "bounded"},
        {"low_q": 200, "high_q": 500, "low_s": 144, "high_s": 192, "kind": "bounded"},
        {"low_q": 500, "high_q": 1500, "low_s": 192, "high_s": 240, "kind": "bounded"},
        {"low_q": 1500, "high_q": 5000, "low_s": 240, "high_s": 288, "kind": "bounded"},
        {"low_q": 5000, "high_q": 15000, "low_s": 288, "high_s": 324, "kind": "bounded"},
        {"low_q": 15000, "high_q": 30000, "low_s": 324, "high_s": 360, "kind": "bounded"},
        {"low_q": 30000, "high_q": None, "low_s": 0, "high_s": 420, "kind": "discretionTop"},
    ],
    "Cannabis": [
        {"low_q": 0, "high_q": 2000, "low_s": 0, "high_s": 16, "kind": "bounded"},
        {"low_q": 2000, "high_q": 3000, "low_s": 16, "high_s": 24, "kind": "bounded"},
        {"low_q": 3000, "high_q": 6000, "low_s": 24, "high_s": 36, "kind": "bounded"},
        {"low_q": 6000, "high_q": 9000, "low_s": 36, "high_s": 48, "kind": "bounded"},
        {"low_q": 9000, "high_q": 15000, "low_s": 48, "high_s": 66, "kind": "bounded"},
        {"low_q": 15000, "high_q": 45000, "low_s": 66, "high_s": 96, "kind": "bounded"},
        {"low_q": 45000, "high_q": 90000, "low_s": 96, "high_s": 120, "kind": "bounded"},
        {"low_q": 90000, "high_q": None, "low_s": 120, "high_s": None, "kind": "openUp"},
    ],
    "Ecstasy": [
        {"low_q": 0, "high_q": 1, "low_s": 0, "high_s": 24, "kind": "discretionStart"},
        {"low_q": 1, "high_q": 10, "low_s": 24, "high_s": 48, "kind": "bounded"},
        {"low_q": 10, "high_q": 50, "low_s": 48, "high_s": 72, "kind": "bounded"},
        {"low_q": 50, "high_q": 300, "low_s": 72, "high_s": 108, "kind": "bounded"},
        {"low_q": 300, "high_q": 600, "low_s": 108, "high_s": 144, "kind": "bounded"},
        {"low_q": 600, "high_q": 1000, "low_s": 144, "high_s": 168, "kind": "bounded"},
        {"low_q": 1000, "high_q": 2000, "low_s": 168, "high_s": 216, "kind": "bounded"},
        {"low_q": 2000, "high_q": 3000, "low_s": 216, "high_s": 240, "kind": "bounded"},
        {"low_q": 3000, "high_q": None, "low_s": 240, "high_s": None, "kind": "openUp"},
    ],
    "Nimetazepam": [
        {"low_q": 0, "high_q": 1, "low_s": 0, "high_s": 24, "kind": "discretionStart"},
        {"low_q": 1, "high_q": 10, "low_s": 24, "high_s": 48, "kind": "bounded"},
        {"low_q": 10, "high_q": 50, "low_s": 48, "high_s": 72, "kind": "bounded"},
        {"low_q": 50, "high_q": 300, "low_s": 72, "high_s": 108, "kind": "bounded"},
        {"low_q": 300, "high_q": 600, "low_s": 108, "high_s": 144, "kind": "bounded"},
        {"low_q": 600, "high_q": 1000, "low_s": 144, "high_s": 168, "kind": "bounded"},
        {"low_q": 1000, "high_q": 2000, "low_s": 168, "high_s": 216, "kind": "bounded"},
        {"low_q": 2000, "high_q": 3000, "low_s": 216, "high_s": 240, "kind": "bounded"},
        {"low_q": 3000, "high_q": None, "low_s": 240, "high_s": None, "kind": "openUp"},
    ],
    "Midazolam-powder": [
        {"low_q": 0, "high_q": 500, "low_s": 0, "high_s": 6, "kind": "discretionStart"},
        {"low_q": 500, "high_q": 1000, "low_s": 6, "high_s": 12, "kind": "bounded"},
        {"low_q": 1000, "high_q": 2000, "low_s": 12, "high_s": 24, "kind": "bounded"},
        {"low_q": 2000, "high_q": 3000, "low_s": 24, "high_s": 36, "kind": "bounded"},
        {"low_q": 3000, "high_q": 6000, "low_s": 36, "high_s": 54, "kind": "bounded"},
        {"low_q": 6000, "high_q": 9000, "low_s": 54, "high_s": 72, "kind": "bounded"},
        {"low_q": 9000, "high_q": None, "low_s": 72, "high_s": None, "kind": "openUp"},
    ],
}


def family_for(drug_type: str, variant: str | None = None) -> str | None:
    if drug_type == "Midazolam":
        return "Midazolam-powder" if variant == "powder" else None
    return FAMILY.get(drug_type)


def interpolate(bucket: dict, quantity: float, previous_high_s: float | None) -> float:
    if bucket["high_q"] is not None and bucket["high_s"] is not None:
        u = (quantity - bucket["low_q"]) / (bucket["high_q"] - bucket["low_q"])
        return bucket["low_s"] + u * (bucket["high_s"] - bucket["low_s"])
    if bucket["kind"] == "discretionTop" and previous_high_s is not None:
        return previous_high_s
    return bucket["low_s"]


def predict_starting_point_months(
    drug_type: str, quantity: float, variant: str | None = None
) -> float | None:
    family = family_for(drug_type, variant)
    if family is None:
        return None
    previous_high_s = None
    for bucket in GUIDELINE_BUCKETS[family]:
        if bucket["high_q"] is not None:
            if bucket["low_q"] <= quantity < bucket["high_q"]:
                return interpolate(bucket, quantity, previous_high_s)
        else:
            if quantity >= bucket["low_q"]:
                return interpolate(bucket, quantity, previous_high_s)
        if bucket["high_s"] is not None:
            previous_high_s = bucket["high_s"]
    return None


def predict_notional_weighted_months(drugs: list[dict]) -> float | None:
    total = sum(d["quantity"] for d in drugs)
    if total <= 0:
        return 0.0
    starting = 0.0
    for drug in drugs:
        sentence_at_total = predict_starting_point_months(
            drug["type"], total, drug.get("variant")
        )
        if sentence_at_total is None:
            return None
        starting += sentence_at_total * (drug["quantity"] / total)
    return starting


def load_judgement_languages(
    source_ids: set[str],
    refresh: bool = False,
) -> dict[str, str]:
    if not refresh and LANGUAGE_CACHE.exists():
        return json.loads(LANGUAGE_CACHE.read_text())
    for env_path in (
        repo_root / "featureExtraction" / ".env",
        repo_root / "featureVerification" / ".env.local",
        repo_root / ".env",
    ):
        if env_path.exists():
            load_dotenv(env_path)
    mongo_uri = os.getenv("DB_MONGODB_URI")
    if not mongo_uri:
        raise RuntimeError(
            "DB_MONGODB_URI is required to fetch judgment languages (or provide "
            "the cached file at notebooks/.cache/case_recommender_languages.json)"
        )
    client = MongoClient(mongo_uri)
    database = client.get_database(os.getenv("DB_NAME", "drug-sentencing-predictor"))
    judgement_ids = []
    for source_id in sorted(source_ids):
        try:
            judgement_ids.append(ObjectId(source_id))
        except ValueError:
            continue
    languages: dict[str, str] = {}
    for start in range(0, len(judgement_ids), 1000):
        ids = judgement_ids[start : start + 1000]
        cursor = database.get_collection("judgement-html").find(
            {"_id": {"$in": ids}}, {"language": 1}
        )
        for doc in cursor:
            languages[str(doc["_id"])] = doc.get("language", "unknown")
    client.close()
    LANGUAGE_CACHE.parent.mkdir(parents=True, exist_ok=True)
    LANGUAGE_CACHE.write_text(json.dumps(languages, sort_keys=True))
    return languages


def build_url(neutral_citation: str, language: str) -> str | None:
    match = re.search(r"\[([0-9]*)\] ([a-zA-Z]*) ([0-9]*)", neutral_citation)
    if not match:
        return None
    year, court, cno = match.groups()
    segment = "tc" if language in ("chinese", "traditional_chinese") else "en"
    return (
        f"https://www.hklii.hk/{segment}/cases/{court.lower()}/{year}/{cno}"
    )


def emit_json(records: list[dict], path: Path) -> None:
    path.write_text(json.dumps(records, indent=1, sort_keys=True))
    print("Wrote", path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the case-recommendation corpus")
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Refetch judgment languages from MongoDB instead of using the cache",
    )
    args = parser.parse_args()

    documents, _meta = load_documents(notebook_dir, refresh_cache=False)
    trial_rows, _effects = flatten_documents(documents)

    language_by_source_id = load_judgement_languages(
        {
            str(doc["source_judgement_id"])
            for doc in documents
            if doc.get("source_judgement_id")
        },
        refresh=args.refresh,
    )
    language_by_citation: dict[str, str] = {}
    for doc in documents:
        citation = (doc.get("judgement") or {}).get("neutral_citation")
        source_id = doc.get("source_judgement_id")
        if not citation or not source_id:
            continue
        language = language_by_source_id.get(str(source_id), "unknown")
        if language_by_citation.get(citation, "unknown") == "unknown":
            language_by_citation[citation] = language

    workbook = pd.read_excel(ROLE_WORKBOOK)
    workbook["role_catalogue_key"] = workbook.apply(
        lambda r: trial_catalogue_key(
            r["neutral_citation"], r["trial_index"], r["Charge_no"], r["Defendant_id"]
        ),
        axis=1,
    )
    workbook["workbook_excluded"] = (
        pd.to_numeric(workbook["Exclusion"], errors="coerce").fillna(0).eq(1)
    )
    role_map = {
        "Actual trafficker": "Actual trafficker",
        "Manager/organiser": "Manager / Organiser",
        "Operator/financial controller": "Operator / Financial Controller",
    }
    workbook["model_role"] = (
        workbook["Defendant's Role"].astype(str).str.strip().map(role_map)
    )
    workbook["model_cross_border"] = workbook["Additional Circumstances"].eq(
        "Cross-border trafficking"
    )
    role_rows = (
        workbook.loc[
            ~workbook["workbook_excluded"] & workbook["model_role"].notna(),
            ["role_catalogue_key", "model_role", "model_cross_border"],
        ]
        .drop_duplicates("role_catalogue_key")
    )

    trial_rows = trial_rows.loc[
        ~trial_rows["source_document_excluded"]
        & trial_rows["final_sentence_months"].notna()
        & ~trial_rows["final_sentence_inferred"]
    ].copy()
    trial_rows = trial_rows.merge(
        role_rows, on="role_catalogue_key", how="left", validate="many_to_one"
    )

    records = []
    skipped = {"unsupported_drug": 0, "no_supported_drug": 0, "bad_url": 0}
    for _index, row in trial_rows.iterrows():
        drugs = json.loads(row["drugs_json"])
        amounts = defaultdict(float)
        unsupported = False
        for drug in drugs:
            drug_type = drug.get("drug_type")
            if not drug_type:
                continue
            quantity, invalid = clean_quantity(drug.get("quantity"))
            if invalid or quantity <= 0:
                continue
            if drug_type == "Other":
                other = (drug.get("other_drug_type") or "").strip().lower()
                if "midazolam" in other:
                    amounts["Midazolam"] += quantity
                else:
                    unsupported = True
                continue
            family = DRUG_VERIFIED_TO_FAMILY.get(drug_type)
            if family is None:
                unsupported = True
                continue
            amounts[family] += quantity
        if unsupported:
            skipped["unsupported_drug"] += 1
            continue
        if not amounts:
            skipped["no_supported_drug"] += 1
            continue

        model_drugs = []
        for family, quantity in amounts.items():
            if family == "Midazolam":
                model_drugs.append(
                    {"type": "Midazolam", "quantity": quantity, "variant": "powder"}
                )
            else:
                model_type = "Cannabis/THC" if family == "Cannabis" else family
                model_drugs.append({"type": model_type, "quantity": quantity})
        starting_point = predict_notional_weighted_months(model_drugs)
        if starting_point is None:
            continue

        citation = row["neutral_citation"]
        language = language_by_citation.get(citation, "unknown")
        if language not in ("english", "chinese"):
            language = "english"
        url = build_url(citation, language)
        if url is None:
            skipped["bad_url"] += 1
            url = ""

        canonical_aggravating = set(row["canonical_aggravating_factors"])
        aggravating = [
            AGGRAVATING_MODEL_MAP[f]
            for f in canonical_aggravating
            if f in AGGRAVATING_MODEL_MAP
        ]
        model_cross_border = row.get("model_cross_border")
        if pd.isna(model_cross_border):
            model_cross_border = False
        cross_border = bool(model_cross_border) or (
            "Cross-border trafficking" in canonical_aggravating
        )
        mitigating = [
            f
            for f in row["canonical_mitigating_factors"]
            if f in MITIGATING_MODEL_FACTORS
        ]
        assistance = 0
        for f in row["canonical_mitigating_factors"]:
            if f in ASSISTANCE_TIER:
                assistance = max(assistance, ASSISTANCE_TIER[f])

        plea = json.loads(row["guilty_plea_json"])
        plea_bucket = "none"
        if plea.get("pleaded_guilty"):
            stage = (
                plea.get("high_court_stage")
                or plea.get("district_court_stage")
                or "Unknown"
            )
            if stage in PLEA_EARLY:
                plea_bucket = "early"
            elif stage in PLEA_LATE:
                plea_bucket = "late"

        role = row.get("model_role")
        if pd.isna(role):
            role = None
        records.append(
            {
                "neutralCitation": citation,
                "title": f"HKSAR v {row['defendant_name']}",
                "url": url,
                "language": language,
                "drugs": dict(amounts),
                "role": role,
                "crossBorder": cross_border,
                "aggravating": aggravating,
                "mitigating": mitigating,
                "assistance": assistance,
                "plea": plea_bucket,
                "actualFinalMonths": row["final_sentence_months"],
                "startingPointMonths": round(starting_point, 6),
            }
        )

    titles = {}
    for record in records:
        title = titles.get(record["neutralCitation"])
        if title is None:
            titles[record["neutralCitation"]] = record["title"]
        else:
            record["title"] = title

    corpus = sorted(
        records,
        key=lambda r: (r["neutralCitation"], r["actualFinalMonths"]),
    )
    print(f"corpus records: {len(corpus)}")
    print(f"skipped: {skipped}")

    emit_json(corpus, JSON_OUT)
    emit_json(corpus, BACKEND_JSON_OUT)


if __name__ == "__main__":
    main()
