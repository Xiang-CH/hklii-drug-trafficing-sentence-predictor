import { createFileRoute } from '@tanstack/react-router'
import { ObjectId } from 'mongodb'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getUserAssignmentCounts } from '@/server/assignment'
import { authMiddleware } from '@/middleware/auth'

export type AssignmentUser = {
  id: string
  name: string
  email: string
  username: string
  assignedCount: number
}

export type AssignmentJudgement = {
  id: string
  filename: string
  trial: string
  appeal?: string
  corrigendum?: string
  year?: string
  assignedTo?: {
    id: string
    username: string
    name: string
  }
}

export type AssignmentData = {
  users: Array<AssignmentUser>
  judgements: Array<AssignmentJudgement>
  total: number
}

const PAGE_SIZE = 50

export const Route = createFileRoute('/api/assignment/$')({
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
        const search = url.searchParams.get('search')?.trim() ?? null
        const assignedFilter = url.searchParams.get('assigned') ?? 'all'
        const username = url.searchParams.get('username')?.trim() ?? null

        // Fetch users
        const usersCollection = db.collection('user')
        const users = await usersCollection.find({}).sort({ name: 1 }).toArray()

        // Count judgements assigned to each user
        const countMap = await getUserAssignmentCounts()

        const mappedUsers: Array<AssignmentUser> = users.map((user) => ({
          id: user._id.toHexString(),
          name: user.name,
          email: user.email,
          username: user.username,
          assignedCount: countMap[user._id.toHexString()] || 0,
        }))

        // Fetch judgements
        const judgementsCollection = db.collection('judgement-html')
        const match: Record<string, unknown> = {}

        if (search) {
          match.$or = [
            { trial: { $regex: search, $options: 'i' } },
            { appeal: { $regex: search, $options: 'i' } },
            { corrigendum: { $regex: search, $options: 'i' } },
            { filename: { $regex: search, $options: 'i' } },
          ]
        }

        if (username && assignedFilter === 'assigned') {
          const userId = await usersCollection.findOne(
            { username: username },
            { projection: { _id: 1 } },
          )
          if (userId) {
            match.$or = [
              { assigned_to: new ObjectId(userId._id) },
              { assigned_to: userId._id.toHexString() },
            ]
          } else {
            match.assigned_to = { $exists: true, $ne: null }
          }
        } else if (assignedFilter === 'assigned') {
          match.assigned_to = { $exists: true, $ne: null }
        } else if (assignedFilter === 'unassigned') {
          match.$or = [
            { assigned_to: { $exists: false } },
            { assigned_to: null },
          ]
        }

        const total = await judgementsCollection.countDocuments(match)

        const judgements = await judgementsCollection
          .find(match)
          .sort({ year: -1, trial: 1 })
          .skip((page - 1) * PAGE_SIZE)
          .limit(PAGE_SIZE)
          .toArray()

        // Build assignee map for quick lookup
        const assigneeIds = judgements
          .map((j) => j.assigned_to)
          .filter((id): id is string => Boolean(id))
        const assignees = assigneeIds.length
          ? await usersCollection
              .find({ _id: { $in: assigneeIds.map((id) => new ObjectId(id)) } })
              .toArray()
          : []
        const assigneeMap = assignees.reduce(
          (acc, user) => {
            acc[user._id.toHexString()] = {
              id: user._id.toHexString(),
              username: user.username,
              name: user.name,
            }
            return acc
          },
          {} as Record<string, { id: string; username: string; name: string }>,
        )

        const mappedJudgements: Array<AssignmentJudgement> = judgements.map(
          (doc) => {
            const id =
              doc._id instanceof ObjectId ? doc._id.toHexString() : `${doc._id}`
            return {
              id,
              filename: doc.filename,
              trial: doc.trial,
              appeal: doc.appeal ?? undefined,
              corrigendum: doc.corrigendum ?? undefined,
              year: doc.year ?? undefined,
              assignedTo: doc.assigned_to
                ? assigneeMap[
                    doc.assigned_to instanceof ObjectId
                      ? doc.assigned_to.toHexString()
                      : `${doc.assigned_to}`
                  ]
                : undefined,
            }
          },
        )

        return Response.json({
          users: mappedUsers,
          judgements: mappedJudgements,
          total,
        } satisfies AssignmentData)
      },

      POST: async ({ request }) => {
        const body = await request.json()
        const { judgementIds, userId, action } = body as {
          judgementIds: Array<string>
          userId?: string
          action: 'assign' | 'unassign' | 'random'
        }

        if (
          (!Array.isArray(judgementIds) || judgementIds.length === 0) &&
          action !== 'random'
        ) {
          return Response.json(
            { error: 'judgementIds must be a non-empty array' },
            { status: 400 },
          )
        }

        const judgementsCollection = db.collection('judgement-html')

        if (action === 'assign' && userId) {
          // Assign judgements to user
          const objectIds = judgementIds.map((id) => new ObjectId(id))
          await judgementsCollection.updateMany(
            { _id: { $in: objectIds } },
            { $set: { assigned_to: new ObjectId(userId) } },
          )
          return Response.json({ success: true, assigned: judgementIds.length })
        } else if (action === 'unassign') {
          // Unassign judgements
          const objectIds = judgementIds.map((id) => new ObjectId(id))
          await judgementsCollection.updateMany(
            { _id: { $in: objectIds } },
            { $unset: { assigned_to: 1 } },
          )
          return Response.json({
            success: true,
            unassigned: judgementIds.length,
          })
        } else if (action === 'random' && userId) {
          // Randomly assign judgements
          const count = body.count || 10
          const unassignedJudgements = await judgementsCollection
            .find({
              $or: [{ assigned_to: { $exists: false } }, { assigned_to: null }],
            })
            .toArray()

          if (unassignedJudgements.length === 0) {
            return Response.json(
              { error: 'No unassigned judgements available' },
              { status: 400 },
            )
          }

          // Shuffle and pick random judgements
          const shuffled = [...unassignedJudgements].sort(
            () => Math.random() - 0.5,
          )
          const selected = shuffled.slice(0, Math.min(count, shuffled.length))
          const selectedIds = selected.map((j) => j._id)

          await judgementsCollection.updateMany(
            { _id: { $in: selectedIds } },
            { $set: { assigned_to: new ObjectId(userId) } },
          )

          return Response.json({
            success: true,
            assigned: selected.length,
            judgementIds: selected.map((j) =>
              j._id instanceof ObjectId ? j._id.toHexString() : `${j._id}`,
            ),
          })
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 })
      },
    },
  },
})
