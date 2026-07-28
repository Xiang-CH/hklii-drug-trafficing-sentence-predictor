"""Dependency-free deployment predictor trained by linear_interpolation_analysis.ipynb.

This is the production-facing counterpart to ``legacy_model.py``.  Its learned
curves and direct-adjustment effects live in ``data_derived_linear_model.json``;
regenerate that artifact by running the analysis notebook against an approved
cache snapshot.  This module never reads MongoDB and does not need pandas,
numpy, or scikit-learn.
"""

from __future__ import annotations

import json
import math
from bisect import bisect_right
from pathlib import Path
from typing import Any, Mapping, Sequence


DEFAULT_MODEL_PATH = Path(__file__).with_suffix(".json")
ROLE_FACTOR = "Role of the defendant"
COURIER_STOREKEEPER_ROLE = "Courier / Storekeeper"
SEVERE_PRIMARY_ROLES = {
	"Actual trafficker",
	"Manager / Organiser",
	"Operator / Financial controller",
}
PRIMARY_ROLES = {COURIER_STOREKEEPER_ROLE, *SEVERE_PRIMARY_ROLES}
SUPPLEMENTARY_CIRCUMSTANCES = {
	"Cross-border trafficking",
	"Divan keeping",
	"Manufacturing",
}
LEGACY_DRUG_ARGUMENTS = {
	"cocaine_amount": "Cocaine",
	"heroin_amount": "Heroin",
	"meth_amount": "Methamphetamine",
	"methamphetamine_amount": "Methamphetamine",
	"ketamine_amount": "Ketamine",
	"ecstasy_amount": "Ecstasy",
	"cannabis_amount": "Cannabis",
	"cannabisresin_amount": "Cannabis",
	"herbalcannabis_amount": "Cannabis",
}


class DataDerivedLinearPredictor:
	"""Predict sentence stages with cached data-derived piecewise-linear curves.

	``predict`` deliberately returns no starting point when any present drug is
	unsupported.  It does not substitute a legacy curve or silently use zero.
	"""

	def __init__(
		self,
		model_path: str | Path | None = None,
		adjustment_strategy: str = "learned",
	) -> None:
		path = Path(model_path) if model_path is not None else DEFAULT_MODEL_PATH
		self.model_path = path
		self.model = json.loads(path.read_text())
		self.drug_curves: dict[str, list[tuple[float, float]]] = {
			drug: [(float(quantity), float(months)) for quantity, months in knots]
			for drug, knots in self.model["drug_curves"].items()
		}
		strategy_sources = {
			"learned": "factor_effects",
			"legacy_percentages": "legacy_percentage_effects",
		}
		if adjustment_strategy not in strategy_sources:
			raise ValueError(f"adjustment_strategy must be one of {sorted(strategy_sources)}")
		self.adjustment_strategy = adjustment_strategy
		effect_source = self.model[strategy_sources[adjustment_strategy]]
		self.factor_effects: dict[str, dict[str, float]] = {
			stage: {factor: float(effect) for factor, effect in factors.items()}
			for stage, factors in effect_source.items()
		}
		self.canonical_factor_map = self.model["canonical_factor_map"]
		self.role_effects = self.model.get("role_effects", {
			"primary_effects": {COURIER_STOREKEEPER_ROLE: 0.0},
			"circumstance_effects": {},
			"severe_cross_border_effect": None,
		})

	def interpolate_curve(self, drug_type: str, quantity_grams: float) -> float | None:
		"""Interpolate one supported drug curve, clamping outside its observed range."""
		knots = self.drug_curves.get(drug_type)
		if knots is None:
			return None
		if not math.isfinite(quantity_grams) or quantity_grams < 0:
			raise ValueError("Drug quantity must be a finite, non-negative number")
		quantities = [quantity for quantity, _ in knots]
		if quantity_grams <= quantities[0]:
			return knots[0][1]
		if quantity_grams >= quantities[-1]:
			return knots[-1][1]
		right = bisect_right(quantities, quantity_grams)
		left = right - 1
		x0, y0 = knots[left]
		x1, y1 = knots[right]
		return y0 + (y1 - y0) * (quantity_grams - x0) / (x1 - x0)

	def predict_drug(self, drug_type: str, quantity_grams: float) -> float | None:
		"""Return the supported drug curve result, or ``None`` when unsupported."""
		return self.interpolate_curve(drug_type, quantity_grams)

	def predict_cocaine(self, quantity_grams: float) -> float | None:
		return self.predict_drug("Cocaine", quantity_grams)

	def predict_heroin(self, quantity_grams: float) -> float | None:
		return self.predict_drug("Heroin", quantity_grams)

	def predict_meth(self, quantity_grams: float) -> float | None:
		return self.predict_drug("Methamphetamine", quantity_grams)

	def predict_ketamine(self, quantity_grams: float) -> float | None:
		return self.predict_drug("Ketamine", quantity_grams)

	def predict_cannabis(self, quantity_grams: float) -> float | None:
		return self.predict_drug("Cannabis", quantity_grams)

	def get_starting_point(
		self,
		drug_amounts: Mapping[str, float] | None = None,
		**legacy_amounts: float,
	) -> float | None:
		"""Use the legacy total-quantity weighted rule across supported drug curves."""
		amounts = self._normalise_drug_amounts(drug_amounts, legacy_amounts)
		if not amounts or any(drug not in self.drug_curves for drug in amounts):
			return None
		total = sum(amounts.values())
		return sum(
			self.interpolate_curve(drug, total) * amount
			for drug, amount in amounts.items()
		) / total

	def predict(
		self,
		drug_amounts: Mapping[str, float],
		aggravating_factors: Sequence[str] = (),
		mitigating_factors: Sequence[str] = (),
		pleaded_guilty: bool = False,
		guilty_plea_stage: str | None = None,
		primary_role: str | None = None,
		additional_circumstances: Sequence[str] = (),
	) -> dict[str, Any]:
		"""Return full-precision stages, whole-month display values, and statuses."""
		amounts = self._normalise_drug_amounts(drug_amounts, {})
		unsupported_drugs = sorted(drug for drug in amounts if drug not in self.drug_curves)
		if not amounts:
			return self._unsupported_result("no positive drug quantity", [])
		if unsupported_drugs:
			return self._unsupported_result("unsupported drug curve", unsupported_drugs)

		starting_point = self.get_starting_point(amounts)
		canonical_aggravating = self._canonical_factors(aggravating_factors)
		canonical_mitigating = self._canonical_factors(mitigating_factors)
		other_aggravating = [factor for factor in canonical_aggravating if factor != ROLE_FACTOR]
		role_profile_selected = primary_role is not None or bool(additional_circumstances)
		if role_profile_selected:
			primary_role, circumstances = self._normalise_role_profile(
				primary_role,
				additional_circumstances,
			)
			role_enhancement, role_status, courier_cross_border = self._role_profile_effect(
				primary_role,
				circumstances,
				starting_point,
			)
			if courier_cross_border:
				other_aggravating = list(dict.fromkeys([
					*other_aggravating,
					"Cross-border trafficking",
				]))
			elif (
				primary_role in SEVERE_PRIMARY_ROLES
				and "Cross-border trafficking" in circumstances
			):
				other_aggravating = [
					factor for factor in other_aggravating
					if factor != "Cross-border trafficking"
				]
		else:
			role_enhancement = 0.0
			role_status = "no sentencing role profile"
		after_role = max(0.0, starting_point + role_enhancement)
		aggravation = self._effect(other_aggravating, "aggravation", after_role)
		notional = max(0.0, after_role + aggravation)
		mitigation = min(notional, max(0.0, self._effect(canonical_mitigating, "mitigation", notional)))
		pre_plea = max(0.0, notional - mitigation)
		plea_factors = [f"Guilty plea: {guilty_plea_stage or 'Unknown'}"] if pleaded_guilty else []
		plea_reduction = min(pre_plea, max(0.0, self._effect(plea_factors, "plea", pre_plea)))
		final_sentence = max(0.0, pre_plea - plea_reduction)
		stages = {
			"starting_point_months": starting_point,
			"role_enhancement_months": role_enhancement,
			"sentence_after_role_months": after_role,
			"aggravation_months": aggravation,
			"notional_sentence_months": notional,
			"mitigation_reduction_months": mitigation,
			"pre_plea_months": pre_plea,
			"plea_reduction_months": plea_reduction,
			"final_sentence_months": final_sentence,
		}
		return {
			"status": "supported",
			"adjustment_strategy": self.adjustment_strategy,
			"unsupported_drugs": [],
			"drug_amounts": amounts,
			"factors": {
				"role": role_status,
				"aggravation": self._factor_status(other_aggravating, "aggravation"),
				"mitigation": self._factor_status(canonical_mitigating, "mitigation"),
				"plea": self._factor_status(plea_factors, "plea"),
			},
			**stages,
			"reported_months": {name: round(value) for name, value in stages.items()},
		}

	def _normalise_role_profile(
		self,
		primary_role: str | None,
		additional_circumstances: Sequence[str],
	) -> tuple[str, list[str]]:
		if primary_role not in PRIMARY_ROLES:
			raise ValueError(f"primary_role must be one of {sorted(PRIMARY_ROLES)}")
		circumstances = list(additional_circumstances)
		if len(circumstances) != len(set(circumstances)):
			raise ValueError("additional_circumstances must not contain duplicates")
		unsupported = [
			circumstance
			for circumstance in circumstances
			if circumstance not in SUPPLEMENTARY_CIRCUMSTANCES
		]
		if unsupported:
			raise ValueError(
				"additional_circumstances must contain only "
				f"{sorted(SUPPLEMENTARY_CIRCUMSTANCES)}"
			)
		return primary_role, circumstances

	def _role_profile_effect(
		self,
		primary_role: str,
		circumstances: Sequence[str],
		starting_point: float,
	) -> tuple[float, str, bool]:
		primary_effect = self.role_effects.get("primary_effects", {}).get(primary_role)
		if primary_effect is None:
			return 0.0, f"unsupported primary role: {primary_role}", False
		effect = float(primary_effect)
		statuses = ["primary role supported"]
		for circumstance in circumstances:
			if circumstance == "Cross-border trafficking":
				if primary_role == COURIER_STOREKEEPER_ROLE:
					statuses.append("cross-border uses Import/Export effect")
					continue
				cross_border_effect = self.role_effects.get(
					"severe_cross_border_effect"
				)
				if cross_border_effect is None:
					statuses.append("unsupported severe-role cross-border effect")
				else:
					effect += float(cross_border_effect)
					statuses.append("severe-role cross-border supported")
				continue
			circumstance_effect = self.role_effects.get(
				"circumstance_effects", {}
			).get(circumstance)
			if circumstance_effect is None:
				statuses.append(f"unsupported circumstance: {circumstance}")
			else:
				effect += float(circumstance_effect)
				statuses.append(f"{circumstance} supported")
		return (
			starting_point * effect,
			" | ".join(statuses),
			primary_role == COURIER_STOREKEEPER_ROLE
			and "Cross-border trafficking" in circumstances,
		)

	def _normalise_drug_amounts(
		self,
		drug_amounts: Mapping[str, float] | None,
		legacy_amounts: Mapping[str, float],
	) -> dict[str, float]:
		amounts: dict[str, float] = {}
		for raw_drug, raw_amount in (drug_amounts or {}).items():
			self._add_amount(amounts, raw_drug, raw_amount)
		for argument, raw_amount in legacy_amounts.items():
			drug_type = LEGACY_DRUG_ARGUMENTS.get(argument, argument)
			self._add_amount(amounts, drug_type, raw_amount)
		return amounts

	@staticmethod
	def _add_amount(amounts: dict[str, float], drug_type: str, raw_amount: float) -> None:
		amount = float(raw_amount)
		if not math.isfinite(amount) or amount < 0:
			raise ValueError(f"{drug_type} amount must be a finite, non-negative number")
		if amount > 0:
			amounts[drug_type] = amounts.get(drug_type, 0.0) + amount

	def _canonical_factors(self, factors: Sequence[str]) -> list[str]:
		return list(dict.fromkeys(self.canonical_factor_map.get(factor, factor) for factor in factors if factor))

	def _effect(self, factors: Sequence[str], stage: str, base_months: float) -> float:
		effects = self.factor_effects.get(stage, {})
		return sum(base_months * effects.get(factor, 0.0) for factor in factors)

	def _factor_status(self, factors: Sequence[str], stage: str) -> str:
		if not factors:
			return "no factors"
		unsupported = [factor for factor in factors if factor not in self.factor_effects.get(stage, {})]
		return f"unsupported factors: {' | '.join(unsupported)}" if unsupported else "supported"

	@staticmethod
	def _unsupported_result(status: str, unsupported_drugs: list[str]) -> dict[str, Any]:
		return {
			"status": status,
			"unsupported_drugs": unsupported_drugs,
			"starting_point_months": None,
			"final_sentence_months": None,
			"reported_months": {},
		}


if __name__ == "__main__":
	predictor = DataDerivedLinearPredictor()
	print(json.dumps(predictor.predict({"Cocaine": 10.0}), indent=2))


DkPredictor = DataDerivedLinearPredictor
