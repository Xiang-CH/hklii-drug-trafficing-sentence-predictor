import type { PredictionRequest } from './schema.js'
import {
	drugFamilyFor,
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
	'Assistance - limited': 0.0182,
	'Assistance - useful': 0.05,
	'Assistance - testify': 0.3108,
	'Assistance - risk': 0.0448,
	'Young offender': 0.0409,
	'Medical conditions': 0.03,
	'Family illness': 0.03,
	'Rehabilitation programme': 0.0114,
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

function addAdjustment(
	adjustments: Array<PredictionAdjustment>,
	factor: string,
	category: AdjustmentCategory,
	direction: PredictionAdjustment['direction'],
	baseMonths: number,
	percentage: number,
): number {
	const months = baseMonths * percentage
	adjustments.push({
		factor,
		category,
		direction,
		months: round(Math.abs(months)),
		years: round(Math.abs(months) / 12),
	})
	return direction === 'increase' ? baseMonths + months : baseMonths - months
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
	let currentMonths = startingPoint

	if (input.defendantRole !== null) {
		const isCourier = input.defendantRole === 'Courier / Storekeeper'
		const hasCrossBorder = input.additionalCircumstances.includes(
			'Cross-border trafficking',
		)

		if (!isCourier && hasCrossBorder) {
			currentMonths = addAdjustment(
				adjustments,
				`${input.defendantRole} + Cross-border trafficking`,
				'defendantRole',
				'increase',
				currentMonths,
				roleCrossBorderAdjustments[input.defendantRole],
			)
		} else {
			currentMonths = addAdjustment(
				adjustments,
				input.defendantRole,
				'defendantRole',
				'increase',
				currentMonths,
				roleAdjustments[input.defendantRole],
			)

			if (hasCrossBorder) {
				currentMonths = addAdjustment(
					adjustments,
					'Cross-border trafficking',
					'aggravating',
					'increase',
					currentMonths,
					courierCrossBorderAdjustment,
				)
			}
		}
	}

	const distinctFamilies = new Set(
		input.drugs
			.map((drug) => drugFamilyFor(drug.type))
			.filter((family): family is string => family !== null),
	)
	const hasMultipleDrugs =
		distinctFamilies.size >= 2 ||
		input.aggravatingFactors.includes('Multiple Drugs')
	const aggravatingFactors =
		hasMultipleDrugs && !input.aggravatingFactors.includes('Multiple Drugs')
			? ['Multiple Drugs', ...input.aggravatingFactors]
			: input.aggravatingFactors
	for (const factor of aggravatingFactors) {
		currentMonths = addAdjustment(
			adjustments,
			factor,
			'aggravating',
			'increase',
			currentMonths,
			aggravatingAdjustments[factor],
		)
	}

	for (const factor of input.mitigatingFactors) {
		const adjustment = mitigatingAdjustments[factor]
		if (adjustment !== undefined) {
			currentMonths = addAdjustment(
				adjustments,
				factor,
				'mitigating',
				'decrease',
				currentMonths,
				adjustment,
			)
		}
	}

	const pleaAdjustment = guiltyPleaAdjustments[input.guiltyPlea]
	if (pleaAdjustment !== undefined) {
		currentMonths = addAdjustment(
			adjustments,
			input.guiltyPlea,
			'guiltyPlea',
			'decrease',
			currentMonths,
			pleaAdjustment,
		)
	}

	const finalSentenceMonths = Math.max(0, currentMonths)
	return {
		status: 'supported',
		startingPointMonths: round(startingPoint),
		startingPointYears: round(startingPoint / 12),
		adjustments,
		finalSentenceMonths: round(finalSentenceMonths),
		finalSentenceYears: round(finalSentenceMonths / 12),
	}
}
