export type GuidelineBucket = {
	lowQ: number
	highQ: number | null
	lowS: number
	highS: number | null
	kind: 'bounded' | 'discretionStart' | 'openUp' | 'discretionTop'
}

type FamilyEntry = {
	buckets: ReadonlyArray<GuidelineBucket>
}

// Verified drug labels -> bucket family. Fluorodeschloroketamine follows the
// Ketamine guidelines; THC/CBD follows the Cannabis / THC guidelines; Midazolam
// is measured in grams of narcotic weight, so it follows the powder guidelines.
const drugFamilyMap: Record<string, string> = {
	Cocaine: 'Cocaine',
	Ketamine: 'Ketamine',
	Fluorodeschloroketamine: 'Ketamine',
	Methamphetamine: 'Methamphetamine',
	Heroin: 'Heroin',
	'Cannabis/THC': 'Cannabis',
	Ecstasy: 'Ecstasy',
	Nimetazepam: 'Nimetazepam',
	Midazolam: 'Midazolam-powder',
}

export function drugFamilyFor(
	type: string
): string | null {
	return drugFamilyMap[type] ?? null
}

// Guideline buckets. Quantity bounds in grams, sentence bounds in months.
// kinds:
//   bounded          - quantity range and sentence range both finite
//   discretionStart  - no guideline range below the first band
//   openUp           - sentence floor only ("X months upwards")
//   discretionTop    - "at the sentencer's discretion", practical ceiling 35 years
const guidelineBuckets: Record<string, FamilyEntry> = {
	Cocaine: {
		buckets: [
			{ lowQ: 0, highQ: 10, lowS: 24, highS: 60, kind: 'bounded' },
			{ lowQ: 10, highQ: 50, lowS: 60, highS: 96, kind: 'bounded' },
			{ lowQ: 50, highQ: 200, lowS: 96, highS: 144, kind: 'bounded' },
			{ lowQ: 200, highQ: 500, lowS: 144, highS: 192, kind: 'bounded' },
			{ lowQ: 500, highQ: 1500, lowS: 192, highS: 240, kind: 'bounded' },
			{ lowQ: 1500, highQ: 5000, lowS: 240, highS: 288, kind: 'bounded' },
			{ lowQ: 5000, highQ: 15000, lowS: 288, highS: 324, kind: 'bounded' },
			{ lowQ: 15000, highQ: 30000, lowS: 324, highS: 360, kind: 'bounded' },
			{ lowQ: 30000, highQ: null, lowS: 0, highS: 420, kind: 'discretionTop' },
		],
	},
	Ketamine: {
		buckets: [
			{ lowQ: 0, highQ: 1, lowS: 0, highS: 24, kind: 'discretionStart' },
			{ lowQ: 1, highQ: 10, lowS: 24, highS: 48, kind: 'bounded' },
			{ lowQ: 10, highQ: 50, lowS: 48, highS: 72, kind: 'bounded' },
			{ lowQ: 50, highQ: 300, lowS: 72, highS: 108, kind: 'bounded' },
			{ lowQ: 300, highQ: 600, lowS: 108, highS: 144, kind: 'bounded' },
			{ lowQ: 600, highQ: 1000, lowS: 144, highS: 168, kind: 'bounded' },
			{ lowQ: 1000, highQ: 2000, lowS: 168, highS: 216, kind: 'bounded' },
			{ lowQ: 2000, highQ: 3000, lowS: 216, highS: 240, kind: 'bounded' },
			{ lowQ: 3000, highQ: null, lowS: 240, highS: null, kind: 'openUp' },
		],
	},
	Methamphetamine: {
		buckets: [
			{ lowQ: 0, highQ: 10, lowS: 36, highS: 84, kind: 'bounded' },
			{ lowQ: 10, highQ: 70, lowS: 84, highS: 132, kind: 'bounded' },
			{ lowQ: 70, highQ: 300, lowS: 132, highS: 180, kind: 'bounded' },
			{ lowQ: 300, highQ: 600, lowS: 180, highS: 216, kind: 'bounded' },
			{ lowQ: 600, highQ: 1500, lowS: 216, highS: 240, kind: 'bounded' },
			{ lowQ: 1500, highQ: 5000, lowS: 240, highS: 288, kind: 'bounded' },
			{ lowQ: 5000, highQ: 15000, lowS: 288, highS: 324, kind: 'bounded' },
			{ lowQ: 15000, highQ: 30000, lowS: 324, highS: 360, kind: 'bounded' },
			{ lowQ: 30000, highQ: null, lowS: 0, highS: 420, kind: 'discretionTop' },
		],
	},
	Heroin: {
		buckets: [
			{ lowQ: 0, highQ: 10, lowS: 24, highS: 60, kind: 'bounded' },
			{ lowQ: 10, highQ: 50, lowS: 60, highS: 96, kind: 'bounded' },
			{ lowQ: 50, highQ: 200, lowS: 96, highS: 144, kind: 'bounded' },
			{ lowQ: 200, highQ: 500, lowS: 144, highS: 192, kind: 'bounded' },
			{ lowQ: 500, highQ: 1500, lowS: 192, highS: 240, kind: 'bounded' },
			{ lowQ: 1500, highQ: 5000, lowS: 240, highS: 288, kind: 'bounded' },
			{ lowQ: 5000, highQ: 15000, lowS: 288, highS: 324, kind: 'bounded' },
			{ lowQ: 15000, highQ: 30000, lowS: 324, highS: 360, kind: 'bounded' },
			{ lowQ: 30000, highQ: null, lowS: 0, highS: 420, kind: 'discretionTop' },
		],
	},
	Cannabis: {
		buckets: [
			{ lowQ: 0, highQ: 2000, lowS: 0, highS: 16, kind: 'bounded' },
			{ lowQ: 2000, highQ: 3000, lowS: 16, highS: 24, kind: 'bounded' },
			{ lowQ: 3000, highQ: 6000, lowS: 24, highS: 36, kind: 'bounded' },
			{ lowQ: 6000, highQ: 9000, lowS: 36, highS: 48, kind: 'bounded' },
			{ lowQ: 9000, highQ: 15000, lowS: 48, highS: 66, kind: 'bounded' },
			{ lowQ: 15000, highQ: 45000, lowS: 66, highS: 96, kind: 'bounded' },
			{ lowQ: 45000, highQ: 90000, lowS: 96, highS: 120, kind: 'bounded' },
			{ lowQ: 90000, highQ: null, lowS: 120, highS: null, kind: 'openUp' },
		],
	},
	Ecstasy: {
		buckets: [
			{ lowQ: 0, highQ: 1, lowS: 0, highS: 24, kind: 'discretionStart' },
			{ lowQ: 1, highQ: 10, lowS: 24, highS: 48, kind: 'bounded' },
			{ lowQ: 10, highQ: 50, lowS: 48, highS: 72, kind: 'bounded' },
			{ lowQ: 50, highQ: 300, lowS: 72, highS: 108, kind: 'bounded' },
			{ lowQ: 300, highQ: 600, lowS: 108, highS: 144, kind: 'bounded' },
			{ lowQ: 600, highQ: 1000, lowS: 144, highS: 168, kind: 'bounded' },
			{ lowQ: 1000, highQ: 2000, lowS: 168, highS: 216, kind: 'bounded' },
			{ lowQ: 2000, highQ: 3000, lowS: 216, highS: 240, kind: 'bounded' },
			{ lowQ: 3000, highQ: null, lowS: 240, highS: null, kind: 'openUp' },
		],
	},
	Nimetazepam: {
		buckets: [
			{ lowQ: 0, highQ: 1, lowS: 0, highS: 24, kind: 'discretionStart' },
			{ lowQ: 1, highQ: 10, lowS: 24, highS: 48, kind: 'bounded' },
			{ lowQ: 10, highQ: 50, lowS: 48, highS: 72, kind: 'bounded' },
			{ lowQ: 50, highQ: 300, lowS: 72, highS: 108, kind: 'bounded' },
			{ lowQ: 300, highQ: 600, lowS: 108, highS: 144, kind: 'bounded' },
			{ lowQ: 600, highQ: 1000, lowS: 144, highS: 168, kind: 'bounded' },
			{ lowQ: 1000, highQ: 2000, lowS: 168, highS: 216, kind: 'bounded' },
			{ lowQ: 2000, highQ: 3000, lowS: 216, highS: 240, kind: 'bounded' },
			{ lowQ: 3000, highQ: null, lowS: 240, highS: null, kind: 'openUp' },
		],
	},
	'Midazolam-powder': {
		buckets: [
			{ lowQ: 0, highQ: 500, lowS: 0, highS: 6, kind: 'discretionStart' },
			{ lowQ: 500, highQ: 1000, lowS: 6, highS: 12, kind: 'bounded' },
			{ lowQ: 1000, highQ: 2000, lowS: 12, highS: 24, kind: 'bounded' },
			{ lowQ: 2000, highQ: 3000, lowS: 24, highS: 36, kind: 'bounded' },
			{ lowQ: 3000, highQ: 6000, lowS: 36, highS: 54, kind: 'bounded' },
			{ lowQ: 6000, highQ: 9000, lowS: 54, highS: 72, kind: 'bounded' },
			{ lowQ: 9000, highQ: null, lowS: 72, highS: null, kind: 'openUp' },
		],
	},
}

function interpolate(
	bucket: GuidelineBucket,
	quantity: number,
	previousHighS: number | null,
): number {
	if (bucket.highQ !== null && bucket.highS !== null) {
		const u = (quantity - bucket.lowQ) / (bucket.highQ - bucket.lowQ)
		return bucket.lowS + u * (bucket.highS - bucket.lowS)
	}
	if (bucket.kind === 'discretionTop' && previousHighS !== null) {
		return previousHighS
	}
	return bucket.lowS
}

export function predictStartingPointMonths(
	type: string,
	quantity: number,
): number | null {
	const family = drugFamilyFor(type)
	if (family === null) {
		return null
	}
	const entry = guidelineBuckets[family]
	let previousHighS: number | null = null
	for (const bucket of entry.buckets) {
		if (bucket.highQ !== null) {
			if (quantity >= bucket.lowQ && quantity < bucket.highQ) {
				return interpolate(bucket, quantity, previousHighS)
			}
		} else if (quantity >= bucket.lowQ) {
			return interpolate(bucket, quantity, previousHighS)
		}
		if (bucket.highS !== null) {
			previousHighS = bucket.highS
		}
	}
	return null
}

export type GuidelineDrugInput = {
	type: string
	quantity: number
	variant?: 'powder'
}

// HK notional-quantity method: for each drug, take the sentence the *total*
// quantity would attract in that drug's family, weight it by the drug's share
// of the total quantity, and sum. Returns null if any drug is unsupported.
export function predictNotionalWeightedMonths(
	drugs: ReadonlyArray<GuidelineDrugInput>,
): number | null {
	const total = drugs.reduce((sum, drug) => sum + drug.quantity, 0)
	if (total <= 0) {
		return 0
	}
	let startingPoint = 0
	for (const drug of drugs) {
		const sentenceAtTotal = predictStartingPointMonths(
			drug.type,
			total
		)
		if (sentenceAtTotal === null) {
			return null
		}
		startingPoint += sentenceAtTotal * (drug.quantity / total)
	}
	return startingPoint
}
