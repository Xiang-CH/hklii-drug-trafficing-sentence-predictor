import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import {
	predictSentence,
	UnsupportedPredictionError,
} from './predictor.js'
import { PredictionRequestSchema } from './schema.js'

const frontendOrigin =
	process.env.FRONTEND_ORIGIN?.trim() || 'http://localhost:3000'

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
		error: 'VALIDATION_ERROR',
		message: 'The request body is invalid',
		fields,
	}
}

export const app = new Hono()

app.use('*', logger())
app.use(
	'*',
	cors({
		origin: (origin) =>
			origin === frontendOrigin ? origin : undefined,
		allowHeaders: ['Content-Type'],
		allowMethods: ['GET', 'POST', 'OPTIONS'],
	}),
)

app.get('/health', (context) => context.json({ status: 'ok' }))

app.post(
	'/api/v1/sentence-predictions',
	zValidator('json', PredictionRequestSchema, (result, context) => {
		if (!result.success) {
			return context.json(validationResponse(result.error), 400)
		}
	}),
	(context) => {
		try {
			return context.json(predictSentence(context.req.valid('json')))
		} catch (error) {
			if (error instanceof UnsupportedPredictionError) {
				return context.json(
					{
						error: error.code,
						message: error.message,
					},
					422,
				)
			}
			throw error
		}
	},
)

app.notFound((context) =>
	context.json(
		{
			error: 'NOT_FOUND',
			message: 'Route not found',
		},
		404,
	),
)

app.onError((error, context) => {
	if (error instanceof HTTPException && error.status === 400) {
		return context.json(
			{
				error: 'VALIDATION_ERROR',
				message: 'The request body is invalid',
			},
			400,
		)
	}

	console.error(error)
	return context.json(
		{
			error: 'INTERNAL_ERROR',
			message: 'The prediction could not be calculated',
		},
		500,
	)
})
