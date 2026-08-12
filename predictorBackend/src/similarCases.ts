import { readFileSync } from 'node:fs'
import type { PredictionRequest } from './schema.js'
import { predictNotionalWeightedMonths } from './guidelineModel.js'

export type SimilarCase = {
	neutralCitation: string
	title: string
	url: string
	score: number
}

export type RecommenderCaseRecord = {
	neutralCitation: string
	title: string
	url: string
	language: 'english' | 'chinese'
	drugs: Readonly<Record<string, number>>
	role: string | null
	crossBorder: boolean
	aggravating: ReadonlyArray<string>
	mitigating: ReadonlyArray<string>
	assistance: number
	plea: 'early' | 'late' | 'none'
	actualFinalMonths: number
	startingPointMonths: number
}

const recommenderCaseCorpus: ReadonlyArray<RecommenderCaseRecord> = JSON.parse(
	readFileSync(
		new URL('./case_recommender_corpus.json', import.meta.url),
		'utf-8',
	),
)

const DRUG_FAMILIES = [
	'Cocaine',
	'Ketamine',
	'Methamphetamine',
	'Heroin',
	'Cannabis',
	'Ecstasy',
	'Nimetazepam',
	'Midazolam',
] as const

const REQUESTED_FAMILY_ENFORCEMENT = [0.2, 0.5, 1] as const

const FAMILY_BY_DRUG_TYPE: Record<string, string> = {
	Cocaine: 'Cocaine',
	Ketamine: 'Ketamine',
	Fluorodeschloroketamine: 'Ketamine',
	Methamphetamine: 'Methamphetamine',
	Heroin: 'Heroin',
	'Cannabis/THC': 'Cannabis',
	Ecstasy: 'Ecstasy',
	Nimetazepam: 'Nimetazepam',
	Midazolam: 'Midazolam',
}

function drugFamilyAmounts(input: PredictionRequest): Record<string, number> {
	const amounts: Record<string, number> = {}
	for (const drug of input.drugs) {
		const family = FAMILY_BY_DRUG_TYPE[drug.type]
		if (family === undefined) {
			continue
		}
		amounts[family] = (amounts[family] ?? 0) + drug.quantity
	}
	return amounts
}

function assistanceLevel(input: PredictionRequest): number {
	for (const factor of input.mitigatingFactors) {
		if (factor === 'Assistance - limited') return 1
		if (factor === 'Assistance - useful') return 2
		if (factor === 'Assistance - testify') return 3
		if (factor === 'Assistance - risk') return 4
	}
	return 0
}

function pleaBucket(input: PredictionRequest): 'early' | 'late' | 'none' {
	switch (input.guiltyPlea) {
		case 'Plead guilty (earliest opportunity)':
			return 'early'
		case 'Plead guilty (before trial dates are set)':
		case 'Plead guilty (before trial starts)':
		case 'Plead guilty (first day of trial)':
		case 'Plead guilty (during the trial)':
			return 'late'
		default:
			return 'none'
	}
}

function filterByDrugs(
	candidates: ReadonlyArray<RecommenderCaseRecord>,
	inputFamilies: Record<string, number>,
	band: number,
	enforceZeroMatch: boolean,
): ReadonlyArray<RecommenderCaseRecord> {
	return candidates.filter((candidate) => {
		for (const family of DRUG_FAMILIES) {
			const inputQuantity = inputFamilies[family] ?? 0
			const candidateQuantity = candidate.drugs[family] ?? 0
			if (inputQuantity > 0) {
				if (candidateQuantity <= 0) {
					return false
				}
				if (
					candidateQuantity < inputQuantity * (1 - band) ||
					candidateQuantity > inputQuantity * (1 + band)
				) {
					return false
				}
			} else if (enforceZeroMatch && candidateQuantity > 0) {
				return false
			}
		}
		return true
	})
}

function filterByDrugPresence(
	candidates: ReadonlyArray<RecommenderCaseRecord>,
	inputFamilies: Record<string, number>,
): ReadonlyArray<RecommenderCaseRecord> {
	return candidates.filter((candidate) =>
		DRUG_FAMILIES.every(
			(family) =>
				(inputFamilies[family] ?? 0) <= 0 || (candidate.drugs[family] ?? 0) > 0,
		),
	)
}

function crossBorderSelected(input: PredictionRequest): boolean {
	return input.additionalCircumstances.includes('Cross-border trafficking')
}

function buildTiers(
	pool: ReadonlyArray<RecommenderCaseRecord>,
	input: PredictionRequest,
): Array<ReadonlyArray<RecommenderCaseRecord>> {
	const tiers: Array<ReadonlyArray<RecommenderCaseRecord>> = []
	let working = pool

	const assistance = assistanceLevel(input)
	if (assistance > 0) {
		const proximityOrder = [1, 2, 3, 4].sort(
			(a, b) => Math.abs(a - assistance) - Math.abs(b - assistance),
		)
		for (const level of proximityOrder) {
			tiers.push(working.filter((candidate) => candidate.assistance === level))
		}
		working = working.filter((candidate) => candidate.assistance === 0)
	}

	if (input.aggravatingFactors.includes('Refugee/Asylum')) {
		tiers.push(
			working.filter((candidate) =>
				candidate.aggravating.includes('Refugee/Asylum'),
			),
		)
		working = working.filter(
			(candidate) => !candidate.aggravating.includes('Refugee/Asylum'),
		)
	}

	if (input.defendantRole !== null) {
		tiers.push(
			working.filter((candidate) => candidate.role === input.defendantRole),
		)
		working = working.filter((candidate) => candidate.role !== input.defendantRole)
	}

	const plea = pleaBucket(input)
	if (plea === 'early') {
		tiers.push(working.filter((candidate) => candidate.plea === 'early'))
		tiers.push(working.filter((candidate) => candidate.plea === 'late'))
		tiers.push(working.filter((candidate) => candidate.plea === 'none'))
	} else if (plea === 'late') {
		tiers.push(working.filter((candidate) => candidate.plea === 'late'))
		tiers.push(working.filter((candidate) => candidate.plea === 'early'))
		tiers.push(working.filter((candidate) => candidate.plea === 'none'))
	} else {
		tiers.push(working.filter((candidate) => candidate.plea === 'none'))
		tiers.push(working.filter((candidate) => candidate.plea !== 'none'))
	}

	return tiers.filter((tier) => tier.length > 0)
}

function startingPointSimilarity(a: number, b: number): number {
	return Math.min(a, b) / Math.max(a, b, 0.1)
}

function drugSimilarity(
	inputFamilies: Record<string, number>,
	candidate: RecommenderCaseRecord,
): number {
	const inputFamiliesEntries = Object.entries(inputFamilies).filter(
		([, quantity]) => quantity > 0,
	)
	const totalInputQuantity = inputFamiliesEntries.reduce(
		(sum, [, quantity]) => sum + quantity,
		0,
	)
	if (totalInputQuantity === 0) {
		return 0
	}

	let weightedSum = 0
	for (const [family, inputQuantity] of inputFamiliesEntries) {
		const candidateQuantity = candidate.drugs[family] ?? 0
		const ratio =
			candidateQuantity > 0
				? Math.min(inputQuantity, candidateQuantity) /
					Math.max(inputQuantity, candidateQuantity)
				: 0
		weightedSum += (inputQuantity / totalInputQuantity) * ratio
	}

	let extraDrugWeight = 0
	for (const family of DRUG_FAMILIES) {
		const candidateQuantity = candidate.drugs[family] ?? 0
		if (candidateQuantity > 0 && (inputFamilies[family] ?? 0) <= 0) {
			extraDrugWeight += candidateQuantity / totalInputQuantity
		}
	}

	return weightedSum / (1 + extraDrugWeight)
}

const DRUG_SIMILARITY_WEIGHT = 0.8
const STARTING_POINT_SIMILARITY_WEIGHT = 0.2

const MIN_SIMILARITY_SCORE = 0.6

export function pickSimilarCases(
	input: PredictionRequest,
	count = 10,
): Array<SimilarCase> {
	const inputStartingPoint = predictNotionalWeightedMonths(input.drugs)
	if (inputStartingPoint === null) {
		return []
	}
	const inputFamilies = drugFamilyAmounts(input)

	let pool: ReadonlyArray<RecommenderCaseRecord> = []
	for (const band of REQUESTED_FAMILY_ENFORCEMENT) {
		pool = filterByDrugs(recommenderCaseCorpus, inputFamilies, band, band === REQUESTED_FAMILY_ENFORCEMENT[0])
		if (pool.length >= count) {
			break
		}
	}
	if (pool.length < count) {
		pool = filterByDrugPresence(recommenderCaseCorpus, inputFamilies)
	}

	if (crossBorderSelected(input)) {
		pool = pool.filter((candidate) => candidate.crossBorder)
	}

	const candidates: Array<SimilarCase> = []
	const seen = new Set<string>()
	for (const tier of buildTiers(pool, input)) {
		for (const candidate of tier) {
			if (seen.has(candidate.neutralCitation)) {
				continue
			}
			seen.add(candidate.neutralCitation)
			candidates.push({
				neutralCitation: candidate.neutralCitation,
				title: candidate.title,
				url: candidate.url,
				score:
					DRUG_SIMILARITY_WEIGHT *
						drugSimilarity(inputFamilies, candidate) +
					STARTING_POINT_SIMILARITY_WEIGHT *
						startingPointSimilarity(
							inputStartingPoint,
							candidate.startingPointMonths,
						),
			})
		}
	}
	return candidates
		.filter((candidate) => candidate.score >= MIN_SIMILARITY_SCORE)
		.sort((a, b) => b.score - a.score)
		.slice(0, count)
}
