import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'
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
}

export const Route = createFileRoute('/api/judgements/$filename')({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ params }) => {
        const judgementsCollection = db.collection('judgement-html')
        const doc = await judgementsCollection.findOne({
          filename: params.filename,
        })

        if (!doc) {
          return new Response('Not found', { status: 404 })
        }

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
        } satisfies JudgementDetail)
      },
    },
  },
})
