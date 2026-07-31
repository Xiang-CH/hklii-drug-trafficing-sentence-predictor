from __future__ import annotations

import json
import math
import os
import re
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pymongo import MongoClient


RANDOM_SEED = 2026
TEST_SIZE = 0.20
MIN_CURVE_SUPPORT = 10
# Every direct, non-inferred training adjustment contributes to its factor median.
# Drug curves retain their separate 10-case minimum because sparse curves cannot
# be interpolated reliably.
MIN_FACTOR_SUPPORT = 1
QUANTILES = (0.0, 0.10, 0.25, 0.50, 0.75, 0.90, 1.0)
INFERRED_ROLE_SOURCE = "Inferred as starting point since role adjustment not provided"
CANONICAL_FACTOR_MAP = {
	"Import": "Cross-border trafficking",
	"Export": "Cross-border trafficking",
	"Refugee/Asylum": "Refugee claimant",
}
# Exact percentage rules present in legacy_model.py, mapped only where the
# current verified-factor vocabulary has an unambiguous equivalent.  This is
# a comparison strategy, not a replacement for the data-derived medians.
LEGACY_PERCENTAGE_EFFECTS = {
	"role": {},
	"aggravation": {
		"Cross-border trafficking": 0.0519,
		"Refugee claimant": 0.0595,
		"On bail": 0.0411,
		"Persistent offender": 0.0591,
	},
	"mitigation": {"Self-consumption": 0.10},
	"plea": {
		"Guilty plea: Up to committal": 1 / 3,
		"Guilty plea: Plea day": 1 / 3,
		"Guilty plea: After dates fixed": 1 / 4,
		"Guilty plea: First day": 1 / 4,
		"Guilty plea: During trial": 1 / 4,
	},
}
EXCEL_ILLEGAL_CHARACTERS = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F]")
ROLE_WORKBOOK_FILENAME = "Role Sentence Adjustments.xlsx"
ROLE_WORKBOOK_COLUMNS = {
	"neutral_citation",
	"trial_index",
	"Charge_no",
	"Defendant_id",
	"Defendant Role",
	"Additional Circumstances",
	"starting_point_total_months",
	"difference_months",
	"Exclusion",
}
COURIER_STOREKEEPER_ROLE = "Courier / Storekeeper"
SEVERE_PRIMARY_ROLES = (
	"Actual trafficker",
	"Manager / Organiser",
	"Operator / Financial controller",
)
PRIMARY_ROLES = (COURIER_STOREKEEPER_ROLE, *SEVERE_PRIMARY_ROLES)
SUPPLEMENTARY_CIRCUMSTANCES = (
	"Cross-border trafficking",
	"Divan keeping",
	"Manufacturing",
)


def normalize_key_text(value: Any) -> str:
	if value is None or pd.isna(value):
		return ""
	return re.sub(r"\s+", " ", str(value).strip()).lower()


def trial_catalogue_key(
	neutral_citation: Any,
	trial_index: Any,
	charge_no: Any,
	defendant_id: Any,
) -> str:
	return "|".join((
		normalize_key_text(neutral_citation),
		normalize_key_text(trial_index),
		normalize_key_text(charge_no),
		normalize_key_text(defendant_id),
	))


def trial_catalogue_fallback_key(
	neutral_citation: Any,
	charge_no: Any,
	defendant_id: Any,
) -> str:
	return "|".join((
		normalize_key_text(neutral_citation),
		normalize_key_text(charge_no),
		normalize_key_text(defendant_id),
	))


def normalize_primary_role(value: Any) -> str | None:
	role_map = {
		"courier / storekeeper": COURIER_STOREKEEPER_ROLE,
		"courier/storekeeper": COURIER_STOREKEEPER_ROLE,
		"actual trafficker": "Actual trafficker",
		"manager / organiser": "Manager / Organiser",
		"manager/organiser": "Manager / Organiser",
		"operator / financial controller": "Operator / Financial controller",
		"operator/financial controller": "Operator / Financial controller",
	}
	return role_map.get(normalize_key_text(value))


def normalize_circumstance(value: Any) -> str | None:
	circumstance_map = {
		"cross-border trafficking": "Cross-border trafficking",
		"divan keeping": "Divan keeping",
		"manufacturing": "Manufacturing",
	}
	return circumstance_map.get(normalize_key_text(value))


def normalize_circumstances(values: Any) -> list[str]:
	if not isinstance(values, list):
		return []
	return list(dict.fromkeys(
		circumstance
		for circumstance in (normalize_circumstance(value) for value in values)
		if circumstance is not None
	))


def load_role_catalogue(notebook_dir: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
	workbook_path = notebook_dir / ROLE_WORKBOOK_FILENAME
	if not workbook_path.exists():
		raise RuntimeError(f"Role workbook is missing: {workbook_path}")
	workbook = pd.ExcelFile(workbook_path)
	if not workbook.sheet_names:
		raise RuntimeError("Role workbook does not contain a worksheet")
	sheet_name = workbook.sheet_names[0]
	catalogue = pd.read_excel(workbook_path, sheet_name=sheet_name)
	missing_columns = sorted(ROLE_WORKBOOK_COLUMNS - set(catalogue.columns))
	if missing_columns:
		raise RuntimeError(f"Role workbook is missing required columns: {', '.join(missing_columns)}")
	catalogue = catalogue.copy()
	catalogue["role_catalogue_key"] = catalogue.apply(
		lambda row: trial_catalogue_key(
			row["neutral_citation"],
			row["trial_index"],
			row["Charge_no"],
			row["Defendant_id"],
		),
		axis=1,
	)
	catalogue["role_catalogue_fallback_key"] = catalogue.apply(
		lambda row: trial_catalogue_fallback_key(
			row["neutral_citation"],
			row["Charge_no"],
			row["Defendant_id"],
		),
		axis=1,
	)
	if (catalogue["role_catalogue_key"] == "|||").any():
		raise RuntimeError("Role workbook contains a row without a complete trial key")
	if catalogue["role_catalogue_key"].duplicated().any():
		raise RuntimeError("Role workbook contains duplicate trial keys")
	catalogue["workbook_excluded"] = pd.to_numeric(
		catalogue["Exclusion"], errors="coerce"
	).fillna(0).eq(1)
	catalogue["workbook_primary_role"] = catalogue["Defendant Role"].map(normalize_primary_role)
	catalogue["workbook_circumstances"] = catalogue["Additional Circumstances"].map(
		normalize_circumstance
	).map(lambda value: [] if value is None else [value])
	catalogue["workbook_starting_point_months"] = pd.to_numeric(
		catalogue["starting_point_total_months"], errors="coerce"
	)
	catalogue["workbook_difference_months"] = pd.to_numeric(
		catalogue["difference_months"], errors="coerce"
	)
	catalogue["workbook_effect_fraction"] = np.where(
		catalogue["workbook_starting_point_months"] > 0,
		catalogue["workbook_difference_months"] / catalogue["workbook_starting_point_months"],
		np.nan,
	)
	return catalogue[[
		"role_catalogue_key",
		"role_catalogue_fallback_key",
		"workbook_excluded",
		"workbook_primary_role",
		"workbook_circumstances",
		"workbook_starting_point_months",
		"workbook_difference_months",
		"workbook_effect_fraction",
	]], {
		"filename": workbook_path.name,
		"sheet_name": sheet_name,
		"row_count": len(catalogue),
		"modified_at": pd.Timestamp(workbook_path.stat().st_mtime, unit="s", tz="UTC").isoformat(),
	}


def attach_role_catalogue(
	trials: pd.DataFrame,
	notebook_dir: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any]]:
	catalogue, provenance = load_role_catalogue(notebook_dir)
	trials = trials.copy()
	trials["role_catalogue_key"] = trials.apply(
		lambda row: trial_catalogue_key(
			row["neutral_citation"],
			row["trial_index"],
			row["charge_no"],
			row["defendant_id"],
		),
		axis=1,
	)
	trials["role_catalogue_fallback_key"] = trials.apply(
		lambda row: trial_catalogue_fallback_key(
			row["neutral_citation"],
			row["charge_no"],
			row["defendant_id"],
		),
		axis=1,
	)
	trial_keys = set(trials["role_catalogue_key"])
	catalogue["matched_trial"] = catalogue["role_catalogue_key"].isin(trial_keys)
	catalogue["matched_trial_key"] = catalogue["role_catalogue_key"].where(
		catalogue["matched_trial"],
		None,
	)
	catalogue["match_method"] = np.where(catalogue["matched_trial"], "exact", "unmatched")
	exact_matched_trial_keys = set(catalogue.loc[catalogue["matched_trial"], "matched_trial_key"])
	fallback_candidates = trials.groupby("role_catalogue_fallback_key")["role_catalogue_key"].agg(
		lambda values: set(values)
	)
	unmatched_excluded = catalogue.loc[
		catalogue["workbook_excluded"] & ~catalogue["matched_trial"]
	].copy()
	unmatched_by_fallback_key = unmatched_excluded["role_catalogue_fallback_key"].value_counts()
	fallback_matches = 0
	for row_index, row in unmatched_excluded.iterrows():
		candidate_trial_keys = fallback_candidates.get(row["role_catalogue_fallback_key"], set())
		if (
			len(candidate_trial_keys) == 1
			and unmatched_by_fallback_key[row["role_catalogue_fallback_key"]] == 1
			and not candidate_trial_keys.intersection(exact_matched_trial_keys)
		):
			catalogue.loc[row_index, "matched_trial"] = True
			catalogue.loc[row_index, "matched_trial_key"] = next(iter(candidate_trial_keys))
			catalogue.loc[row_index, "match_method"] = "citation-charge-defendant fallback"
			fallback_matches += 1
	unmatched_excluded = catalogue.loc[
		catalogue["workbook_excluded"] & ~catalogue["matched_trial"]
	]
	if fallback_matches:
		warnings.warn(
			"Role-workbook reconciliation used a citation/charge/defendant fallback for "
			f"{fallback_matches} excluded row(s) with a trial-index mismatch.",
			RuntimeWarning,
			stacklevel=2,
		)
	if len(unmatched_excluded):
		warnings.warn(
			"Excluded role-workbook rows could not be matched and will not be removed: "
			+ " | ".join(unmatched_excluded["role_catalogue_key"]),
			RuntimeWarning,
			stacklevel=2,
		)
	catalogue_labels = catalogue.loc[
		catalogue["matched_trial"],
		[
			"matched_trial_key",
			"workbook_excluded",
			"workbook_primary_role",
			"workbook_circumstances",
			"workbook_starting_point_months",
			"workbook_difference_months",
			"workbook_effect_fraction",
		],
	].copy()
	trials = trials.merge(
		catalogue_labels,
		left_on="role_catalogue_key",
		right_on="matched_trial_key",
		how="left",
		validate="many_to_one",
	).drop(columns="matched_trial_key")
	trials["workbook_excluded"] = trials["workbook_excluded"].map(
		lambda value: bool(value) if pd.notna(value) else False
	)
	trials["workbook_circumstances"] = trials["workbook_circumstances"].map(
		lambda value: value if isinstance(value, list) else []
	)
	trials["verified_primary_role"] = trials["sentencing_role"].map(
		lambda profile: normalize_primary_role(profile.get("primary_role"))
		if isinstance(profile, dict)
		else None
	)
	trials["verified_circumstances"] = trials["sentencing_role"].map(
		lambda profile: normalize_circumstances(profile.get("additional_circumstances"))
		if isinstance(profile, dict)
		else []
	)
	trials["has_verified_sentencing_role"] = trials["sentencing_role"].map(
		lambda profile: isinstance(profile, dict)
	)
	trials["selected_primary_role"] = trials.apply(
		lambda row: (
			row["verified_primary_role"]
			if row["has_verified_sentencing_role"]
			else row["workbook_primary_role"]
		)
		if isinstance(
			row["verified_primary_role"]
			if row["has_verified_sentencing_role"]
			else row["workbook_primary_role"],
			str,
		)
		else None,
		axis=1,
	)
	trials["selected_circumstances"] = trials.apply(
		lambda row: row["verified_circumstances"]
		if row["has_verified_sentencing_role"]
		else row["workbook_circumstances"],
		axis=1,
	)
	trials["role_selection_source"] = np.select(
		[
			trials["has_verified_sentencing_role"],
			trials["workbook_primary_role"].notna() | trials["workbook_circumstances"].map(bool),
		],
		["verified", "workbook"],
		default="none",
	)
	provenance.update({
		"reconciliation_status": "warning" if fallback_matches or len(unmatched_excluded) else "matched",
		"exact_matched_workbook_rows": int((catalogue["match_method"] == "exact").sum()),
		"fallback_matched_excluded_rows": fallback_matches,
		"unmatched_excluded_row_count": len(unmatched_excluded),
		"unmatched_excluded_keys": unmatched_excluded["role_catalogue_key"].tolist(),
	})
	reconciliation = pd.DataFrame([
		{"scope": "workbook rows", "count": len(catalogue)},
		{"scope": "matched workbook rows", "count": int(catalogue["matched_trial"].sum())},
		{"scope": "exact matched workbook rows", "count": int((catalogue["match_method"] == "exact").sum())},
		{"scope": "fallback-matched excluded workbook rows", "count": fallback_matches},
		{"scope": "unmatched workbook rows", "count": int((~catalogue["matched_trial"]).sum())},
		{"scope": "excluded workbook rows", "count": int(catalogue["workbook_excluded"].sum())},
		{
			"scope": "matched excluded workbook rows",
			"count": int((catalogue["workbook_excluded"] & catalogue["matched_trial"]).sum()),
		},
		{"scope": "unmatched excluded workbook rows", "count": len(unmatched_excluded)},
	])
	return trials, reconciliation, provenance


def selected_role_effect_fraction(row: pd.Series) -> float:
	if row["role_selection_source"] == "workbook" and pd.notna(row["workbook_effect_fraction"]):
		return float(row["workbook_effect_fraction"])
	if (
		row["role_selection_source"] == "verified"
		and pd.notna(row["starting_point_months"])
		and pd.notna(row["sentence_after_role_months"])
		and row["starting_point_months"] > 0
		and not row["starting_point_inferred"]
		and not row["sentence_after_role_inferred"]
	):
		return float(
			(row["sentence_after_role_months"] - row["starting_point_months"])
			/ row["starting_point_months"]
		)
	return np.nan


def remove_workbook_exclusions(
	trials: pd.DataFrame,
	effects: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, set[str]]:
	excluded_trial_keys = set(
		trials.loc[trials["workbook_excluded"], "role_catalogue_key"]
	)
	filtered_trials = trials.loc[~trials["role_catalogue_key"].isin(excluded_trial_keys)].copy()
	filtered_effects = effects.loc[
		~effects["role_catalogue_key"].isin(excluded_trial_keys)
	].copy()
	return filtered_trials, filtered_effects, excluded_trial_keys


def general_stage_data(
	trials: pd.DataFrame,
	effects: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, set[str]]:
	source_excluded_trial_keys = set(
		trials.loc[trials["source_document_excluded"], "role_catalogue_key"]
	)
	general_trials = trials.loc[~trials["source_document_excluded"]].copy()
	general_effects = effects.loc[
		~effects["role_catalogue_key"].isin(source_excluded_trial_keys)
	].copy()
	return general_trials, general_effects, source_excluded_trial_keys


def build_role_effects(training_trials: pd.DataFrame) -> tuple[dict[str, Any], pd.DataFrame]:
	direct = training_trials.copy()
	direct["role_effect_fraction"] = direct.apply(selected_role_effect_fraction, axis=1)
	direct = direct.loc[
		direct["role_selection_source"].ne("none")
		& direct["role_effect_fraction"].notna()
	].copy()
	rows: list[dict[str, Any]] = []
	primary_effects: dict[str, float] = {COURIER_STOREKEEPER_ROLE: 0.0}
	rows.append({
		"component": "primary role",
		"name": COURIER_STOREKEEPER_ROLE,
		"support_trials": 0,
		"effect_fraction": 0.0,
		"status": "fixed zero",
	})
	for role in SEVERE_PRIMARY_ROLES:
		group = direct.loc[
			(direct["selected_primary_role"] == role)
			& direct["selected_circumstances"].map(lambda values: len(values) == 0)
		]
		effect = group["role_effect_fraction"].median() if len(group) else np.nan
		if pd.notna(effect):
			primary_effects[role] = float(effect)
		rows.append({
			"component": "primary role",
			"name": role,
			"support_trials": len(group),
			"effect_fraction": effect,
			"status": "supported" if pd.notna(effect) else "unsupported",
		})
	circumstance_effects: dict[str, float] = {}
	for circumstance in ("Divan keeping", "Manufacturing"):
		group = direct.loc[
			direct["selected_circumstances"].map(lambda values: circumstance in values)
		]
		effect = group["role_effect_fraction"].median() if len(group) else np.nan
		if pd.notna(effect):
			circumstance_effects[circumstance] = float(effect)
		rows.append({
			"component": "supplementary circumstance",
			"name": circumstance,
			"support_trials": len(group),
			"effect_fraction": effect,
			"status": "supported" if pd.notna(effect) else "unsupported",
		})
	cross_border_group = direct.loc[
		direct["selected_primary_role"].isin(SEVERE_PRIMARY_ROLES)
		& direct["selected_circumstances"].map(
			lambda values: "Cross-border trafficking" in values
		)
	]
	cross_border_effect = (
		cross_border_group["role_effect_fraction"].median()
		if len(cross_border_group)
		else np.nan
	)
	rows.append({
		"component": "severe-role cross-border circumstance",
		"name": "Cross-border trafficking",
		"support_trials": len(cross_border_group),
		"effect_fraction": cross_border_effect,
		"status": "supported" if pd.notna(cross_border_effect) else "unsupported",
	})
	return {
		"primary_effects": primary_effects,
		"circumstance_effects": circumstance_effects,
		"severe_cross_border_effect": (
			float(cross_border_effect) if pd.notna(cross_border_effect) else None
		),
		"courier_cross_border_strategy": "aggravation:Cross-border trafficking",
	}, pd.DataFrame(rows)


def role_profile_prediction(
	primary_role: str | None,
	circumstances: list[str],
	starting_point: float,
	role_effects: dict[str, Any],
) -> tuple[float, str, bool]:
	if primary_role is None and not circumstances:
		return 0.0, "no role profile", False
	effect = 0.0
	statuses: list[str] = []
	if primary_role is not None:
		primary_effect = role_effects["primary_effects"].get(primary_role)
		if primary_effect is None:
			statuses.append(f"unsupported primary role: {primary_role}")
		else:
			effect += float(primary_effect)
			statuses.append("primary role supported")
	for circumstance in circumstances:
		if circumstance == "Cross-border trafficking":
			if primary_role == COURIER_STOREKEEPER_ROLE:
				statuses.append("cross-border uses Import/Export effect")
			elif primary_role in SEVERE_PRIMARY_ROLES:
				cross_border_effect = role_effects.get("severe_cross_border_effect")
				if cross_border_effect is None:
					statuses.append("unsupported severe-role cross-border effect")
				else:
					effect += float(cross_border_effect)
					statuses.append("severe-role cross-border supported")
			else:
				statuses.append("unsupported cross-border primary role")
			continue
		circumstance_effect = role_effects["circumstance_effects"].get(circumstance)
		if circumstance_effect is None:
			statuses.append(f"unsupported circumstance: {circumstance}")
		else:
			effect += float(circumstance_effect)
			statuses.append(f"{circumstance} supported")
	return starting_point * effect, " | ".join(statuses), (
		primary_role == COURIER_STOREKEEPER_ROLE
		and "Cross-border trafficking" in circumstances
	)


def role_aware_aggravating_factors(
	factors: list[str],
	primary_role: str | None,
	circumstances: list[str],
) -> list[str]:
	if "Cross-border trafficking" not in circumstances:
		return list(dict.fromkeys(factors))
	if primary_role == COURIER_STOREKEEPER_ROLE:
		return list(dict.fromkeys([*factors, "Cross-border trafficking"]))
	if primary_role in SEVERE_PRIMARY_ROLES:
		return [factor for factor in dict.fromkeys(factors) if factor != "Cross-border trafficking"]
	return list(dict.fromkeys(factors))


def get_notebook_dir() -> Path:
	candidate = Path.cwd().resolve()
	if (candidate / "linear_interpolation_analysis.ipynb").exists():
		return candidate
	return candidate / "notebooks"


def total_months(detail: dict[str, Any] | None) -> float | None:
	if not detail:
		return None
	if detail.get("total_months") is not None:
		return float(detail["total_months"])
	years = detail.get("sentence_years")
	months = detail.get("sentence_months")
	if years is None and months is None:
		return None
	return float(years or 0) * 12 + float(months or 0)


def is_inferred(detail: dict[str, Any] | None) -> bool:
	if not detail:
		return False
	return bool(detail.get("inferred")) or detail.get("source") == INFERRED_ROLE_SOURCE


def canonical_factor(name: str | None) -> str | None:
	if not name:
		return None
	return CANONICAL_FACTOR_MAP.get(name, name)


def unique_canonical_factors(factors: list[dict[str, Any]] | None) -> list[str]:
	return list(
		dict.fromkeys(
			factor_name
			for factor_name in (canonical_factor(item.get("factor")) for item in (factors or []))
			if factor_name
		)
	)


def clean_quantity(value: Any) -> tuple[float, bool]:
	try:
		quantity = float(value)
	except (TypeError, ValueError):
		return 0.0, True
	if not math.isfinite(quantity) or quantity < 0:
		return 0.0, True
	return quantity, False


def direct_plea_reduction(plea: dict[str, Any], incoming_months: float | None) -> float | None:
	if not plea.get("pleaded_guilty") or is_inferred(plea):
		return None
	years = plea.get("reduction_years")
	months = plea.get("reduction_months")
	if years is not None or months is not None:
		return float(years or 0) * 12 + float(months or 0)
	percentage = plea.get("reduction_percentage")
	if percentage is not None and incoming_months is not None:
		return incoming_months * float(percentage) / 100
	return None


def load_documents(notebook_dir: Path, refresh_cache: bool) -> tuple[list[dict[str, Any]], dict[str, Any]]:
	cache_dir = notebook_dir / ".cache"
	cache_path = cache_dir / "stage_model_analysis_verified_features.json"
	metadata_path = cache_dir / "stage_model_analysis_verified_features.metadata.json"
	if cache_path.exists() and not refresh_cache:
		metadata = json.loads(metadata_path.read_text()) if metadata_path.exists() else {}
		return json.loads(cache_path.read_text()), metadata

	repo_root = notebook_dir.parent
	for env_path in (
		repo_root / "featureExtraction" / ".env",
		repo_root / "featureVerification" / ".env.local",
		repo_root / ".env",
	):
		if env_path.exists():
			load_dotenv(env_path)
	mongo_uri = os.getenv("DB_MONGODB_URI")
	if not mongo_uri:
		raise RuntimeError("DB_MONGODB_URI is required when the shared cache is missing or refresh_cache is True")
	query = {"is_verified": True}
	projection = {
		"source_judgement_id": 1,
		"filename": 1,
		"exclude": 1,
		"judgement.neutral_citation": 1,
		"trials": 1,
	}
	client = MongoClient(mongo_uri)
	database = client.get_database(os.getenv("DB_NAME", "drug-sentencing-predictor"))
	documents = list(database.get_collection("verified-features").find(query, projection))
	cache_dir.mkdir(parents=True, exist_ok=True)
	temporary_path = cache_path.with_suffix(".tmp")
	temporary_path.write_text(json.dumps(documents, default=str))
	temporary_path.replace(cache_path)
	metadata = {
		"created_at": pd.Timestamp.now(tz="UTC").isoformat(),
		"document_count": len(documents),
		"source_excluded_document_count": sum(document.get("exclude") is True for document in documents),
		"source_excluded_documents_included_for_trial_reconciliation": True,
		"source_excluded_documents_used_for_role_fitting": True,
		"source_excluded_documents_used_for_non_role_stages": False,
		"query": query,
		"projection_fields": sorted(projection),
	}
	metadata_path.write_text(json.dumps(metadata, indent=2))
	return documents, metadata


def flatten_documents(documents: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.DataFrame]:
	trial_rows: list[dict[str, Any]] = []
	effect_rows: list[dict[str, Any]] = []
	for document in documents:
		judgement = document.get("judgement") or {}
		citation = judgement.get("neutral_citation") or document.get("filename")
		case_id = str(citation or document.get("source_judgement_id") or document.get("_id"))
		source_document_excluded = document.get("exclude") is True
		for trial_index, trial in enumerate((document.get("trials") or {}).get("trials") or []):
			charge = trial.get("charge_type") or {}
			drugs = trial.get("drugs") or []
			aggravating = trial.get("aggravating_factors") or []
			mitigating = trial.get("mitigating_factors") or []
			plea = trial.get("guilty_plea") or {}
			starting_detail = trial.get("starting_point")
			after_role_detail = trial.get("sentence_after_role")
			notional_detail = trial.get("notional_sentence")
			mitigation_detail = trial.get("mitigation_reduction")
			final_detail = trial.get("final_sentence")
			starting = total_months(starting_detail)
			after_role = total_months(after_role_detail)
			notional = total_months(notional_detail)
			mitigation_reduction = (
				float(mitigation_detail["reduction_months"])
				if mitigation_detail and mitigation_detail.get("reduction_months") is not None
				else None
			)
			pre_plea = notional - (mitigation_reduction or 0) if notional is not None else None
			final = total_months(final_detail)
			drug_amounts: dict[str, float] = {}
			invalid_quantities: list[str] = []
			for drug in drugs:
				drug_type = drug.get("drug_type")
				if not drug_type:
					continue
				quantity, invalid = clean_quantity(drug.get("quantity"))
				if invalid:
					invalid_quantities.append(f"{drug_type}:{drug.get('quantity')}")
				drug_amounts[drug_type] = drug_amounts.get(drug_type, 0.0) + quantity
			canonical_aggravating = unique_canonical_factors(aggravating)
			canonical_mitigating = unique_canonical_factors(mitigating)
			role_catalogue_key = trial_catalogue_key(
				citation,
				trial_index,
				charge.get("charge_no"),
				charge.get("defendant_id"),
			)
			row = {
				"case_id": case_id,
				"neutral_citation": citation,
				"source_judgement_id": str(document.get("source_judgement_id") or ""),
				"source_document_excluded": source_document_excluded,
				"filename": document.get("filename"),
				"trial_index": trial_index,
				"charge_no": charge.get("charge_no"),
				"defendant_id": charge.get("defendant_id"),
				"defendant_name": charge.get("defendant_name"),
				"role_catalogue_key": role_catalogue_key,
				"drugs_json": json.dumps(drugs, default=str),
				"aggravating_factors_json": json.dumps(aggravating, default=str),
				"mitigating_factors_json": json.dumps(mitigating, default=str),
				"drug_amounts": drug_amounts,
				"invalid_drug_quantities": " | ".join(invalid_quantities),
				"canonical_aggravating_factors": canonical_aggravating,
				"canonical_mitigating_factors": canonical_mitigating,
				"sentencing_role": trial.get("sentencing_role"),
				"role_factors": [name for name in canonical_aggravating if name == "Role of the defendant"],
				"other_aggravating_factors": [
					name for name in canonical_aggravating if name != "Role of the defendant"
				],
				"guilty_plea_json": json.dumps(plea, default=str),
				"starting_point_months": starting,
				"starting_point_source": (starting_detail or {}).get("source"),
				"starting_point_inferred": is_inferred(starting_detail),
				"sentence_after_role_months": after_role,
				"sentence_after_role_source": (after_role_detail or {}).get("source"),
				"sentence_after_role_inferred": is_inferred(after_role_detail),
				"notional_sentence_months": notional,
				"notional_sentence_source": (notional_detail or {}).get("source"),
				"notional_sentence_inferred": is_inferred(notional_detail),
				"mitigation_reduction_months": mitigation_reduction,
				"mitigation_reduction_source": (mitigation_detail or {}).get("source"),
				"mitigation_reduction_inferred": is_inferred(mitigation_detail),
				"pre_plea_months": pre_plea,
				"final_sentence_months": final,
				"final_sentence_source": (final_detail or {}).get("source"),
				"final_sentence_inferred": is_inferred(final_detail),
				"guilty_plea_source": plea.get("source"),
				"guilty_plea_inferred": is_inferred(plea),
			}
			trial_rows.append(row)
			for factor in aggravating:
				canonical = canonical_factor(factor.get("factor"))
				if canonical == "Role of the defendant":
					continue
				adjustment = factor.get("enhancement_months")
				stage = "aggravation"
				base = starting
				if adjustment is not None and canonical and base and base > 0 and not is_inferred(factor):
					effect_rows.append({
						"case_id": case_id,
						"role_catalogue_key": role_catalogue_key,
						"stage": stage,
						"canonical_factor": canonical,
						"adjustment_months": float(adjustment),
						"base_months": float(base),
						"effect_fraction": float(adjustment) / float(base),
					})
			for factor in mitigating:
				canonical = canonical_factor(factor.get("factor"))
				adjustment = factor.get("reduction_months")
				if adjustment is not None and canonical and notional and notional > 0 and not is_inferred(factor):
					effect_rows.append({
						"case_id": case_id,
						"role_catalogue_key": role_catalogue_key,
						"stage": "mitigation",
						"canonical_factor": canonical,
						"adjustment_months": float(adjustment),
						"base_months": float(notional),
						"effect_fraction": float(adjustment) / float(notional),
					})
			plea_adjustment = direct_plea_reduction(plea, pre_plea)
			plea_stage = plea.get("high_court_stage") or plea.get("district_court_stage") or "Unknown"
			if plea_adjustment is not None and pre_plea and pre_plea > 0:
				effect_rows.append({
					"case_id": case_id,
					"role_catalogue_key": role_catalogue_key,
					"stage": "plea",
					"canonical_factor": f"Guilty plea: {plea_stage}",
					"adjustment_months": plea_adjustment,
					"base_months": float(pre_plea),
					"effect_fraction": plea_adjustment / float(pre_plea),
				})
	effect_columns = [
		"case_id",
		"role_catalogue_key",
		"stage",
		"canonical_factor",
		"adjustment_months",
		"base_months",
		"effect_fraction",
	]
	return pd.DataFrame(trial_rows), pd.DataFrame(effect_rows, columns=effect_columns)


def assign_partition(trials: pd.DataFrame, notebook_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
	split_path = notebook_dir / "stage_model_analysis.xlsx"
	if split_path.exists():
		split_membership = pd.read_excel(split_path, sheet_name="split membership")
		split_membership["case_id"] = split_membership["case_id"].astype(str)
		split_membership = split_membership[["case_id", "partition"]].drop_duplicates()
		known_cases = set(split_membership["case_id"])
		missing_cases = set(trials["case_id"]) - known_cases
		if missing_cases:
			missing_case_ids = np.array(sorted(missing_cases))
			generator = np.random.default_rng(RANDOM_SEED)
			generator.shuffle(missing_case_ids)
			test_case_ids = set(missing_case_ids[:math.ceil(len(missing_case_ids) * TEST_SIZE)])
			missing_membership = pd.DataFrame({
				"case_id": missing_case_ids,
				"partition": [
					"test" if case_id in test_case_ids else "train"
					for case_id in missing_case_ids
				],
			})
			split_membership = pd.concat(
				[split_membership, missing_membership],
				ignore_index=True,
			)
	else:
		case_ids = np.array(sorted(trials["case_id"].unique()))
		generator = np.random.default_rng(RANDOM_SEED)
		generator.shuffle(case_ids)
		test_count = math.ceil(len(case_ids) * TEST_SIZE)
		test_case_ids = set(case_ids[:test_count])
		split_membership = pd.DataFrame({
			"case_id": case_ids,
			"partition": ["test" if case_id in test_case_ids else "train" for case_id in case_ids],
		})
	trials = trials.merge(split_membership, on="case_id", how="left", validate="many_to_one")
	if trials["partition"].isna().any():
		raise RuntimeError("Every trial must belong to exactly one split partition")
	train_cases = set(trials.loc[trials["partition"] == "train", "case_id"])
	test_cases = set(trials.loc[trials["partition"] == "test", "case_id"])
	assert train_cases.isdisjoint(test_cases)
	return trials, split_membership


def build_curve(drug_type: str, training_rows: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any]]:
	training_trials = len(training_rows)
	training_judgments = training_rows["case_id"].nunique()
	if len(training_rows) < MIN_CURVE_SUPPORT:
		return pd.DataFrame(), {
			"drug_type": drug_type,
			"supported": False,
			"reason": "fewer than 10 training trials",
			"training_trials": training_trials,
			"training_judgments": training_judgments,
		}
	quantities = training_rows["single_drug_quantity"].to_numpy(dtype=float)
	boundaries = np.unique(np.quantile(quantities, QUANTILES))
	if len(boundaries) < 2:
		return pd.DataFrame(), {
			"drug_type": drug_type,
			"supported": False,
			"reason": "fewer than two distinct quantity values",
			"training_trials": training_trials,
			"training_judgments": training_judgments,
		}
	bin_index = np.searchsorted(boundaries[1:-1], quantities, side="right")
	binned = training_rows.assign(curve_bin=bin_index).groupby("curve_bin", as_index=False).agg(
		quantity_grams=("single_drug_quantity", "median"),
		raw_months=("starting_point_months", "median"),
		training_trials=("case_id", "size"),
		training_judgments=("case_id", "nunique"),
		training_citations=("case_id", lambda values: " | ".join(sorted(set(map(str, values))))),
	)
	knots = binned.groupby("quantity_grams", as_index=False).agg(
		raw_months=("raw_months", "median"),
		training_trials=("training_trials", "sum"),
		training_judgments=("training_judgments", "sum"),
		training_citations=("training_citations", lambda values: " | ".join(sorted(set(" | ".join(values).split(" | "))))),
	).sort_values("quantity_grams").reset_index(drop=True)
	knots["interpolated_months"] = np.maximum.accumulate(knots["raw_months"].to_numpy(dtype=float))
	knots["drug_type"] = drug_type
	knots["curve_source"] = "training single-drug quantile bins"
	assert knots["interpolated_months"].is_monotonic_increasing
	return knots, {
		"drug_type": drug_type,
		"supported": True,
		"reason": None,
		"training_trials": training_trials,
		"training_judgments": training_judgments,
	}


def interpolate_curve(quantity: float, knots: pd.DataFrame) -> float:
	x = knots["quantity_grams"].to_numpy(dtype=float)
	y = knots["interpolated_months"].to_numpy(dtype=float)
	return float(np.interp(quantity, x, y))


def starting_point_from_legacy_weighted_total(
	drug_amounts: dict[str, float], curves: dict[str, pd.DataFrame]
) -> tuple[float | None, str, list[str]]:
	positive_amounts = {drug: amount for drug, amount in drug_amounts.items() if amount > 0}
	if not positive_amounts:
		return None, "no positive drug quantity", []
	unsupported = sorted(drug for drug in positive_amounts if drug not in curves)
	if unsupported:
		return None, "unsupported drug curve", unsupported
	total_amount = sum(positive_amounts.values())
	weighted_months = sum(
		interpolate_curve(total_amount, curves[drug_type]) * quantity
		for drug_type, quantity in positive_amounts.items()
	)
	return weighted_months / total_amount, "supported", []


def learn_factor_effects(training_effects: pd.DataFrame) -> pd.DataFrame:
	rows: list[dict[str, Any]] = []
	for (stage, factor), group in training_effects.groupby(["stage", "canonical_factor"]):
		rows.append({
			"stage": stage,
			"canonical_factor": factor,
			"support_trials": len(group),
			"support_judgments": group["case_id"].nunique(),
			"supported": len(group) >= MIN_FACTOR_SUPPORT,
			"median_effect_fraction": group["effect_fraction"].median(),
			"median_adjustment_months": group["adjustment_months"].median(),
		})
	return pd.DataFrame(rows, columns=[
		"stage",
		"canonical_factor",
		"support_trials",
		"support_judgments",
		"supported",
		"median_effect_fraction",
		"median_adjustment_months",
	]).sort_values(["stage", "canonical_factor"]).reset_index(drop=True)


def stage_effect(factors: list[str], stage: str, base_months: float, supported_effects: dict[tuple[str, str], float]) -> float:
	return sum(base_months * supported_effects.get((stage, factor), 0.0) for factor in dict.fromkeys(factors))


def factor_status(factors: list[str], stage: str, supported_effects: dict[tuple[str, str], float]) -> str:
	if not factors:
		return "no factors"
	unsupported = [factor for factor in dict.fromkeys(factors) if (stage, factor) not in supported_effects]
	if unsupported:
		return f"unsupported factors: {' | '.join(unsupported)}"
	return "supported"


def legacy_percentage_prediction(row: pd.Series) -> dict[str, Any]:
	"""Apply legacy percentages in the new model's stage order for a fair comparison."""
	starting = row["predicted_starting_point_months"]
	if pd.isna(starting):
		return {
			"legacy_percentage_factor_status": "starting point unavailable",
			"legacy_percentage_compatible": False,
			"legacy_percentage_sentence_after_role_months": np.nan,
			"legacy_percentage_notional_sentence_months": np.nan,
			"legacy_percentage_mitigation_reduction_months": np.nan,
			"legacy_percentage_final_sentence_months": np.nan,
		}
	aggravating_factors = row["other_aggravating_factors"]
	mitigating_factors = row["canonical_mitigating_factors"]
	plea_factors = plea_factor(row["guilty_plea_json"])
	unsupported = [
		f"{stage}: {factor}"
		for stage, factors in (
			("aggravation", aggravating_factors),
			("mitigation", mitigating_factors),
			("plea", plea_factors),
		)
		for factor in dict.fromkeys(factors)
		if factor not in LEGACY_PERCENTAGE_EFFECTS[stage]
	]
	role = 0.0
	after_role = max(0.0, starting + role)
	legacy_effects = {
		(stage, factor): effect
		for stage, effects in LEGACY_PERCENTAGE_EFFECTS.items()
		for factor, effect in effects.items()
	}
	aggravation = stage_effect(aggravating_factors, "aggravation", after_role, legacy_effects)
	notional = max(0.0, after_role + aggravation)
	mitigation = min(notional, max(0.0, stage_effect(mitigating_factors, "mitigation", notional, legacy_effects)))
	pre_plea = max(0.0, notional - mitigation)
	plea = min(pre_plea, max(0.0, stage_effect(plea_factors, "plea", pre_plea, legacy_effects)))
	return {
		"legacy_percentage_factor_status": "supported" if not unsupported else f"unsupported factors: {' | '.join(unsupported)}",
		"legacy_percentage_compatible": not unsupported,
		"legacy_percentage_sentence_after_role_months": after_role,
		"legacy_percentage_notional_sentence_months": notional,
		"legacy_percentage_mitigation_reduction_months": mitigation,
		"legacy_percentage_final_sentence_months": max(0.0, pre_plea - plea),
	}


def plea_factor(plea_json: str) -> list[str]:
	plea = json.loads(plea_json)
	if not plea.get("pleaded_guilty"):
		return []
	stage = plea.get("high_court_stage") or plea.get("district_court_stage") or "Unknown"
	return [f"Guilty plea: {stage}"]


def build_metrics(predictions: pd.DataFrame) -> pd.DataFrame:
	metrics: list[dict[str, Any]] = []
	for stage, actual, predicted in (
		("Starting point", "starting_point_months", "predicted_starting_point_months"),
		("Sentence after role", "sentence_after_role_months", "predicted_sentence_after_role_months"),
		("Notional sentence", "notional_sentence_months", "predicted_notional_sentence_months"),
		("Non-plea mitigation reduction", "mitigation_reduction_months", "predicted_mitigation_reduction_months"),
		("Final sentence", "final_sentence_months", "predicted_final_sentence_months"),
	):
		eligible = predictions[[actual, predicted]].dropna()
		accuracy_eligible = eligible.loc[eligible[actual] > 0].copy()
		if len(accuracy_eligible):
			case_accuracy = np.maximum(
				1 - (accuracy_eligible[actual] - accuracy_eligible[predicted]).abs() / accuracy_eligible[actual],
				0,
			)
			mean_case_accuracy = case_accuracy.mean()
		else:
			mean_case_accuracy = np.nan
		metrics.append({
			"stage": stage,
			"all_test_trials": len(predictions),
			"covered_test_trials": len(eligible),
			"coverage_rate": len(eligible) / len(predictions) if len(predictions) else np.nan,
			"mae_months": (eligible[actual] - eligible[predicted]).abs().mean() if len(eligible) else np.nan,
			"median_absolute_error_months": (eligible[actual] - eligible[predicted]).abs().median() if len(eligible) else np.nan,
			"accuracy_eligible_test_trials": len(accuracy_eligible),
			"mean_case_accuracy": mean_case_accuracy,
			"mean_case_accuracy_percent": mean_case_accuracy * 100,
		})
	return pd.DataFrame(metrics)


def build_factor_percentage_error_report(
	factor_effects: pd.DataFrame,
	test_effects: pd.DataFrame,
) -> pd.DataFrame:
	"""Evaluate each direct test adjustment against its train-only percentage rule."""
	model_rows = {
		(row.stage, row.canonical_factor): row
		for row in factor_effects.itertuples(index=False)
	}
	keys = sorted(set(model_rows) | set(zip(test_effects["stage"], test_effects["canonical_factor"])))
	report_rows: list[dict[str, Any]] = []
	for stage, factor in keys:
		model_row = model_rows.get((stage, factor))
		train_support = int(model_row.support_trials) if model_row else 0
		supported = bool(model_row.supported) if model_row else False
		model_fraction = float(model_row.median_effect_fraction) if supported else 0.0
		model_months = float(model_row.median_adjustment_months) if supported else 0.0
		group = test_effects.loc[
			(test_effects["stage"] == stage)
			& (test_effects["canonical_factor"] == factor)
		].copy()
		if len(group):
			group["predicted_adjustment_months"] = group["base_months"] * model_fraction
			group["error_months"] = group["predicted_adjustment_months"] - group["adjustment_months"]
			group["error_percentage_points"] = (model_fraction - group["effect_fraction"]) * 100
			positive_adjustments = group.loc[group["adjustment_months"] > 0]
			mean_absolute_percentage_error = (
				(positive_adjustments["error_months"] / positive_adjustments["adjustment_months"]).abs().mean() * 100
				if len(positive_adjustments) else np.nan
			)
		else:
			mean_absolute_percentage_error = np.nan
		direction = "increase" if stage in {"role", "aggravation"} else "reduction"
		report_rows.append({
			"stage": stage,
			"direction": direction,
			"canonical_factor": factor,
			"model_status": "supported" if supported else "unsupported: zero contribution",
			"training_direct_adjustments": train_support,
			"model_percentage": model_fraction * 100,
			"model_median_months": model_months,
			"mean_absolute_percentage_error": mean_absolute_percentage_error,
			"mean_signed_error_months": group["error_months"].mean() if len(group) else np.nan,
			"test_direct_adjustments": len(group),
			"test_judgments": group["case_id"].nunique(),
			"actual_median_percentage": group["effect_fraction"].median() * 100 if len(group) else np.nan,
			"mae_months": group["error_months"].abs().mean() if len(group) else np.nan,
			"median_absolute_error_months": group["error_months"].abs().median() if len(group) else np.nan,
			"mae_percentage_points": group["error_percentage_points"].abs().mean() if len(group) else np.nan,
			"mean_signed_error_percentage_points": group["error_percentage_points"].mean() if len(group) else np.nan,
		})
	return pd.DataFrame(report_rows).sort_values(["stage", "canonical_factor"]).reset_index(drop=True)


def excel_safe(value: Any) -> Any:
	if isinstance(value, str):
		return EXCEL_ILLEGAL_CHARACTERS.sub("", value)
	if isinstance(value, (list, tuple, dict)):
		return EXCEL_ILLEGAL_CHARACTERS.sub("", json.dumps(value, default=str))
	return value


def write_sheet(writer: pd.ExcelWriter, dataframe: pd.DataFrame, sheet_name: str) -> None:
	safe_dataframe = dataframe.copy()
	for column in safe_dataframe:
		safe_dataframe[column] = safe_dataframe[column].map(excel_safe)
	safe_dataframe.to_excel(writer, sheet_name=sheet_name, index=False)


def write_deployment_artifact(
	notebook_dir: Path,
	cache_metadata: dict[str, Any],
	curves: dict[str, pd.DataFrame],
	factor_effects: pd.DataFrame,
	role_effects: dict[str, Any],
	role_workbook_provenance: dict[str, Any],
) -> Path:
	"""Write the static, dependency-free parameters used by the deployment predictor."""
	active_effects = factor_effects.loc[factor_effects["supported"]].copy()
	artifact = {
		"model_name": "data-derived-linear-interpolation",
		"model_version": "2026-07-19",
		"training": {
			"cache_created_at": cache_metadata.get("created_at"),
			"cache_document_count": cache_metadata.get("document_count"),
			"source_excluded_document_count": cache_metadata.get("source_excluded_document_count"),
			"source_excluded_documents_included_for_trial_reconciliation": cache_metadata.get(
				"source_excluded_documents_included_for_trial_reconciliation"
			),
			"source_excluded_documents_used_for_role_fitting": cache_metadata.get(
				"source_excluded_documents_used_for_role_fitting"
			),
			"source_excluded_documents_used_for_non_role_stages": cache_metadata.get(
				"source_excluded_documents_used_for_non_role_stages"
			),
			"random_seed": RANDOM_SEED,
			"test_size": TEST_SIZE,
			"fit_partition": "train",
			"minimum_curve_support": MIN_CURVE_SUPPORT,
			"minimum_factor_support": MIN_FACTOR_SUPPORT,
			"curve_method": "single-drug training quantile medians; cumulative-maximum monotonic interpolation",
			"mixed_drug_method": "legacy total-quantity weighted average",
			"factor_percentage_bases": {
				"aggravation": "starting point",
				"mitigation": "notional sentence",
				"plea": "pre-plea sentence",
			},
		},
		"canonical_factor_map": CANONICAL_FACTOR_MAP,
		"drug_curves": {
			drug_type: [
				[float(quantity), float(months)]
				for quantity, months in knots[["quantity_grams", "interpolated_months"]].itertuples(index=False, name=None)
			]
			for drug_type, knots in curves.items()
		},
		"factor_effects": {
			stage: {
				row.canonical_factor: float(row.median_effect_fraction)
				for row in group.itertuples(index=False)
			}
			for stage, group in active_effects.groupby("stage")
		},
		"role_effects": role_effects,
		"role_workbook": role_workbook_provenance,
		"legacy_percentage_effects": LEGACY_PERCENTAGE_EFFECTS,
		"factor_support": [
			{
				"stage": row.stage,
				"factor": row.canonical_factor,
				"support_trials": int(row.support_trials),
				"median_adjustment_months": float(row.median_adjustment_months),
			}
			for row in active_effects.itertuples(index=False)
		],
	}
	artifact_json = json.dumps(artifact, indent=2, sort_keys=True)
	artifact_path = notebook_dir / "data_derived_linear_model.json"
	artifact_path.write_text(artifact_json)
	typescript_artifact_path = (
		notebook_dir.parent
		/ "featureVerification"
		/ "src"
		/ "lib"
		/ artifact_path.name
	)
	typescript_artifact_path.parent.mkdir(parents=True, exist_ok=True)
	typescript_artifact_path.write_text(artifact_json)
	return artifact_path


def run_analysis(refresh_cache: bool = False) -> dict[str, pd.DataFrame | str]:
	notebook_dir = get_notebook_dir()
	documents, cache_metadata = load_documents(notebook_dir, refresh_cache)
	trials, effects = flatten_documents(documents)
	trials, role_reconciliation, role_workbook_provenance = attach_role_catalogue(
		trials,
		notebook_dir,
	)
	trials, effects, excluded_trial_keys = remove_workbook_exclusions(trials, effects)
	trials, split_membership = assign_partition(trials, notebook_dir)
	partition_lookup = trials[["role_catalogue_key", "case_id", "partition"]].drop_duplicates(
		"role_catalogue_key"
	)
	effects = effects.merge(
		partition_lookup[["role_catalogue_key", "partition"]],
		on="role_catalogue_key",
		how="left",
		validate="many_to_one",
	)
	assert not effects["partition"].isna().any()
	assert not trials["role_catalogue_key"].isin(excluded_trial_keys).any()
	assert not effects["role_catalogue_key"].isin(excluded_trial_keys).any()
	general_trials, general_effects, source_excluded_trial_keys = general_stage_data(
		trials,
		effects,
	)
	assert not general_trials["source_document_excluded"].any()
	assert not general_effects["role_catalogue_key"].isin(source_excluded_trial_keys).any()

	curve_candidates = general_trials.loc[
		(general_trials["partition"] == "train")
		& general_trials["starting_point_months"].notna()
		& ~general_trials["starting_point_inferred"]
	].copy()
	curve_candidates["positive_drugs"] = curve_candidates["drug_amounts"].map(
		lambda amounts: {drug: quantity for drug, quantity in amounts.items() if quantity > 0}
	)
	curve_candidates["single_drug_type"] = curve_candidates["positive_drugs"].map(
		lambda amounts: next(iter(amounts)) if len(amounts) == 1 else None
	)
	curve_candidates["single_drug_quantity"] = curve_candidates["positive_drugs"].map(
		lambda amounts: next(iter(amounts.values())) if len(amounts) == 1 else np.nan
	)
	single_drug_rows = curve_candidates.loc[curve_candidates["single_drug_type"].notna()].copy()
	curves: dict[str, pd.DataFrame] = {}
	curve_support_rows: list[dict[str, Any]] = []
	curve_knot_frames: list[pd.DataFrame] = []
	all_drug_types = sorted({drug for amounts in general_trials["drug_amounts"] for drug in amounts})
	for drug_type in all_drug_types:
		knots, support = build_curve(
			drug_type,
			single_drug_rows.loc[single_drug_rows["single_drug_type"] == drug_type],
		)
		curve_support_rows.append(support)
		if support["supported"]:
			curves[drug_type] = knots
			curve_knot_frames.append(knots)
	curve_support = pd.DataFrame(curve_support_rows).sort_values("drug_type").reset_index(drop=True)
	curve_knots = pd.concat(curve_knot_frames, ignore_index=True) if curve_knot_frames else pd.DataFrame()
	assert set(single_drug_rows["partition"]) <= {"train"}
	assert set(curve_knots["drug_type"]) <= set(curves)
	for _, knots in curve_knots.groupby("drug_type"):
		for quantity, expected in zip(knots["quantity_grams"], knots["interpolated_months"]):
			assert np.isclose(interpolate_curve(quantity, knots), expected)
		assert np.isclose(interpolate_curve(knots["quantity_grams"].min() - 1, knots), knots["interpolated_months"].iloc[0])
		assert np.isclose(interpolate_curve(knots["quantity_grams"].max() + 1, knots), knots["interpolated_months"].iloc[-1])
		assert set(" | ".join(knots["training_citations"]).split(" | ")) <= set(single_drug_rows["case_id"])

	factor_effects = learn_factor_effects(
		general_effects.loc[general_effects["partition"] == "train"]
	)
	role_effects, role_effect_support = build_role_effects(
		trials.loc[trials["partition"] == "train"]
	)
	factor_percentage_errors = build_factor_percentage_error_report(
		factor_effects,
		general_effects.loc[general_effects["partition"] == "test"],
	)
	supported_effects = factor_effects.loc[factor_effects["supported"]].set_index(
		["stage", "canonical_factor"]
	)["median_effect_fraction"].to_dict()
	deployment_artifact_path = write_deployment_artifact(
		notebook_dir,
		cache_metadata,
		curves,
		factor_effects,
		role_effects,
		role_workbook_provenance,
	)
	test = general_trials.loc[general_trials["partition"] == "test"].copy()
	starting_predictions = test["drug_amounts"].map(lambda amounts: starting_point_from_legacy_weighted_total(amounts, curves))
	test[["predicted_starting_point_months", "starting_prediction_status", "unsupported_drugs"]] = pd.DataFrame(
		starting_predictions.tolist(), index=test.index
	)
	test["unsupported_drugs"] = test["unsupported_drugs"].map(lambda values: " | ".join(values))
	for _, row in test.loc[test["starting_prediction_status"] == "supported"].iterrows():
		positive_amounts = {drug: amount for drug, amount in row["drug_amounts"].items() if amount > 0}
		if len(positive_amounts) > 1:
			total_amount = sum(positive_amounts.values())
			expected = sum(
				interpolate_curve(total_amount, curves[drug_type]) * quantity
				for drug_type, quantity in positive_amounts.items()
			) / total_amount
			assert np.isclose(row["predicted_starting_point_months"], expected)
	test["uses_role_profile"] = test["role_selection_source"].ne("none")
	test["prediction_role_factors"] = [[] for _ in range(len(test))]
	test["prediction_aggravating_factors"] = test.apply(
		lambda row: role_aware_aggravating_factors(
			row["other_aggravating_factors"],
			row["selected_primary_role"],
			row["selected_circumstances"],
		)
		if row["uses_role_profile"]
		else row["other_aggravating_factors"],
		axis=1,
	)

	def predict_role_row(row: pd.Series) -> tuple[float, str, bool]:
		if pd.isna(row["predicted_starting_point_months"]):
			return np.nan, "starting point unavailable", False
		if row["uses_role_profile"]:
			return role_profile_prediction(
				row["selected_primary_role"],
				row["selected_circumstances"],
				row["predicted_starting_point_months"],
				role_effects,
			)
		return 0.0, "no sentencing role profile", False

	test[[
		"predicted_role_enhancement_months",
		"role_profile_status",
		"courier_cross_border_uses_aggravation",
	]] = test.apply(predict_role_row, axis=1, result_type="expand")
	test["role_factor_status"] = test["role_profile_status"]
	test["aggravation_factor_status"] = test["prediction_aggravating_factors"].map(
		lambda factors: factor_status(factors, "aggravation", supported_effects)
	)
	test["mitigation_factor_status"] = test["canonical_mitigating_factors"].map(
		lambda factors: factor_status(factors, "mitigation", supported_effects)
	)
	test["plea_factor_status"] = test["guilty_plea_json"].map(
		lambda plea_json: factor_status(plea_factor(plea_json), "plea", supported_effects)
	)
	test["predicted_sentence_after_role_months"] = test["predicted_starting_point_months"] + test["predicted_role_enhancement_months"]
	test["predicted_aggravation_months"] = test.apply(
		lambda row: stage_effect(row["prediction_aggravating_factors"], "aggravation", row["predicted_starting_point_months"], supported_effects)
		if pd.notna(row["predicted_starting_point_months"])
		else np.nan,
		axis=1,
	)
	test["predicted_notional_sentence_months"] = test["predicted_sentence_after_role_months"] + test["predicted_aggravation_months"]
	test["predicted_mitigation_reduction_months"] = test.apply(
		lambda row: min(
			row["predicted_notional_sentence_months"],
			max(0.0, stage_effect(row["canonical_mitigating_factors"], "mitigation", row["predicted_notional_sentence_months"], supported_effects)),
		)
		if pd.notna(row["predicted_notional_sentence_months"])
		else np.nan,
		axis=1,
	)
	test["predicted_pre_plea_months"] = test["predicted_notional_sentence_months"] - test["predicted_mitigation_reduction_months"]
	test["predicted_plea_reduction_months"] = test.apply(
		lambda row: min(
			row["predicted_pre_plea_months"],
			max(0.0, stage_effect(plea_factor(row["guilty_plea_json"]), "plea", row["predicted_pre_plea_months"], supported_effects)),
		)
		if pd.notna(row["predicted_pre_plea_months"])
		else np.nan,
		axis=1,
	)
	test["predicted_final_sentence_months"] = test["predicted_pre_plea_months"] - test["predicted_plea_reduction_months"]
	for column in [
		"predicted_starting_point_months",
		"predicted_role_enhancement_months",
		"predicted_sentence_after_role_months",
		"predicted_aggravation_months",
		"predicted_notional_sentence_months",
		"predicted_mitigation_reduction_months",
		"predicted_pre_plea_months",
		"predicted_plea_reduction_months",
		"predicted_final_sentence_months",
	]:
		test[f"reported_{column}"] = test[column].round().astype("Int64")
	predicted_columns = [column for column in test.columns if column.startswith("predicted_")]
	assert (test[predicted_columns].dropna(how="all") >= 0).all().all()
	assert np.allclose(
		test.loc[test["predicted_final_sentence_months"].notna(), "predicted_final_sentence_months"],
		test.loc[test["predicted_final_sentence_months"].notna(), "predicted_pre_plea_months"]
		- test.loc[test["predicted_final_sentence_months"].notna(), "predicted_plea_reduction_months"],
	)
	assert np.allclose(
		test.loc[test["predicted_sentence_after_role_months"].notna(), "predicted_sentence_after_role_months"],
		test.loc[test["predicted_sentence_after_role_months"].notna(), "predicted_starting_point_months"]
		+ test.loc[test["predicted_sentence_after_role_months"].notna(), "predicted_role_enhancement_months"],
	)
	assert np.allclose(
		test.loc[test["predicted_notional_sentence_months"].notna(), "predicted_notional_sentence_months"],
		test.loc[test["predicted_notional_sentence_months"].notna(), "predicted_sentence_after_role_months"]
		+ test.loc[test["predicted_notional_sentence_months"].notna(), "predicted_aggravation_months"],
	)
	legacy_predictions = test.apply(legacy_percentage_prediction, axis=1, result_type="expand")
	test = pd.concat([test, legacy_predictions], axis=1)
	legacy_eligible = test.loc[
		test["legacy_percentage_compatible"]
		& test["final_sentence_months"].notna()
		& test["predicted_final_sentence_months"].notna()
		& test["legacy_percentage_final_sentence_months"].notna()
	].copy()
	legacy_percentage_comparison = pd.DataFrame([
		{
			"method": "data-derived median effects",
			"common_compatible_test_trials": len(legacy_eligible),
			"final_sentence_mae_months": (
				legacy_eligible["final_sentence_months"] - legacy_eligible["predicted_final_sentence_months"]
			).abs().mean(),
			"median_absolute_error_months": (
				legacy_eligible["final_sentence_months"] - legacy_eligible["predicted_final_sentence_months"]
			).abs().median(),
		},
		{
			"method": "legacy-mapped hard-coded percentages",
			"common_compatible_test_trials": len(legacy_eligible),
			"final_sentence_mae_months": (
				legacy_eligible["final_sentence_months"] - legacy_eligible["legacy_percentage_final_sentence_months"]
			).abs().mean(),
			"median_absolute_error_months": (
				legacy_eligible["final_sentence_months"] - legacy_eligible["legacy_percentage_final_sentence_months"]
			).abs().median(),
		},
	])

	metrics = build_metrics(test)
	eligibility_summary = pd.DataFrame([
		{"scope": "judgments", "partition": "train", "count": general_trials.loc[general_trials["partition"] == "train", "case_id"].nunique()},
		{"scope": "judgments", "partition": "test", "count": general_trials.loc[general_trials["partition"] == "test", "case_id"].nunique()},
		{"scope": "trials", "partition": "train", "count": len(general_trials.loc[general_trials["partition"] == "train"])},
		{"scope": "trials", "partition": "test", "count": len(test)},
		{"scope": "starting-point eligible single-drug training trials", "partition": "train", "count": len(single_drug_rows)},
		{"scope": "direct factor adjustments", "partition": "train", "count": len(general_effects.loc[general_effects["partition"] == "train"])},
		{
			"scope": "source-excluded trials reserved for role and circumstance fitting",
			"partition": "all",
			"count": len(source_excluded_trial_keys),
		},
		{
			"scope": "excluded role-workbook trials removed from development",
			"partition": "all",
			"count": len(excluded_trial_keys),
		},
	])
	unsupported_test_drugs = test.loc[
		test["starting_prediction_status"] != "supported",
		["case_id", "neutral_citation", "trial_index", "charge_no", "defendant_id", "starting_prediction_status", "unsupported_drugs", "drugs_json"],
	].copy()
	comparison = pd.DataFrame()
	baseline_path = notebook_dir / "stage_model_analysis.xlsx"
	if baseline_path.exists():
		baseline = pd.read_excel(baseline_path, sheet_name="held-out predictions")
		common = test.merge(
			baseline[["case_id", "trial_index", "predicted_starting_point_months", "predicted_final_sentence_months"]],
			on=["case_id", "trial_index"],
			how="inner",
			suffixes=("_linear", "_spline"),
		)
		common = common.dropna(subset=[
			"starting_point_months",
			"final_sentence_months",
			"predicted_starting_point_months_linear",
			"predicted_final_sentence_months_linear",
			"predicted_starting_point_months_spline",
			"predicted_final_sentence_months_spline",
		]).copy()
		comparison = pd.DataFrame([
			{
				"method": "linear interpolation",
				"common_test_trials": len(common),
				"starting_point_mae_months": (common["starting_point_months"] - common["predicted_starting_point_months_linear"]).abs().mean(),
				"final_sentence_mae_months": (common["final_sentence_months"] - common["predicted_final_sentence_months_linear"]).abs().mean(),
			},
			{
				"method": "spline ridge baseline",
				"common_test_trials": len(common),
				"starting_point_mae_months": (common["starting_point_months"] - common["predicted_starting_point_months_spline"]).abs().mean(),
				"final_sentence_mae_months": (common["final_sentence_months"] - common["predicted_final_sentence_months_spline"]).abs().mean(),
			},
		])

	assert unique_canonical_factors([{"factor": "Import"}, {"factor": "Export"}]) == ["Cross-border trafficking"]
	assert set(split_membership["partition"]) == {"train", "test"}
	assert (factor_effects.loc[~factor_effects["supported"], "support_trials"] < MIN_FACTOR_SUPPORT).all()

	output_path = notebook_dir / "linear_interpolation_analysis.xlsx"
	export_trials = trials.copy()
	for column in [
		"drug_amounts",
		"canonical_aggravating_factors",
		"canonical_mitigating_factors",
		"role_factors",
		"other_aggravating_factors",
		"workbook_circumstances",
		"verified_circumstances",
		"selected_circumstances",
		"prediction_role_factors",
		"prediction_aggravating_factors",
	]:
		if column in export_trials:
			export_trials[column] = export_trials[column].map(excel_safe)
	with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
		write_sheet(writer, pd.DataFrame([{
			"cache_document_count": len(documents),
			"cache_created_at": cache_metadata.get("created_at"),
			"source_excluded_document_count": cache_metadata.get("source_excluded_document_count"),
			"source_excluded_documents_included_for_trial_reconciliation": cache_metadata.get(
				"source_excluded_documents_included_for_trial_reconciliation"
			),
			"source_excluded_documents_used_for_role_fitting": cache_metadata.get(
				"source_excluded_documents_used_for_role_fitting"
			),
			"source_excluded_documents_used_for_non_role_stages": cache_metadata.get(
				"source_excluded_documents_used_for_non_role_stages"
			),
			"random_seed": RANDOM_SEED,
			"test_size": TEST_SIZE,
			"minimum_curve_support": MIN_CURVE_SUPPORT,
			"minimum_factor_support": MIN_FACTOR_SUPPORT,
		}]), "summary")
		write_sheet(writer, split_membership, "split membership")
		write_sheet(writer, eligibility_summary, "eligibility summary")
		write_sheet(writer, role_reconciliation, "role workbook reconciliation")
		write_sheet(writer, role_effect_support, "role effect support")
		write_sheet(writer, single_drug_rows, "single-drug training")
		write_sheet(writer, curve_support, "curve support")
		write_sheet(writer, curve_knots, "curve knots")
		write_sheet(writer, unsupported_test_drugs, "unsupported drugs")
		write_sheet(writer, factor_effects, "learned factor effects")
		write_sheet(writer, factor_percentage_errors, "factor percentage errors")
		write_sheet(writer, metrics, "held-out metrics")
		write_sheet(writer, comparison, "method comparison")
		write_sheet(writer, legacy_percentage_comparison, "legacy % comparison")
		write_sheet(writer, test, "held-out predictions")
		write_sheet(writer, export_trials, "modelling rows")

	exported_split = pd.read_excel(output_path, sheet_name="split membership")
	pd.testing.assert_frame_equal(
		split_membership.sort_values("case_id").reset_index(drop=True),
		exported_split.sort_values("case_id").reset_index(drop=True),
	)
	return {
		"output_path": str(output_path),
		"deployment_artifact_path": str(deployment_artifact_path),
		"metrics": metrics,
		"eligibility_summary": eligibility_summary,
		"comparison": comparison,
		"legacy_percentage_comparison": legacy_percentage_comparison,
		"curve_support": curve_support,
		"factor_percentage_errors": factor_percentage_errors,
		"role_reconciliation": role_reconciliation,
		"role_effect_support": role_effect_support,
		"unsupported_test_drugs": unsupported_test_drugs,
	}
