import { createFileRoute } from '@tanstack/react-router'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/db'
import { authMiddleware } from '@/middleware/auth'

export type JudgementListItem = {
  id: string
  filename: string
  trial: string
  appeal?: string
  corrigendum?: string
  year?: string
  processed: boolean
  verified?: boolean
  updatedAt?: string
  assignee?: {
    username: string
    name: string
  }
  verifiedBy?: {
    username: string
    name: string
  }
}

const PAGE_SIZE = 20

export const Route = createFileRoute('/api/judgements/$')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(
          request.url.startsWith('http')
            ? request.url
            : `http://dummy${request.url}`,
        )
        const page = Math.max(parseInt(url.searchParams.get('page') ?? '1'), 1)
        const status = url.searchParams.get('status') ?? 'all'
        const search =
          url.searchParams
            .get('search')
            ?.trim()
            .replace('[', '\\[')
            .replace(']', '\\]') ?? null

        const judgementsCollection = db.collection('judgement-html')
        const extractedCollection = db.collection('llm-extracted-features')
        const verifiedCollection = db.collection('verified-features')

        const normalizeId = (value: unknown) =>
          value instanceof ObjectId ? value.toHexString() : String(value)

        const toObjectId = (value: unknown): ObjectId | null => {
          if (value instanceof ObjectId) {
            return value
          }
          if (typeof value === 'string' && ObjectId.isValid(value)) {
            return new ObjectId(value)
          }
          return null
        }

        const match: Record<string, unknown> = {}
        if (search) {
          match.$or = [
            { trial: { $regex: search, $options: 'i' } },
            { appeal: { $regex: search, $options: 'i' } },
            { corrigendum: { $regex: search, $options: 'i' } },
            { filename: { $regex: search, $options: 'i' } },
          ]
        }

        const extractedIds = await extractedCollection.distinct(
          'source_judgement_id',
        )
        const processedIds = extractedIds
          .filter(Boolean)
          .map((id) => (id instanceof ObjectId ? id : new ObjectId(id)))

        const verifiedIds = await verifiedCollection.distinct(
          'source_judgement_id',
        )
        const verifiedObjectIds = verifiedIds
          .filter(Boolean)
          .map((id) => (id instanceof ObjectId ? id : new ObjectId(id)))

        if (status === 'processed') {
          match._id = { $in: processedIds }
        }
        if (status === 'verified') {
          match._id = { $in: verifiedObjectIds }
        }
        if (status === 'unprocessed') {
          match._id = { $nin: [...processedIds, ...verifiedObjectIds] }
        }

        const total = await judgementsCollection.countDocuments(match)
        const assigneeIds = await judgementsCollection.distinct('assigned_to')
        const verifierIds = await verifiedCollection.distinct('verified_by', {
          is_verified: true,
        })

        const userObjectIds = Array.from(
          new Set(
            [...assigneeIds, ...verifierIds]
              .map((id) => toObjectId(id)?.toHexString())
              .filter((id): id is string => Boolean(id)),
          ),
        ).map((id) => new ObjectId(id))

        const users = await db
          .collection('user')
          .find({ _id: { $in: userObjectIds } })
          .toArray()

        const userMap = users.reduce(
          (acc, user) => {
            acc[user._id.toHexString()] = {
              username: user.username,
              name: user.name,
            }
            return acc
          },
          {} as Record<string, { username: string; name: string }>,
        )

        const cursor = judgementsCollection
          .find(match)
          .sort({ year: -1, trial: 1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)

        const docs = await cursor.toArray()

        const verificationDocs = await verifiedCollection
          .find(
            {
              is_verified: true,
              source_judgement_id: { $in: docs.map((doc) => doc._id) },
            },
            {
              projection: {
                source_judgement_id: 1,
                verified_by: 1,
                updated_at: 1,
                verified_at: 1,
              },
            },
          )
          .sort({ updated_at: -1, verified_at: -1, _id: -1 })
          .toArray()

        const verifierByJudgementMap = new Map<string, string>()
        for (const doc of verificationDocs) {
          if (!doc.verified_by) {
            continue
          }
          const judgementId = normalizeId(doc.source_judgement_id)
          if (!verifierByJudgementMap.has(judgementId)) {
            verifierByJudgementMap.set(
              judgementId,
              normalizeId(doc.verified_by),
            )
          }
        }

        const items = docs.map((doc) => {
          const id =
            doc._id instanceof ObjectId ? doc._id.toHexString() : `${doc._id}`
          const isProcessed = processedIds.some((pid) => pid.equals(doc._id))
          const isVerified = verifiedObjectIds.some((vid) =>
            vid.equals(doc._id),
          )
          const assignee = doc.assigned_to
            ? userMap[normalizeId(doc.assigned_to)]
            : undefined
          const verifiedBy = userMap[verifierByJudgementMap.get(id) ?? '']

          return {
            id,
            trial: doc.trial,
            filename: doc.filename,
            appeal: doc.appeal ?? null,
            corrigendum: doc.corrigendum ?? null,
            year: doc.year,
            processed: isProcessed,
            verified: isVerified,
            updatedAt:
              doc.updatedAt?.toString?.() ??
              doc.updated_at?.toString?.() ??
              null,
            assignee,
            verifiedBy,
          } satisfies JudgementListItem
        })

        return Response.json({ total, items })
      },
    },
  },
})
