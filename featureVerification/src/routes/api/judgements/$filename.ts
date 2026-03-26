import { createFileRoute } from '@tanstack/react-router'
import { ObjectId } from 'mongodb'
import { username } from 'better-auth/plugins'
import { db } from '@/lib/db'
import { authMiddleware } from '@/middleware/auth'

export type JudgementDetail = {
  id: string
  filename: string
  trial?: string
  appeal?: string
  corrigendum?: string
  year?: string
  trial_html: string
  appeal_html?: string
  corrigendum_html?: string
  updatedAt?: string
  assignee?: string
  assigneeUsername?: string
  status: 'pending' | 'in_progress' | 'verified'
  extractedData?: {
    judgement: unknown
    defendants: unknown
    trials: unknown
    extractedId: string
  } | null
  verifiedData?: {
    id: string
    sourceJudgementId?: string
    sourceLlmExtractionId?: string
    isVerified: boolean
    verifiedBy?: string
    verifierUsername?: string
    judgement: unknown
    defendants: unknown
    trials: unknown
    remarks?: string
    exclude?: boolean
  } | null
}

export const Route = createFileRoute('/api/judgements/$filename')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ params }) => {
        const judgementsCollection = db.collection('judgement-html')
        const extractedCollection = db.collection('llm-extracted-features')
        const verifiedCollection = db.collection('verified-features')
        const usersCollection = db.collection('user')
        const doc = await judgementsCollection.findOne({
          filename: params.filename,
        })

        if (!doc) {
          return new Response('Not found', { status: 404 })
        }

        const extractedDoc = await extractedCollection.findOne({
          source_judgement_id: doc._id,
        })

        const verifiedDoc = await verifiedCollection.findOne(
          { source_judgement_id: doc._id },
          { sort: { updated_at: -1, verified_at: -1, _id: -1 } },
        )

        const verifierId =
          verifiedDoc?.verified_by instanceof ObjectId
            ? verifiedDoc.verified_by
            : typeof verifiedDoc?.verified_by === 'string' &&
                ObjectId.isValid(verifiedDoc.verified_by)
              ? new ObjectId(verifiedDoc.verified_by)
              : null

        const verifier = verifierId
          ? await usersCollection.findOne(
              { _id: verifierId },
              { projection: { name: 1, username: 1 } },
            )
          : null

        const assigneeId =
          doc.assigned_to instanceof ObjectId
            ? doc.assigned_to
            : typeof doc.assigned_to === 'string' &&
                ObjectId.isValid(doc.assigned_to)
              ? new ObjectId(doc.assigned_to)
              : null

        const assignee = assigneeId
          ? await usersCollection.findOne(
              { _id: assigneeId },
              { projection: { name: 1, username: 1 } },
            )
          : null

        const status = verifiedDoc
          ? verifiedDoc.is_verified === true
            ? 'verified'
            : 'in_progress'
          : 'pending'

        // Return the judgement data
        return Response.json({
          id: doc._id.toString(),
          filename: doc.filename,
          trial: doc.trial,
          appeal: doc.appeal,
          corrigendum: doc.corrigendum,
          year: doc.year,
          trial_html: doc.html,
          appeal_html: doc.appeal_html,
          corrigendum_html: doc.corrigendum_html,
          updatedAt: doc.updatedAt?.toString() ?? doc.updated_at?.toString(),
          assignee: assignee?.name || doc.assigned_to,
          assigneeUsername: assignee?.username || undefined,
          status,
          extractedData: extractedDoc
            ? {
                judgement: extractedDoc.judgement,
                defendants: extractedDoc.defendants,
                trials: extractedDoc.trials,
                extractedId:
                  extractedDoc._id instanceof ObjectId
                    ? extractedDoc._id.toHexString()
                    : String(extractedDoc._id),
              }
            : null,
          verifiedData: verifiedDoc
            ? {
                id:
                  verifiedDoc._id instanceof ObjectId
                    ? verifiedDoc._id.toHexString()
                    : String(verifiedDoc._id),
                sourceJudgementId:
                  verifiedDoc.source_judgement_id instanceof ObjectId
                    ? verifiedDoc.source_judgement_id.toHexString()
                    : undefined,
                sourceLlmExtractionId:
                  verifiedDoc.source_llm_extraction_id instanceof ObjectId
                    ? verifiedDoc.source_llm_extraction_id.toHexString()
                    : undefined,
                isVerified: verifiedDoc.is_verified === true,
                judgement: verifiedDoc.judgement,
                defendants: verifiedDoc.defendants,
                trials: verifiedDoc.trials,
                remarks: verifiedDoc.remarks,
                exclude: verifiedDoc.exclude,
                verifiedBy:
                  verifier?.name ||
                  (verifiedDoc.verified_by instanceof ObjectId
                    ? verifiedDoc.verified_by.toHexString()
                    : typeof verifiedDoc.verified_by === 'string'
                      ? verifiedDoc.verified_by
                      : undefined),
                verifierUsername: verifier?.username || undefined,
              }
            : null,
        } satisfies JudgementDetail)
      },
    },
  },
})
