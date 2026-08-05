import { describe, expect, it } from 'vitest'
import { app } from './app.js'

const baseRequest = {
	drugs: [{ type: 'Cocaine', quantity: 10 }],
	guiltyPlea: 'Plead not guilty',
	aggravatingFactors: [],
	mitigatingFactors: [],
}

async function post(body: unknown, origin = 'http://localhost:3000') {
	return app.request('/api/v1/sentence-predictions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Origin: origin,
		},
		body: JSON.stringify(body),
	})
}

describe('predictor API', () => {
	it('returns a healthy status', async () => {
		const response = await app.request('/health')

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
			startingPointMonths: 20,
			startingPointYears: 1.67,
			finalSentenceMonths: 12.38,
			finalSentenceYears: 1.03,
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
		expect(body.startingPointMonths).toBe(6)
	})

	it('supports both Midazolam variants', async () => {
		const powderResponse = await post({
			...baseRequest,
			drugs: [{ type: 'Midazolam', quantity: 2, variant: 'powder' }],
		})
		const tabletResponse = await post({
			...baseRequest,
			drugs: [{ type: 'Midazolam', quantity: 2, variant: 'tablet' }],
		})

		expect((await powderResponse.json()).startingPointMonths).toBe(2.5)
		expect((await tabletResponse.json()).startingPointMonths).toBe(3)
	})

	it('applies role and cross-border adjustments', async () => {
		const response = await post({
			...baseRequest,
			defendantRole: 'Courier / Storekeeper',
			additionalCircumstances: ['Cross-border trafficking'],
		})
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.finalSentenceMonths).toBe(21)
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

	it('rejects invalid Midazolam and factor combinations', async () => {
		const missingVariantResponse = await post({
			...baseRequest,
			drugs: [{ type: 'Midazolam', quantity: 2 }],
		})
		const nonMidazolamVariantResponse = await post({
			...baseRequest,
			drugs: [{ type: 'Cocaine', quantity: 2, variant: 'powder' }],
		})
		const assistanceResponse = await post({
			...baseRequest,
			mitigatingFactors: ['Assistance - limited', 'Assistance - useful'],
		})
		const duplicateFactorResponse = await post({
			...baseRequest,
			aggravatingFactors: ['On bail', 'On bail'],
		})

		expect(missingVariantResponse.status).toBe(400)
		expect(nonMidazolamVariantResponse.status).toBe(400)
		expect(assistanceResponse.status).toBe(400)
		expect(duplicateFactorResponse.status).toBe(400)
	})

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
		const response = await app.request('/api/v1/sentence-predictions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{',
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toMatchObject({
			error: 'VALIDATION_ERROR',
		})
	})

	it('allows the configured frontend origin through CORS', async () => {
		const response = await post(baseRequest)

		expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
			'http://localhost:3000',
		)
	})

	it('does not allow an unrelated origin through CORS', async () => {
		const response = await post(baseRequest, 'https://example.invalid')

		expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
	})
})
