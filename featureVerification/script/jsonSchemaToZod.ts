import fs from 'node:fs'
import * as z from 'zod'

async function loadSchema() {
  console.log('Current working directory:', process.cwd())

  const judgementData = await fs.promises.readFile(
    '../jsonSchema/judgement.json',
    'utf-8',
  )
  const defendantsData = await fs.promises.readFile(
    '../jsonSchema/defendants.json',
    'utf-8',
  )
  const trialsData = await fs.promises.readFile(
    '../jsonSchema/trials.json',
    'utf-8',
  )

  const judgementSchema = z.fromJSONSchema(JSON.parse(judgementData))
  const defendantsSchema = z.fromJSONSchema(JSON.parse(defendantsData))
  const trialsSchema = z.fromJSONSchema(JSON.parse(trialsData))

  console.log('Judgement Schema:', judgementSchema)
  console.log('Defendants Schema:', defendantsSchema)
  console.log('Trials Schema:', trialsSchema)

  judgementSchema.safeParse({})
}

loadSchema()
