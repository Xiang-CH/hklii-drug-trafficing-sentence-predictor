import { createServerFn } from '@tanstack/react-start'
import { ObjectId } from 'mongodb'
import { db } from '@/lib/db'
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

export const getUserAssignedJudgements = createServerFn({
  method: 'GET',
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.session.user.id
    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    const pipeline = [
      {
        $match: {
          $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
        },
      },
      { $project: judgementListProjection },
      { $sort: { year: -1, trial: 1 } },
    ]
    const judgements = await judgementsCollection
      .aggregate(pipeline, { allowDiskUse: true })
      .toArray()

    const results: Array<UserJudgement> = []

    for (const doc of judgements) {
      const judgementId =
        doc._id instanceof ObjectId ? doc._id.toHexString() : `${doc._id}`
      const { status, verifiedFeatureId, verifiedAt } =
        await getVerificationStatus(verifiedCollection, doc._id)

      results.push({
        id: judgementId,
        filename: doc.filename,
        trial: doc.trial ?? undefined,
        appeal: doc.appeal ?? undefined,
        corrigendum: doc.corrigendum ?? undefined,
        year: doc.year ?? undefined,
        status,
        verifiedAt,
        verifiedFeatureId,
      })
    }

    return results
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
    }
  })

export const saveVerificationProgress = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(
    (input: {
      judgementId: string
      extractedId?: string
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
    const { judgementId, extractedId, data: verificationData } = data

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
    const { judgementId, data: verificationData } = data

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
  .inputValidator((input: { judgementId: string }) => input)
  .handler(async ({ context, data }) => {
    const userId = context.session.user.id
    const { judgementId } = data

    const judgementsCollection = db.collection('judgement-html')
    const verifiedCollection = db.collection('verified-features')

    const judgement = await judgementsCollection.findOne({
      _id: new ObjectId(judgementId),
      $or: [{ assigned_to: new ObjectId(userId) }, { assigned_to: userId }],
    })

    if (!judgement) {
      throw new Error('Judgement not found or not assigned to you')
    }

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
      extractedId?: string
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
    requireAdmin(context.session)
    const userId = context.session.user.id
    const { judgementId, extractedId, data: verificationData } = data

    const verifiedCollection = db.collection('verified-features')

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
    requireAdmin(context.session)
    const userId = context.session.user.id
    const { judgementId, data: verificationData } = data

    const verifiedCollection = db.collection('verified-features')

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
  .inputValidator((input: { judgementId: string }) => input)
  .handler(async ({ context, data }) => {
    requireAdmin(context.session)
    const { judgementId } = data

    const verifiedCollection = db.collection('verified-features')

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
