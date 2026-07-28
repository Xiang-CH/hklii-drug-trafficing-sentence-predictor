import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pandas as pd

from data_derived_linear_model import DataDerivedLinearPredictor
from linear_interpolation_model import (
    COURIER_STOREKEEPER_ROLE,
    attach_role_catalogue,
    build_role_effects,
    flatten_documents,
    general_stage_data,
    remove_workbook_exclusions,
    role_aware_aggravating_factors,
    role_profile_prediction,
)


class RoleAdjustmentModelTest(unittest.TestCase):
    def setUp(self) -> None:
        self.training_trials = pd.DataFrame([
            {
                "role_selection_source": "workbook",
                "selected_primary_role": "Actual trafficker",
                "selected_circumstances": [],
                "workbook_effect_fraction": 0.10,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 110.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
            {
                "role_selection_source": "workbook",
                "selected_primary_role": "Manager / Organiser",
                "selected_circumstances": [],
                "workbook_effect_fraction": 0.20,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 120.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
            {
                "role_selection_source": "workbook",
                "selected_primary_role": "Actual trafficker",
                "selected_circumstances": ["Divan keeping"],
                "workbook_effect_fraction": 0.40,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 140.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
            {
                "role_selection_source": "workbook",
                "selected_primary_role": "Manager / Organiser",
                "selected_circumstances": ["Manufacturing"],
                "workbook_effect_fraction": 0.50,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 150.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
            {
                "role_selection_source": "workbook",
                "selected_primary_role": "Actual trafficker",
                "selected_circumstances": ["Cross-border trafficking"],
                "workbook_effect_fraction": 0.60,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 160.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
            {
                "role_selection_source": "workbook",
                "selected_primary_role": "Manager / Organiser",
                "selected_circumstances": ["Cross-border trafficking"],
                "workbook_effect_fraction": 0.80,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 180.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
        ])

    def test_role_effects_are_independent_of_role_circumstance_pairs(self) -> None:
        role_effects, support = build_role_effects(self.training_trials)

        self.assertEqual(role_effects["primary_effects"][COURIER_STOREKEEPER_ROLE], 0.0)
        self.assertEqual(role_effects["primary_effects"]["Actual trafficker"], 0.10)
        self.assertEqual(role_effects["circumstance_effects"]["Divan keeping"], 0.40)
        self.assertEqual(role_effects["circumstance_effects"]["Manufacturing"], 0.50)
        self.assertEqual(role_effects["severe_cross_border_effect"], 0.70)
        self.assertFalse(support["component"].str.contains("pair").any())

    def test_courier_cross_border_uses_generic_aggravation(self) -> None:
        role_effects, _ = build_role_effects(self.training_trials)
        enhancement, status, uses_generic_aggravation = role_profile_prediction(
            COURIER_STOREKEEPER_ROLE,
            ["Cross-border trafficking"],
            100.0,
            role_effects,
        )

        self.assertEqual(enhancement, 0.0)
        self.assertIn("Import/Export", status)
        self.assertTrue(uses_generic_aggravation)
        self.assertEqual(
            role_aware_aggravating_factors(
                [],
                COURIER_STOREKEEPER_ROLE,
                ["Cross-border trafficking"],
            ),
            ["Cross-border trafficking"],
        )

    def test_severe_cross_border_adds_the_pooled_effect(self) -> None:
        role_effects, _ = build_role_effects(self.training_trials)
        enhancement, _, uses_generic_aggravation = role_profile_prediction(
            "Actual trafficker",
            ["Cross-border trafficking"],
            100.0,
            role_effects,
        )

        self.assertTrue(np.isclose(enhancement, 80.0))
        self.assertFalse(uses_generic_aggravation)
        self.assertEqual(
            role_aware_aggravating_factors(
                ["Cross-border trafficking", "On bail"],
                "Actual trafficker",
                ["Cross-border trafficking"],
            ),
            ["On bail"],
        )

    def test_workbook_exclusions_remove_trials_and_factor_effects(self) -> None:
        trials = pd.DataFrame([
            {"role_catalogue_key": "included", "workbook_excluded": False},
            {"role_catalogue_key": "excluded", "workbook_excluded": True},
        ])
        effects = pd.DataFrame([
            {"role_catalogue_key": "included", "stage": "aggravation"},
            {"role_catalogue_key": "excluded", "stage": "mitigation"},
        ])

        filtered_trials, filtered_effects, excluded_keys = remove_workbook_exclusions(
            trials,
            effects,
        )

        self.assertEqual(excluded_keys, {"excluded"})
        self.assertEqual(filtered_trials["role_catalogue_key"].tolist(), ["included"])
        self.assertEqual(filtered_effects["role_catalogue_key"].tolist(), ["included"])

    def test_source_excluded_trials_are_reserved_for_role_fitting(self) -> None:
        trials = pd.DataFrame([
            {
                "role_catalogue_key": "general",
                "source_document_excluded": False,
                "role_selection_source": "none",
                "selected_primary_role": None,
                "selected_circumstances": [],
                "workbook_effect_fraction": np.nan,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 100.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
            {
                "role_catalogue_key": "role-only",
                "source_document_excluded": True,
                "role_selection_source": "workbook",
                "selected_primary_role": "Actual trafficker",
                "selected_circumstances": [],
                "workbook_effect_fraction": 0.10,
                "starting_point_months": 100.0,
                "sentence_after_role_months": 110.0,
                "starting_point_inferred": False,
                "sentence_after_role_inferred": False,
            },
        ])
        effects = pd.DataFrame([
            {"role_catalogue_key": "general", "stage": "aggravation"},
            {"role_catalogue_key": "role-only", "stage": "mitigation"},
        ])

        general_trials, general_effects, reserved_keys = general_stage_data(trials, effects)
        role_effects, _ = build_role_effects(trials)

        self.assertEqual(reserved_keys, {"role-only"})
        self.assertEqual(general_trials["role_catalogue_key"].tolist(), ["general"])
        self.assertEqual(general_effects["role_catalogue_key"].tolist(), ["general"])
        self.assertEqual(role_effects["primary_effects"]["Actual trafficker"], 0.10)

    def test_legacy_role_factor_is_not_fitted_as_a_generic_effect(self) -> None:
        documents = [{
            "judgement": {"neutral_citation": "[2026] HKCFI 1"},
            "trials": {
                "trials": [{
                    "charge_type": {"charge_no": 1, "defendant_id": 1},
                    "drugs": [],
                    "aggravating_factors": [
                        {"factor": "Role of the defendant", "enhancement_months": 10.0},
                        {"factor": "On bail", "enhancement_months": 5.0},
                    ],
                    "mitigating_factors": [],
                    "starting_point": {"total_months": 100.0},
                    "sentence_after_role": {"total_months": 110.0},
                }],
            },
        }]

        trials, effects = flatten_documents(documents)

        self.assertEqual(trials["role_factors"].iloc[0], ["Role of the defendant"])
        self.assertEqual(effects["canonical_factor"].tolist(), ["On bail"])

    def test_unmatched_workbook_exclusion_warns_without_stopping_analysis(self) -> None:
        catalogue = pd.DataFrame([
            {
                "role_catalogue_key": "[2025] hkcf 1|0|1|1",
                "role_catalogue_fallback_key": "[2025] hkcf 1|1|1",
                "workbook_excluded": True,
                "workbook_primary_role": None,
                "workbook_circumstances": [],
                "workbook_starting_point_months": np.nan,
                "workbook_difference_months": np.nan,
                "workbook_effect_fraction": np.nan,
            },
        ])
        trials = pd.DataFrame([
            {
                "neutral_citation": "[2025] HKCF 2",
                "trial_index": 0,
                "charge_no": 1,
                "defendant_id": 1,
                "sentencing_role": None,
            },
        ])

        with patch(
            "linear_interpolation_model.load_role_catalogue",
            return_value=(catalogue, {}),
        ):
            with self.assertWarnsRegex(RuntimeWarning, "could not be matched"):
                augmented_trials, reconciliation, provenance = attach_role_catalogue(trials, Path("."))

        self.assertFalse(augmented_trials["workbook_excluded"].iloc[0])
        self.assertEqual(provenance["unmatched_excluded_row_count"], 1)
        self.assertEqual(
            reconciliation.loc[
                reconciliation["scope"] == "unmatched excluded workbook rows",
                "count",
            ].iloc[0],
            1,
        )

    def test_trial_index_fallback_excludes_an_unambiguous_trial(self) -> None:
        catalogue = pd.DataFrame([
            {
                "role_catalogue_key": "[2025] hkcf 1|1|1|1",
                "role_catalogue_fallback_key": "[2025] hkcf 1|1|1",
                "workbook_excluded": True,
                "workbook_primary_role": None,
                "workbook_circumstances": [],
                "workbook_starting_point_months": np.nan,
                "workbook_difference_months": np.nan,
                "workbook_effect_fraction": np.nan,
            },
        ])
        trials = pd.DataFrame([
            {
                "neutral_citation": "[2025] HKCF 1",
                "trial_index": 0,
                "charge_no": 1,
                "defendant_id": 1,
                "sentencing_role": None,
            },
        ])

        with patch(
            "linear_interpolation_model.load_role_catalogue",
            return_value=(catalogue, {}),
        ):
            with self.assertWarnsRegex(RuntimeWarning, "used a citation/charge/defendant fallback"):
                augmented_trials, _, provenance = attach_role_catalogue(trials, Path("."))

        self.assertTrue(augmented_trials["workbook_excluded"].iloc[0])
        self.assertEqual(provenance["fallback_matched_excluded_rows"], 1)

    def test_deployment_predictor_applies_role_rules(self) -> None:
        artifact = {
            "canonical_factor_map": {},
            "drug_curves": {"Cocaine": [[0.0, 24.0], [10.0, 60.0]]},
            "factor_effects": {
                "aggravation": {"Cross-border trafficking": 0.10},
                "role": {},
                "mitigation": {},
                "plea": {},
            },
            "legacy_percentage_effects": {
                "aggravation": {"Cross-border trafficking": 0.10},
                "role": {},
                "mitigation": {},
                "plea": {},
            },
            "role_effects": {
                "primary_effects": {
                    "Courier / Storekeeper": 0.0,
                    "Actual trafficker": 0.10,
                    "Manager / Organiser": 0.20,
                    "Operator / Financial controller": 0.30,
                },
                "circumstance_effects": {
                    "Divan keeping": 0.20,
                    "Manufacturing": 0.30,
                },
                "severe_cross_border_effect": 0.40,
            },
        }
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.json"
            path.write_text(json.dumps(artifact))
            predictor = DataDerivedLinearPredictor(path)

            courier = predictor.predict(
                {"Cocaine": 10.0},
                primary_role="Courier / Storekeeper",
                additional_circumstances=["Cross-border trafficking"],
            )
            actual_trafficker = predictor.predict(
                {"Cocaine": 10.0},
                primary_role="Actual trafficker",
                additional_circumstances=["Divan keeping"],
            )
            severe_cross_border = predictor.predict(
                {"Cocaine": 10.0},
                aggravating_factors=["Cross-border trafficking"],
                primary_role="Actual trafficker",
                additional_circumstances=["Cross-border trafficking"],
            )
            legacy_role = predictor.predict(
                {"Cocaine": 10.0},
                aggravating_factors=["Role of the defendant"],
            )

        self.assertEqual(courier["role_enhancement_months"], 0.0)
        self.assertEqual(courier["aggravation_months"], 6.0)
        self.assertAlmostEqual(actual_trafficker["role_enhancement_months"], 18.0)
        self.assertEqual(severe_cross_border["role_enhancement_months"], 30.0)
        self.assertEqual(severe_cross_border["aggravation_months"], 0.0)
        self.assertEqual(legacy_role["role_enhancement_months"], 0.0)
        self.assertEqual(legacy_role["factors"]["role"], "no sentencing role profile")
        with self.assertRaisesRegex(ValueError, "must not contain duplicates"):
            predictor.predict(
                {"Cocaine": 10.0},
                primary_role="Courier / Storekeeper",
                additional_circumstances=["Divan keeping", "Divan keeping"],
            )


if __name__ == "__main__":
    unittest.main()
