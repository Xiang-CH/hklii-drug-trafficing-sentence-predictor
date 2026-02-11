import { createServerFn } from '@tanstack/react-start'
import { ObjectId } from 'mongodb'
import { client, db } from '@/lib/db'
import { authMiddleware } from '@/middleware/auth'

export const deleteUser = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId, context }) => {
    if (context.session.user.role !== 'admin') {
      throw new Error('Unauthorized: Admin access required')
    }

    const session = client.startSession()

    try {
      await session.withTransaction(async () => {
        const usersCollection = db.collection('user')
        const judgementsCollection = db.collection('judgement-html')
        const sessionsCollection = db.collection('session')
        const accountsCollection = db.collection('account')

        const userObjectId = new ObjectId(userId)

        const verificationCount = await judgementsCollection.countDocuments(
          {
            assigned_to: { $in: [userObjectId, userId] },
            _id: {
              $in: (
                await db
                  .collection('verified-features')
                  .find({
                    verified_by: { $in: [userObjectId, userId] },
                    is_verified: true,
                  })
                  .project({ source_judgement_id: 1 })
                  .toArray()
              ).map((v) => v.source_judgement_id),
            },
          },
          { session },
        )

        if (verificationCount > 0) {
          throw new Error(
            'Cannot delete user with active verification assignments',
          )
        }

        await usersCollection.deleteOne({ _id: userObjectId }, { session })
        await sessionsCollection.deleteMany(
          { userId: userObjectId },
          { session },
        )
        await accountsCollection.deleteMany(
          { userId: userObjectId },
          { session },
        )
        await judgementsCollection.updateMany(
          { assigned_to: { $in: [userObjectId, userId] } },
          { $set: { assigned_to: null } },
          { session },
        )
      })

      return { success: true }
    } finally {
      await session.endSession()
    }
  })
