import { MongoClient } from 'mongodb'
import { attachDatabasePool } from '@vercel/functions'
import type { MongoClientOptions } from 'mongodb'

const options: MongoClientOptions = {
  appName: 'Drug Trafficking Sentence Predictor',
  maxIdleTimeMS: 5000,
}
const client = new MongoClient(process.env.DB_MONGODB_URI ?? '', options)

// Attach the client to ensure proper cleanup on function suspension
attachDatabasePool(client)

const db = client.db(process.env.DB_NAME || 'drug-sentencing-predictor')

export { client, db }
