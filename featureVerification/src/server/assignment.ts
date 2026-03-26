import { createServerFn } from '@tanstack/react-start'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/db'
import { authMiddleware } from '@/middleware/auth'

export type UserAssignmentCount = {
  userId: string
  count: number
}

export const getUserAssignmentCounts = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .handler(async () => {
    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    const assignmentCounts = await judgementsCollection
      .aggregate([
        {
          $match: {
            assigned_to: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: '$assigned_to',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const verificationCounts = await verifiedCollection
      .aggregate([
        {
          $match: {
            is_verified: true,
          },
        },
        {
          $group: {
            _id: '$verified_by',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    const normalizeId = (value: unknown) =>
      value instanceof ObjectId ? value.toHexString() : String(value)

    const assignmentMap = new Map<string, number>()
    const verificationMap = new Map<string, number>()

    for (const item of assignmentCounts) {
      assignmentMap.set(normalizeId(item._id), item.count)
    }

    for (const item of verificationCounts) {
      verificationMap.set(normalizeId(item._id), item.count)
    }

    // Convert Map to a plain object for serialization
    const serialized: Record<
      string,
      { assignment: number; verification: number } | undefined
    > = {}

    const keys = new Set<string>([
      ...assignmentMap.keys(),
      ...verificationMap.keys(),
    ])

    keys.forEach((key) => {
      serialized[key] = {
        assignment: assignmentMap.get(key) ?? 0,
        verification: verificationMap.get(key) ?? 0,
      }
    })

    return serialized
  })

export type UserAssignmentCounts =
  typeof getUserAssignmentCounts extends () => Promise<infer R> ? R : never

export const getUserAssignmentCount = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    const judgementsCollection = db.collection('judgement-html')

    const count = await judgementsCollection.countDocuments({
      assigned_to: userId,
    })

    return count
  })
