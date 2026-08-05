import type { PredictionRequest } from './schema.js'

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

const drugWeights: Record<string, number> = {
	Cocaine: 2,
	Ketamine: 1.5,
	Fluorodeschloroketamine: 1.5,
	Methamphetamine: 2.5,
	Heroin: 3,
	'Cannabis/THC': 0.5,
	Ecstasy: 1.75,
	Nimetazepam: 1,
}

const roleAdjustments: Record<string, number> = {
	'Courier / Storekeeper': 0,
	'Actual trafficker': 0.05,
	'Manager / Organiser': 0.1,
	'Operator / Financial Controller': 0.15,
}

const aggravatingAdjustment = 0.04
const courierCrossBorderAdjustment = 0.05
const severeRoleCrossBorderAdjustment = 0.08

const mitigatingAdjustments: Record<string, number> = {
	'Self-consumption': 0.05,
	'Assistance - limited': 0.1,
	'Assistance - useful': 0.15,
	'Assistance - testify': 0.2,
	'Assistance - risk': 0.25,
	'Young offender': 0.05,
	'Medical conditions': 0.03,
	'Family illness': 0.03,
	'Rehabilitation programme': 0.04,
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

function getDrugWeight(
	type: string,
	variant: 'powder' | 'tablet' | undefined,
): number {
	if (type === 'Midazolam') {
		if (variant === 'powder') {
			return 1.25
		}
		if (variant === 'tablet') {
			return 1.5
		}
		throw new UnsupportedPredictionError(
			'Midazolam requires a supported variant',
		)
	}

	const weight = drugWeights[type]
	if (weight === undefined) {
		throw new UnsupportedPredictionError(
			`A prediction is not available for ${type}`,
		)
	}
	return weight
}

export function predictSentence(
	input: PredictionRequest,
): PredictionResponse {
	const startingPoint = input.drugs.reduce(
		(total, drug) => total + drug.quantity * getDrugWeight(drug.type, drug.variant),
		0,
	)
	const adjustments: Array<PredictionAdjustment> = []
	let currentMonths = startingPoint

	if (input.defendantRole !== null) {
		currentMonths = addAdjustment(
			adjustments,
			input.defendantRole,
			'defendantRole',
			'increase',
			currentMonths,
			roleAdjustments[input.defendantRole],
		)

		if (input.additionalCircumstances.includes('Cross-border trafficking')) {
			const isCourier = input.defendantRole === 'Courier / Storekeeper'
			currentMonths = addAdjustment(
				adjustments,
				'Cross-border trafficking',
				isCourier ? 'aggravating' : 'defendantRole',
				'increase',
				currentMonths,
				isCourier
					? courierCrossBorderAdjustment
					: severeRoleCrossBorderAdjustment,
			)
		}
	}

	for (const factor of input.aggravatingFactors) {
		currentMonths = addAdjustment(
			adjustments,
			factor,
			'aggravating',
			'increase',
			currentMonths,
			aggravatingAdjustment,
		)
	}

	for (const factor of input.mitigatingFactors) {
		currentMonths = addAdjustment(
			adjustments,
			factor,
			'mitigating',
			'decrease',
			currentMonths,
			mitigatingAdjustments[factor],
		)
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
