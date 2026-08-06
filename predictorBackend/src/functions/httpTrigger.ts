import { app as azureApp } from '@azure/functions'
import { azureHonoHandler } from '@marplex/hono-azurefunc-adapter'
import honoApp from '../app.js'

azureApp.http('httpTrigger', {
	methods: ['GET', 'POST', 'OPTIONS'],
	authLevel: 'anonymous',
	route: '{*proxy}',
	handler: azureHonoHandler(honoApp.fetch),
})
