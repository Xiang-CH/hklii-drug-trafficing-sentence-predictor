import { createServerFn } from '@tanstack/react-start'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/db'
import {
  acquireVerificationLock,
  getCurrentVerificationLock,
  releaseVerificationLock,
  renewVerificationLock,
} from '@/server/verification-locks'
import { authMiddleware } from '@/middleware/auth'

export type UserJudgement = {
  id: string
  filename: string
  trial?: string
  appeal?: string
  corrigendum?: string
  year?: string
  status: 'pending' | 'verified' | 'in_progress'
  verifiedAt?: string
  verifiedFeatureId?: string
}

export type UserDashboardStats = {
  totalAssigned: number
  verified: number
  pending: number
  inProgress: number
}

export type VerifiedFeatureData = {
  id: string
  sourceJudgementId: string
  sourceLlmExtractionId?: string
  isVerified: boolean
  judgement?: unknown
  defendants?: unknown
  trials?: unknown
  remarks?: string
  exclude: boolean
  createdAt?: string
  updatedAt?: string
  verifiedAt?: string
  verifiedBy?: string
}

const judgementListProjection = {
  filename: 1,
  trial: 1,
  appeal: 1,
  corrigendum: 1,
  year: 1,
}

async function getAssignedJudgement(
  judgementsCollection: ReturnType<typeof db.collection>,
  userId: string,
  judgementId: string,
) {
  return await judgementsCollection.findOne({
    _id: new ObjectId(judgementId),
    $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
  })
}

async function getJudgementForLock(
  judgementsCollection: ReturnType<typeof db.collection>,
  userId: string,
  judgementId: string,
  isAdmin: boolean,
) {
  if (isAdmin) {
    return await judgementsCollection.findOne({
      _id: new ObjectId(judgementId),
    })
  }

  return await getAssignedJudgement(judgementsCollection, userId, judgementId)
}

// Helper function to get status from verified-features collection
async function getVerificationStatus(
  verifiedCollection: ReturnType<typeof db.collection>,
  judgementId: string | ObjectId,
): Promise<{
  status: 'pending' | 'verified' | 'in_progress'
  verifiedFeatureId?: string
  verifiedAt?: string
}> {
  const verifiedDoc = await verifiedCollection.findOne({
    source_judgement_id:
      judgementId instanceof ObjectId ? judgementId : new ObjectId(judgementId),
  })

  if (!verifiedDoc) {
    return { status: 'pending' }
  }

  if (verifiedDoc.is_verified === true) {
    return {
      status: 'verified',
      verifiedFeatureId: verifiedDoc._id.toHexString(),
      verifiedAt:
        verifiedDoc.verified_at?.toISOString?.() ?? verifiedDoc.verified_at,
    }
  }

  return {
    status: 'in_progress',
    verifiedFeatureId: verifiedDoc._id.toHexString(),
  }
}

type UserJudgementStatus = 'pending' | 'verified' | 'in_progress'

function buildJudgementLookupPipeline(userId: string) {
  return [
    {
      $match: {
        $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
      },
    },
    { $project: judgementListProjection },
    {
      $lookup: {
        from: 'verified-features',
        localField: '_id',
        foreignField: 'source_judgement_id',
        as: 'verified',
        pipeline: [
          {
            $project: {
              is_verified: 1,
              _id: 1,
              verified_at: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        verifiedDoc: { $first: '$verified' },
      },
    },
    {
      $addFields: {
        status: {
          $cond: {
            if: { $eq: ['$verifiedDoc.is_verified', true] },
            then: 'verified',
            else: {
              $cond: {
                if: { $gt: [{ $size: '$verified' }, 0] },
                then: 'in_progress',
                else: 'pending',
              },
            },
          },
        },
        verifiedFeatureId: {
          $cond: {
            if: { $gt: [{ $size: '$verified' }, 0] },
            then: { $toString: '$verifiedDoc._id' },
            else: null,
          },
        },
        verifiedAt: {
          $cond: {
            if: { $eq: ['$verifiedDoc.is_verified', true] },
            then: '$verifiedDoc.verified_at',
            else: null,
          },
        },
      },
    },
    { $project: { verified: 0, verifiedDoc: 0 } },
  ]
}

function mapJudgement(doc: Record<string, unknown>): UserJudgement {
  return {
    id: doc._id instanceof ObjectId ? doc._id.toHexString() : `${doc._id}`,
    filename: doc.filename as string,
    trial: (doc.trial as string | null) || undefined,
    appeal: (doc.appeal as string | null) || undefined,
    corrigendum: (doc.corrigendum as string | null) || undefined,
    year: (doc.year as string | null) || undefined,
    status: doc.status as UserJudgementStatus,
    verifiedAt:
      doc.verifiedAt instanceof Date
        ? doc.verifiedAt.toISOString()
        : (doc.verifiedAt as string | null) || undefined,
    verifiedFeatureId: (doc.verifiedFeatureId as string | null) || undefined,
  }
}

export const getUserAssignedJudgements = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id
    const judgementsCollection = db.collection('judgement-html')
    const start = Date.now()

    console.log(`[getUserAssignedJudgements] userId=${userId}`)

    const pipeline = [
      ...buildJudgementLookupPipeline(userId),
      { $sort: { year: -1, trial: 1 } },
    ]
    const judgements = await judgementsCollection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray()

    const elapsed = Date.now() - start
    console.log(
      `[getUserAssignedJudgements] userId=${userId} count=${judgements.length} elapsed=${elapsed}ms`,
    )

    return judgements.map(mapJudgement)
  })

export const getUserJudgementCounts = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id
    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    const assignedDocs = await judgementsCollection
      .find({
        $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
      })
      .project({ _id: 1 })
      .toArray()

    const totalAssigned = assignedDocs.length
    if (totalAssigned === 0) {
      return {
        counts: { pending: 0, in_progress: 0, verified: 0 },
        total: 0,
      }
    }

    const judgementIds = assignedDocs.map((d) => d._id)

    const verifiedCursor = await verifiedCollection
      .aggregate([
        {
          $match: {
            source_judgement_id: { $in: judgementIds },
          },
        },
        {
          $group: {
            _id: '$is_verified',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()

    let verified = 0
    let inProgress = 0
    for (const r of verifiedCursor) {
      if (r._id === true) {
        verified = r.count
      } else {
        inProgress += r.count
      }
    }

    const pending = totalAssigned - verified - inProgress

    return {
      counts: {
        pending,
        in_progress: inProgress,
        verified,
      },
      total: totalAssigned,
    }
  })

export const getUserAssignedJudgementsPaginated = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      status?: UserJudgementStatus
      offset?: number
      limit?: number
      search?: string
    }) => {
      if (
        input.status &&
        !['pending', 'verified', 'in_progress'].includes(input.status)
      ) {
        throw new Error(
          `Invalid status: ${input.status}. Must be one of: pending, verified, in_progress`,
        )
      }
      return input
    },
  )
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const judgementsCollection = db.collection('judgement-html')
    const { status, offset = 0, limit = 50, search } = data

    const searchFilter = search
      ? {
          $or: [
            { trial: { $regex: search, $options: 'i' } },
            { filename: { $regex: search, $options: 'i' } },
            { appeal: { $regex: search, $options: 'i' } },
          ],
        }
      : null

    const pipeline = [
      ...buildJudgementLookupPipeline(userId),
      ...(searchFilter ? [{ $match: searchFilter }] : []),
      ...(status ? [{ $match: { status } }] : []),
      { $sort: { year: -1, trial: 1 } },
      { $skip: offset },
      { $limit: limit },
    ]

    const judgements = await judgementsCollection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray()

    return judgements.map(mapJudgement)
  })

export const getJudgementForVerification = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .inputValidator((filename: string) => filename)
  .handler(async ({ context, data: filename }) => {
    const userId = context.session.user.id
    const judgementsCollection = db.collection('judgement-html')
    const extractedCollection = db.collection('llm-extracted-features')
    const verifiedCollection = db.collection('verified-features')

    // Get the judgement
    const doc = await judgementsCollection.findOne({
      filename,
      $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
    })

    if (!doc) {
      throw new Error('Judgement not found or not assigned to you')
    }

    // Get the LLM extracted data
    const extractedDoc = await extractedCollection.findOne({
      source_judgement_id: doc._id,
    })

    // Get verification status and data
    const { status, verifiedFeatureId } = await getVerificationStatus(
      verifiedCollection,
      doc._id,
    )
    const lockState = await getCurrentVerificationLock(
      doc._id instanceof ObjectId ? doc._id.toHexString() : `${doc._id}`,
    )

    // Get verified feature data if it exists
    let verifiedData = null
    if (verifiedFeatureId) {
      verifiedData = await verifiedCollection.findOne({
        _id: new ObjectId(verifiedFeatureId),
      })
    }

    return {
      id: doc._id instanceof ObjectId ? doc._id.toHexString() : `${doc._id}`,
      filename: doc.filename,
      trial: doc.trial ?? undefined,
      appeal: doc.appeal ?? undefined,
      corrigendum: doc.corrigendum ?? undefined,
      year: doc.year ?? undefined,
      html: doc.html ?? '',
      appeal_html: doc.appeal_html ?? undefined,
      corrigendum_html: doc.corrigendum_html ?? undefined,
      extractedData: extractedDoc
        ? {
            judgement: extractedDoc.judgement,
            defendants: extractedDoc.defendants,
            trials: extractedDoc.trials,
            extractedId: extractedDoc._id.toHexString(),
          }
        : null,
      verifiedData: verifiedData
        ? ({
            id: verifiedData._id.toHexString(),
            sourceJudgementId: verifiedData.source_judgement_id?.toHexString(),
            sourceLlmExtractionId:
              verifiedData.source_llm_extraction_id?.toHexString(),
            isVerified: verifiedData.is_verified === true,
            judgement: verifiedData.judgement,
            defendants: verifiedData.defendants,
            trials: verifiedData.trials,
            remarks: verifiedData.remarks,
            exclude: verifiedData.exclude,
          } satisfies VerifiedFeatureData)
        : null,
      status,
      lockState,
    }
  })

export const acquireJudgementLock = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: { judgementId: string; lockToken: string; holderName: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const holderUsername = context.session.user.username ?? null
    const judgementsCollection = db.collection('judgement-html')

    const judgement = await getJudgementForLock(
      judgementsCollection,
      userId,
      data.judgementId,
      context.session.user.role === 'admin',
    )

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

    return await acquireVerificationLock({
      judgementId: data.judgementId,
      userId,
      holderName: data.holderName,
      holderUsername,
      lockToken: data.lockToken,
    })
  })

export const renewJudgementLock = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: { judgementId: string; lockToken: string; holderName: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const holderUsername = context.session.user.username ?? null
    const judgementsCollection = db.collection('judgement-html')

    const judgement = await getJudgementForLock(
      judgementsCollection,
      userId,
      data.judgementId,
      context.session.user.role === 'admin',
    )

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

    return await renewVerificationLock({
      judgementId: data.judgementId,
      userId,
      holderName: data.holderName,
      holderUsername,
      lockToken: data.lockToken,
    })
  })

export const releaseJudgementLock = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator((input: { judgementId: string; lockToken: string }) => input)
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const judgementsCollection = db.collection('judgement-html')

    const judgement = await getJudgementForLock(
      judgementsCollection,
      userId,
      data.judgementId,
      context.session.user.role === 'admin',
    )

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

    return await releaseVerificationLock({
      judgementId: data.judgementId,
      lockToken: data.lockToken,
    })
  })

export const saveVerificationProgress = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      judgementId: string
      lockToken: string
      extractedId?: string
      holderName: string
      data: {
        judgement: unknown
        defendants: unknown
        trials: unknown
      }
      remarks?: string
      exclude: boolean
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const {
      judgementId,
      lockToken,
      extractedId,
      holderName,
      data: verificationData,
    } = data
    const holderUsername = context.session.user.username ?? null

    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    // Verify the judgement is assigned to this user
    const judgement = await judgementsCollection.findOne({
      _id: new ObjectId(judgementId),
      $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
    })

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

    await renewVerificationLock({
      judgementId,
      lockToken,
      holderName,
      holderUsername,
      userId,
    })

    // Check if a verified feature already exists
    const existingDoc = await verifiedCollection.findOne({
      source_judgement_id: new ObjectId(judgementId),
    })

    const now = new Date()

    if (existingDoc) {
      // Update existing document
      await verifiedCollection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            judgement: verificationData.judgement,
            defendants: verificationData.defendants,
            trials: verificationData.trials,
            remarks: data.remarks,
            exclude: data.exclude,
            updated_at: now,
          },
        },
      )

      return {
        success: true,
        verifiedFeatureId: existingDoc._id.toHexString(),
        message: 'Progress saved',
      }
    } else {
      // Create new document
      const result = await verifiedCollection.insertOne({
        source_judgement_id: new ObjectId(judgementId),
        source_llm_extraction_id: extractedId
          ? new ObjectId(extractedId)
          : undefined,
        is_verified: false,
        judgement: verificationData.judgement,
        defendants: verificationData.defendants,
        trials: verificationData.trials,
        created_by: new ObjectId(userId),
        created_at: now,
        updated_at: now,
        remarks: data.remarks,
        exclude: data.exclude,
      })

      return {
        success: true,
        verifiedFeatureId: result.insertedId.toHexString(),
        message: 'Progress saved',
      }
    }
  })

export const markAsVerified = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      judgementId: string
      lockToken: string
      data: {
        judgement: unknown
        defendants: unknown
        trials: unknown
      }
      remarks?: string
      exclude: boolean
      holderName: string
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const { judgementId, lockToken, holderName, data: verificationData } = data
    const holderUsername = context.session.user.username ?? null

    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    // Verify the judgement is assigned to this user
    const judgement = await judgementsCollection.findOne({
      _id: new ObjectId(judgementId),
      $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
    })

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

    await renewVerificationLock({
      judgementId,
      lockToken,
      holderName,
      holderUsername,
      userId,
    })

    // Check if a verified feature already exists
    const existingDoc = await verifiedCollection.findOne({
      source_judgement_id: new ObjectId(judgementId),
    })

    const now = new Date()

    if (existingDoc) {
      // Update existing document and mark as verified
      await verifiedCollection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            judgement: verificationData.judgement,
            defendants: verificationData.defendants,
            trials: verificationData.trials,
            is_verified: true,
            verified_by: new ObjectId(userId),
            verified_at: now,
            updated_at: now,
            remarks: data.remarks,
            exclude: data.exclude,
          },
        },
      )

      return {
        success: true,
        verifiedFeatureId: existingDoc._id.toHexString(),
        message: 'Marked as verified',
      }
    } else {
      // Create new document and mark as verified immediately
      const result = await verifiedCollection.insertOne({
        source_judgement_id: new ObjectId(judgementId),
        is_verified: true,
        judgement: verificationData.judgement,
        defendants: verificationData.defendants,
        trials: verificationData.trials,
        verified_by: new ObjectId(userId),
        verified_at: now,
        created_by: new ObjectId(userId),
        created_at: now,
        updated_at: now,
        remarks: data.remarks,
        exclude: data.exclude,
      })

      return {
        success: true,
        verifiedFeatureId: result.insertedId.toHexString(),
        message: 'Marked as verified',
      }
    }
  })

export const revertToInProgress = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: { judgementId: string; lockToken: string; holderName: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const { judgementId, lockToken, holderName } = data
    const holderUsername = context.session.user.username ?? null

    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    const judgement = await judgementsCollection.findOne({
      _id: new ObjectId(judgementId),
      $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
    })

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

    await renewVerificationLock({
      judgementId,
      lockToken,
      holderName,
      holderUsername,
      userId,
    })

    const result = await verifiedCollection.updateOne(
      { source_judgement_id: new ObjectId(judgementId) },
      {
        $set: {
          is_verified: false,
          updated_at: new Date(),
        },
        $unset: {
          verified_by: '',
          verified_at: '',
        },
      },
    )

    if (result.matchedCount === 0) {
      throw new Error('No verified record found to revert')
    }

    return {
      success: true,
      message: 'Reverted to in progress',
    }
  })

function requireAdmin(session: { user: { role?: string | null } }) {
  if (session.user.role !== 'admin') {
    throw new Error('Admin access required')
  }
}

export const adminSaveVerificationProgress = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      judgementId: string
      lockToken: string
      extractedId?: string
      data: {
        judgement: unknown
        defendants: unknown
        trials: unknown
      }
      remarks?: string
      exclude: boolean
      holderName: string
    }) => input,
  )
  .handler(async ({ context, data }) => {
    requireAdmin(context.session)
    const userId = context.session.user.id
    const {
      judgementId,
      lockToken,
      extractedId,
      holderName,
      data: verificationData,
    } = data
    const holderUsername = context.session.user.username ?? null

    const verifiedCollection = db.collection('verified-features')

    await renewVerificationLock({
      judgementId,
      lockToken,
      holderName,
      holderUsername,
      userId,
    })

    const existingDoc = await verifiedCollection.findOne({
      source_judgement_id: new ObjectId(judgementId),
    })

    const now = new Date()

    if (existingDoc) {
      await verifiedCollection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            judgement: verificationData.judgement,
            defendants: verificationData.defendants,
            trials: verificationData.trials,
            remarks: data.remarks,
            exclude: data.exclude,
            updated_at: now,
          },
        },
      )

      return {
        success: true,
        verifiedFeatureId: existingDoc._id.toHexString(),
        message: 'Progress saved',
      }
    } else {
      const result = await verifiedCollection.insertOne({
        source_judgement_id: new ObjectId(judgementId),
        source_llm_extraction_id: extractedId
          ? new ObjectId(extractedId)
          : undefined,
        is_verified: false,
        judgement: verificationData.judgement,
        defendants: verificationData.defendants,
        trials: verificationData.trials,
        created_by: new ObjectId(userId),
        created_at: now,
        updated_at: now,
        remarks: data.remarks,
        exclude: data.exclude,
      })

      return {
        success: true,
        verifiedFeatureId: result.insertedId.toHexString(),
        message: 'Progress saved',
      }
    }
  })

export const adminMarkAsVerified = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      judgementId: string
      lockToken: string
      data: {
        judgement: unknown
        defendants: unknown
        trials: unknown
      }
      remarks?: string
      exclude: boolean
      holderName: string
    }) => input,
  )
  .handler(async ({ context, data }) => {
    requireAdmin(context.session)
    const userId = context.session.user.id
    const { judgementId, lockToken, holderName, data: verificationData } = data
    const holderUsername = context.session.user.username ?? null

    const verifiedCollection = db.collection('verified-features')

    await renewVerificationLock({
      judgementId,
      lockToken,
      holderName,
      holderUsername,
      userId,
    })

    const existingDoc = await verifiedCollection.findOne({
      source_judgement_id: new ObjectId(judgementId),
    })

    const now = new Date()

    if (existingDoc) {
      await verifiedCollection.updateOne(
        { _id: existingDoc._id },
        {
          $set: {
            judgement: verificationData.judgement,
            defendants: verificationData.defendants,
            trials: verificationData.trials,
            is_verified: true,
            verified_by: new ObjectId(userId),
            verified_at: now,
            updated_at: now,
            remarks: data.remarks,
            exclude: data.exclude,
          },
        },
      )

      return {
        success: true,
        verifiedFeatureId: existingDoc._id.toHexString(),
        message: 'Marked as verified',
      }
    } else {
      const result = await verifiedCollection.insertOne({
        source_judgement_id: new ObjectId(judgementId),
        is_verified: true,
        judgement: verificationData.judgement,
        defendants: verificationData.defendants,
        trials: verificationData.trials,
        verified_by: new ObjectId(userId),
        verified_at: now,
        created_by: new ObjectId(userId),
        created_at: now,
        updated_at: now,
        remarks: data.remarks,
        exclude: data.exclude,
      })

      return {
        success: true,
        verifiedFeatureId: result.insertedId.toHexString(),
        message: 'Marked as verified',
      }
    }
  })

export const adminRevertToInProgress = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: { judgementId: string; lockToken: string; holderName: string }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    requireAdmin(context.session)
    const { judgementId, lockToken, holderName } = data
    const userId = context.session.user.id
    const holderUsername = context.session.user.username ?? null

    const verifiedCollection = db.collection('verified-features')

    await renewVerificationLock({
      judgementId,
      lockToken,
      holderName,
      holderUsername,
      userId,
    })

    const result = await verifiedCollection.updateOne(
      { source_judgement_id: new ObjectId(judgementId) },
      {
        $set: {
          is_verified: false,
          updated_at: new Date(),
        },
        $unset: {
          verified_by: '',
          verified_at: '',
        },
      },
    )

    if (result.matchedCount === 0) {
      throw new Error('No verified record found to revert')
    }

    return {
      success: true,
      message: 'Reverted to in progress',
    }
  })
