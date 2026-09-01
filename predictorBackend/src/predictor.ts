import type { PredictionRequest } from './schema.js'
import {
	predictNotionalWeightedMonths,
} from './guidelineModel.js'

export type AdjustmentCategory =
	| 'defendantRole'
	| 'aggravating'
	| 'mitigating'
	| 'guiltyPlea'

export type PredictionAdjustment = {
	factor: string
	category: AdjustmentCategory
	direction: 'increase' | 'decrease'
	percentage: number
	baseMonths: number
	months: number
	years: number
}

export type PredictionResponse = {
	status: 'supported'
	startingPointMonths: number
	startingPointYears: number
	adjustments: Array<PredictionAdjustment>
	finalSentenceMonths: number
	finalSentenceYears: number
}

export class UnsupportedPredictionError extends Error {
	readonly code = 'MODEL_INPUT_UNAVAILABLE'

	constructor(message: string) {
		super(message)
		this.name = 'UnsupportedPredictionError'
	}
}

const roleAdjustments: Record<string, number> = {
	'Courier / Storekeeper': 0,
	'Actual trafficker': 0.05,
	'Manager / Organiser': 0.06,
	'Operator / Financial Controller': 0.08,
}

const aggravatingAdjustments: Record<string, number> = {
	'Multiple Drugs': 0.0385,
	'Persistent offender': 0.04,
	'On bail': 0.0441,
	'Refugee/Asylum': 0.08,
	'Use of minors': 0.0525,
}

const courierCrossBorderAdjustment = 0.0588
const roleCrossBorderAdjustments: Record<string, number> = {
	'Actual trafficker': 0.29,
	'Manager / Organiser': 0.08,
	'Operator / Financial Controller': 0.1,
}

const mitigatingAdjustments: Record<string, number> = {
	'Self-consumption': 0.0451,
	'Young offender': 0.0409,
	'Medical conditions': 0.03,
	'Family illness': 0.03,
	'Rehabilitation programme': 0.0114,
}

const assistanceGuidelineAdjustments: Record<string, number> = {
	'Assistance - limited': 0.0667,
	'Assistance - useful': 0.0917,
	'Assistance - testify': 0.1667,
	'Assistance - risk': 0.325,
}

const guiltyPleaAdjustments: Record<string, number> = {
	'Plead guilty (earliest opportunity)': 0.333,
	'Plead guilty (before trial dates are set)': 0.25,
	'Plead guilty (before trial starts)': 0.225,
	'Plead guilty (first day of trial)': 0.2,
	'Plead guilty (during the trial)': 0.15,
}

function round(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100
}

function getStartingPoint(input: PredictionRequest): number {
	const startingPoint = predictNotionalWeightedMonths(input.drugs)
	if (startingPoint === null) {
		throw new UnsupportedPredictionError(
			'A prediction is not available for one of the submitted drugs',
		)
	}
	return startingPoint
}

export function predictSentence(
	input: PredictionRequest,
): PredictionResponse {
	const startingPoint = getStartingPoint(input)
	const adjustments: Array<PredictionAdjustment> = []

	const roleIncreases: Array<{
		factor: string
		category: 'defendantRole'
		percentage: number
	}> = []
	const aggravatingIncreases: Array<{
		factor: string
		category: 'aggravating'
		percentage: number
	}> = []

	if (input.defendantRole !== null) {
		const isCourier = input.defendantRole === 'Courier / Storekeeper'
		const hasCrossBorder = input.additionalCircumstances.includes(
			'Cross-border trafficking',
		)

		if (!isCourier && hasCrossBorder) {
			roleIncreases.push({
				factor: `${input.defendantRole} + Cross-border trafficking`,
				category: 'defendantRole',
				percentage: roleCrossBorderAdjustments[input.defendantRole],
			})
		} else {
			roleIncreases.push({
				factor: input.defendantRole,
				category: 'defendantRole',
				percentage: roleAdjustments[input.defendantRole],
			})

			if (hasCrossBorder) {
				aggravatingIncreases.push({
					factor: 'Cross-border trafficking',
					category: 'aggravating',
					percentage: courierCrossBorderAdjustment,
				})
			}
		}
	}

	for (const factor of input.aggravatingFactors) {
		aggravatingIncreases.push({
			factor,
			category: 'aggravating',
			percentage: aggravatingAdjustments[factor],
		})
	}

	// Role increases are non-compounding percentages of the starting point;
	// they are summed before being added once to form the post-role sentence.
	let totalRoleIncreaseMonths = 0
	for (const increase of roleIncreases) {
		const months = startingPoint * increase.percentage
		totalRoleIncreaseMonths += months
		adjustments.push({
			factor: increase.factor,
			category: increase.category,
			direction: 'increase',
			percentage: round(increase.percentage * 100),
			baseMonths: round(startingPoint),
			months: round(Math.abs(months)),
			years: round(Math.abs(months) / 12),
		})
	}
	const postRoleMonths = startingPoint + totalRoleIncreaseMonths

	// Aggravating increases are non-compounding percentages of the post-role
	// sentence; they are summed before being added once to form the notional
	// sentence.
	let totalAggravatingIncreaseMonths = 0
	for (const increase of aggravatingIncreases) {
		const months = postRoleMonths * increase.percentage
		totalAggravatingIncreaseMonths += months
		adjustments.push({
			factor: increase.factor,
			category: increase.category,
			direction: 'increase',
			percentage: round(increase.percentage * 100),
			baseMonths: round(postRoleMonths),
			months: round(Math.abs(months)),
			years: round(Math.abs(months) / 12),
		})
	}

	// All reductions are non-compounding percentages of the notional sentence
	// (the post-role sentence plus the summed aggravating increases).
	const reductionBaseMonths = postRoleMonths + totalAggravatingIncreaseMonths
	const reductions: Array<{
		factor: string
		category: 'mitigating' | 'guiltyPlea'
		percentage: number
	}> = []

	for (const factor of input.mitigatingFactors) {
		const adjustment = mitigatingAdjustments[factor]
		if (adjustment !== undefined) {
			reductions.push({ factor, category: 'mitigating', percentage: adjustment })
		}
	}

	if (input.guiltyPlea !== null) {
		const pleaAdjustment = guiltyPleaAdjustments[input.guiltyPlea]
		if (pleaAdjustment !== undefined) {
			reductions.push({
				factor: input.guiltyPlea,
				category: 'guiltyPlea',
				percentage: pleaAdjustment,
			})
		}
	}

	const assistanceFactor = input.mitigatingFactors.find(
		(factor) => assistanceGuidelineAdjustments[factor] !== undefined,
	)
	if (assistanceFactor !== undefined) {
		reductions.push({
			factor: assistanceFactor,
			category: 'mitigating',
			percentage: assistanceGuidelineAdjustments[assistanceFactor],
		})
	}

	let totalReductionMonths = 0
	for (const reduction of reductions) {
		const months = reductionBaseMonths * reduction.percentage
		totalReductionMonths += months
		adjustments.push({
			factor: reduction.factor,
			category: reduction.category,
			direction: 'decrease',
			percentage: round(reduction.percentage * 100),
			baseMonths: round(reductionBaseMonths),
			months: round(Math.abs(months)),
			years: round(Math.abs(months) / 12),
		})
	}
	const finalSentenceMonths = Math.max(0, reductionBaseMonths - totalReductionMonths)
	return {
		status: 'supported',
		startingPointMonths: round(startingPoint),
		startingPointYears: round(startingPoint / 12),
		adjustments,
		finalSentenceMonths: round(finalSentenceMonths),
		finalSentenceYears: round(finalSentenceMonths / 12),
	}
}
