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

    const countMap = new Map<string, number>()

    for (const item of assignmentCounts) {
      const key =
        item._id instanceof ObjectId ? item._id.toHexString() : String(item._id)
      countMap.set(key, item.count)
    }

    // Convert Map to a plain object for serialization
    const serialized: Record<string, number> = {}
    countMap.forEach((value, key) => {
      serialized[key] = value
    })

    return serialized
  })

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
