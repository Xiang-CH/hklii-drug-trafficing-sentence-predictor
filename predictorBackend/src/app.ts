import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { swaggerUI } from '@hono/swagger-ui'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { Hono } from 'hono'
import {
	predictSentence,
	UnsupportedPredictionError,
} from './predictor.js'
import { pickSimilarCases } from './similarCases.js'
import { PredictionRequestSchema } from './schema.js'

function validationResponse(
	error: { issues: Array<{ path: Array<PropertyKey>; message: string }> },
) {
	const fields: Record<string, string> = {}
	for (const issue of error.issues) {
		const field = issue.path.length
			? issue.path.map(String).join('.')
			: 'body'
		fields[field] = issue.message
	}
	return {
		error: 'VALIDATION_ERROR' as const,
		message: 'The request body is invalid',
		fields,
	}
}

const HealthResponseSchema = z
	.object({
		status: z.literal('ok'),
	})
	.openapi('HealthResponse')

const PredictionAdjustmentSchema = z
	.object({
		factor: z.string(),
		category: z.enum([
			'defendantRole',
			'aggravating',
			'mitigating',
			'guiltyPlea',
		]),
		direction: z.enum(['increase', 'decrease']),
		months: z.number(),
		years: z.number(),
	})
	.openapi('PredictionAdjustment')

const PredictionResponseSchema = z
	.object({
		status: z.literal('supported'),
		startingPointMonths: z.number(),
		startingPointYears: z.number(),
		adjustments: z.array(PredictionAdjustmentSchema),
		finalSentenceMonths: z.number(),
		finalSentenceYears: z.number(),
	})
	.openapi('PredictionResponse')

const SimilarCaseSchema = z
	.object({
		neutralCitation: z.string(),
		title: z.string(),
		url: z.string(),
		score: z.number().min(0).max(1),
	})
	.openapi('SimilarCase')

const SimilarCasesResponseSchema = z
	.array(SimilarCaseSchema)
	.openapi('SimilarCasesResponse')

const ValidationErrorSchema = z
	.object({
		error: z.literal('VALIDATION_ERROR'),
		message: z.string(),
		fields: z.record(z.string(), z.string()),
	})
	.openapi('ValidationError')

const UnsupportedPredictionSchema = z
	.object({
		error: z.literal('MODEL_INPUT_UNAVAILABLE'),
		message: z.string(),
	})
	.openapi('UnsupportedPredictionError')

const InternalErrorSchema = z
	.object({
		error: z.literal('INTERNAL_ERROR'),
		message: z.string(),
	})
	.openapi('InternalError')

const healthRoute = createRoute({
	method: 'get',
	path: '/api/health',
	responses: {
		200: {
			description: 'Service health status',
			content: {
				'application/json': {
					schema: HealthResponseSchema,
				},
			},
		},
	},
})

const predictionRoute = createRoute({
	method: 'post',
	path: '/api/sentence-predictions',
	request: {
		body: {
			required: true,
			content: {
				'application/json': {
					schema: PredictionRequestSchema.openapi('PredictionRequest'),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'A deterministic sentence prediction',
			content: {
				'application/json': {
					schema: PredictionResponseSchema,
				},
			},
		},
		400: {
			description: 'The request body is invalid',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		422: {
			description: 'The dummy predictor cannot handle the requested input',
			content: {
				'application/json': {
					schema: UnsupportedPredictionSchema,
				},
			},
		},
		500: {
			description: 'An unexpected server error occurred',
			content: {
				'application/json': {
					schema: InternalErrorSchema,
				},
			},
		},
	},
})

const similarCasesRoute = createRoute({
	method: 'post',
	path: '/api/similar-cases',
	request: {
		body: {
			required: true,
			content: {
				'application/json': {
					schema: PredictionRequestSchema.openapi('PredictionRequest'),
				},
			},
		},
	},
	responses: {
		200: {
			description: 'A list of recommended similar cases',
			content: {
				'application/json': {
					schema: SimilarCasesResponseSchema,
				},
			},
		},
		400: {
			description: 'The request body is invalid',
			content: {
				'application/json': {
					schema: ValidationErrorSchema,
				},
			},
		},
		500: {
			description: 'An unexpected server error occurred',
			content: {
				'application/json': {
					schema: InternalErrorSchema,
				},
			},
		},
	},
})

const app = new Hono()
const api = new OpenAPIHono()

api.use('*', cors())
api.use('*', logger())

api.openapi(healthRoute, (context) =>
	context.json({ status: 'ok' }, 200),
)

api.openapi(
	predictionRoute,
	(context) => {
		try {
			return context.json(predictSentence(context.req.valid('json')), 200)
		} catch (error) {
			if (error instanceof UnsupportedPredictionError) {
				return context.json(
					{
						error: 'MODEL_INPUT_UNAVAILABLE' as const,
						message: error.message,
					},
					422,
				)
			}
			throw error
		}
	},
	(result, context) => {
		if (!result.success) {
			return context.json(validationResponse(result.error), 400)
		}
	},
)

api.openapi(
	similarCasesRoute,
	(context) => {
		return context.json(pickSimilarCases(context.req.valid('json')), 200)
	},
	(result, context) => {
		if (!result.success) {
			return context.json(validationResponse(result.error), 400)
		}
	},
)

api.doc('/openapi.json', {
	openapi: '3.0.0',
	info: {
		title: 'Drug Sentencing Predictor API',
		version: '1.0.0',
		description:
			'Public API for the deterministic sentence-prediction prototype.',
	}
})

api.get('/docs', swaggerUI({ url: '/openapi.json' }))

api.notFound((context) =>
	context.json(
		{
			error: 'NOT_FOUND',
			message: 'Route not found',
		},
		404,
	),
)

api.onError((error, context) => {
	if (error instanceof HTTPException && error.status === 400) {
		return context.json(
			{
				error: 'VALIDATION_ERROR',
				message: 'The request body is invalid',
				fields: {},
			},
			400,
		)
	}

	console.error(error)
	return context.json(
		{
			error: 'INTERNAL_ERROR',
			message: 'The request could not be processed',
		},
		500,
	)
})

app.route('/', api)
export default app