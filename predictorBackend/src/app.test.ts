import { describe, expect, it } from 'vitest'
import app from './app.js'

const baseRequest = {
	drugs: [{ type: 'Cocaine', quantity: 10 }],
	guiltyPlea: 'Plead not guilty',
	aggravatingFactors: [],
	mitigatingFactors: [],
}

async function post(body: unknown, path = '/api/sentence-predictions') {
	return app.request(path, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	})
}

describe('predictor API', () => {
	it('returns a healthy status', async () => {
		const response = await app.request('/api/health')

		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ status: 'ok' })
	})

	it('returns a deterministic single-drug prediction', async () => {
		const response = await post({
			...baseRequest,
			defendantRole: 'Actual trafficker',
			guiltyPlea: 'Plead guilty (earliest opportunity)',
			aggravatingFactors: ['Multiple Drugs'],
			mitigatingFactors: ['Assistance - useful'],
		})
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body).toMatchObject({
			status: 'supported',
			startingPointMonths: 60,
			startingPointYears: 5,
			finalSentenceMonths: 37.64,
			finalSentenceYears: 3.14,
		})
		expect(body.adjustments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					factor: 'Actual trafficker',
					category: 'defendantRole',
					direction: 'increase',
				}),
				expect.objectContaining({
					factor: 'Plead guilty (earliest opportunity)',
					category: 'guiltyPlea',
					direction: 'decrease',
				}),
			]),
		)
	})

	it('applies plea and assistance reductions non-compounding from the notional sentence', async () => {
		const response = await post({
			...baseRequest,
			guiltyPlea: 'Plead guilty (first day of trial)',
			mitigatingFactors: ['Assistance - risk'],
		})
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.startingPointMonths).toBe(60)
		expect(body.finalSentenceMonths).toBe(28.5)
		expect(body.finalSentenceYears).toBe(2.38)
		const plea = body.adjustments.find(
			(adjustment: { factor: string }) =>
				adjustment.factor === 'Plead guilty (first day of trial)',
		)
		const assistance = body.adjustments.find(
			(adjustment: { factor: string }) => adjustment.factor === 'Assistance - risk',
		)
		expect(plea.months).toBe(12)
		expect(assistance.months).toBe(19.5)
		expect(plea.baseMonths).toBe(60)
		expect(assistance.baseMonths).toBe(60)
	})

	it('supports multiple drugs and Fluorodeschloroketamine', async () => {
		const response = await post({
			...baseRequest,
			drugs: [
				{ type: 'Fluorodeschloroketamine', quantity: 2 },
				{ type: 'Heroin', quantity: 1 },
			],
		})
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.startingPointMonths).toBe(31.16)
	})

	// it('supports Midazolam powder and rejects the tablet variant', async () => {
	// 	const powderResponse = await post({
	// 		...baseRequest,
	// 		drugs: [{ type: 'Midazolam', quantity: 2, variant: 'powder' }],
	// 	})
	// 	const tabletResponse = await post({
	// 		...baseRequest,
	// 		drugs: [{ type: 'Midazolam', quantity: 2, variant: 'tablet' }],
	// 	})

	// 	expect((await powderResponse.json()).startingPointMonths).toBe(0.02)
	// 	expect(tabletResponse.status).toBe(400)
	// })

	it('applies role and cross-border adjustments', async () => {
		const response = await post({
			...baseRequest,
			defendantRole: 'Courier / Storekeeper',
			additionalCircumstances: ['Cross-border trafficking'],
		})
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.finalSentenceMonths).toBe(63.53)
		expect(body.adjustments).toEqual(
			expect.arrayContaining([
			expect.objectContaining({
				factor: 'Courier / Storekeeper',
				months: 0,
			}),
			expect.objectContaining({
				factor: 'Cross-border trafficking',
				category: 'aggravating',
			}),
		]),
		)
	})

	it('returns JSON validation errors', async () => {
		const response = await post({
			...baseRequest,
			drugs: [{ type: 'Cocaine', quantity: 0 }],
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({
			error: 'VALIDATION_ERROR',
			fields: {
				'drugs.0.quantity': 'Too small: expected number to be >0',
			},
		})
	})

	it('rejects invalid drug types and negative quantities', async () => {
		const invalidTypeResponse = await post({
			...baseRequest,
			drugs: [{ type: 'Unknown', quantity: 1 }],
		})
		const negativeQuantityResponse = await post({
			...baseRequest,
			drugs: [{ type: 'Cocaine', quantity: -1 }],
		})

		expect(invalidTypeResponse.status).toBe(400)
		expect(negativeQuantityResponse.status).toBe(400)
	})

	// it('rejects invalid Midazolam and factor combinations', async () => {
	// 	const missingVariantResponse = await post({
	// 		...baseRequest,
	// 		drugs: [{ type: 'Midazolam', quantity: 2 }],
	// 	})
	// 	const nonMidazolamVariantResponse = await post({
	// 		...baseRequest,
	// 		drugs: [{ type: 'Cocaine', quantity: 2, variant: 'powder' }],
	// 	})
	// 	const assistanceResponse = await post({
	// 		...baseRequest,
	// 		mitigatingFactors: ['Assistance - limited', 'Assistance - useful'],
	// 	})
	// 	const duplicateFactorResponse = await post({
	// 		...baseRequest,
	// 		aggravatingFactors: ['On bail', 'On bail'],
	// 	})

	// 	expect(missingVariantResponse.status).toBe(400)
	// 	expect(nonMidazolamVariantResponse.status).toBe(400)
	// 	expect(assistanceResponse.status).toBe(400)
	// 	expect(duplicateFactorResponse.status).toBe(400)
	// })

	it('rejects unsupported circumstances without a role', async () => {
		const response = await post({
			...baseRequest,
			additionalCircumstances: ['Cross-border trafficking'],
		})

		expect(response.status).toBe(400)
	})

	it('rejects legacy circumstances and mitigating factors', async () => {
		const circumstanceResponse = await post({
			...baseRequest,
			defendantRole: 'Actual trafficker',
			additionalCircumstances: ['Divan keeping'],
		})
		const mitigatingFactorResponse = await post({
			...baseRequest,
			mitigatingFactors: ['Extreme youth'],
		})

		expect(circumstanceResponse.status).toBe(400)
		expect(mitigatingFactorResponse.status).toBe(400)
	})

	it('handles malformed JSON with a JSON error response', async () => {
		const response = await app.request('/api/sentence-predictions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{',
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({
			error: 'VALIDATION_ERROR',
		})
	})

	it('returns a list of similar cases', async () => {
		const response = await post(baseRequest, '/api/similar-cases')
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(Array.isArray(body)).toBe(true)
		expect(body.length).toBeGreaterThan(0)
		expect(body.length).toBeLessThanOrEqual(10)
		for (const item of body) {
			expect(item).toMatchObject({
				neutralCitation: expect.any(String),
				title: expect.any(String),
				url: expect.any(String),
				score: expect.any(Number),
			})
			expect(item.score).toBeGreaterThanOrEqual(0.6)
			expect(item.score).toBeLessThanOrEqual(1)
		}
		for (let i = 1; i < body.length; i++) {
			expect(body[i].score).toBeLessThanOrEqual(body[i - 1].score)
		}
	})

	it('ranks multi-drug similar cases by drug profile, not coincidental sentence length', async () => {
		const response = await post(
			{
				drugs: [
					{ type: 'Cocaine', quantity: 50 },
					{ type: 'Heroin', quantity: 50 },
				],
				guiltyPlea: 'Plead not guilty',
				aggravatingFactors: [],
				mitigatingFactors: [],
			},
			'/api/similar-cases',
		)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.length).toBeGreaterThan(0)
		for (const item of body) {
			expect(item.neutralCitation).not.toBe('[2025] HKCFI 6413')
		}
	})

	it('validates the similar-cases request body', async () => {
		const response = await post(
			{ drugs: [{ type: 'Unknown', quantity: 1 }], guiltyPlea: 'Plead not guilty' },
			'/api/similar-cases',
		)

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({
			error: 'VALIDATION_ERROR',
		})
	})
})
