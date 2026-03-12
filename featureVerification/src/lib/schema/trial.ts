import { z } from 'zod'
import { ChargeNameSchema } from './judgment'

export const DrugTypeSchema = z.enum([
  'Cannabis',
  'THC/CBD',
  'Cathinones',
  'Cocaine',
  'Cough medicine',
  'Ecstasy',
  'GHB/GBL',
  'Heroin',
  'Ketamine',
  'Nimetazepam',
  'Morphine',
  'Methamphetamine',
  'Salvia',
  'TFMPP',
  'Etomidate',
  'Other',
])

export const AggravatingFactorTypeSchema = z.enum([
  'Refugee/Asylum',
  'Illegal immigrant',
  'On bail',
  'Suspended sentence',
  'CSD supervision',
  'Wanted',
  'Persistent offender',
  'Import',
  'Export',
  'Use of minors',
  'Multiple drugs',
  'Role of the defendant',
  'Other',
])

export const MitigatingFactorTypeSchema = z.enum([
  'Voluntary surrender',
  'Self-consumption',
  'Assistance - limited',
  'Assistance - useful',
  'Assistance - testify',
  'Assistance - risk',
  'Extreme youth',
  'Young offender',
  'Medical conditions',
  'Family illness',
  'Prosecutorial delay',
  'Mistaken belief',
  'Rehabilitation programme',
  'Other',
])

export const CourtTypeSchema = z.enum(['High Court', 'District Court'])

export const HighCourtPleaStageSchema = z.enum([
  'Unknown',
  'Up to committal',
  'After committal',
  'After dates fixed',
  'First day',
  'During trial',
])

export const DistrictCourtPleaStageSchema = z.enum([
  'Unknown',
  'Plea day',
  'After dates fixed',
  'First day',
  'During trial',
])

export const DrugDetailSchema = z
  .object({
    drug_type: DrugTypeSchema,
    other_drug_type: z.string().nullable().default(null),
    quantity: z.number(),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (data.drug_type === 'Other' && data.other_drug_type === null) {
        return false
      }
      return true
    },
    {
      message: "other_drug_type is required when drug_type is 'Other'",
    },
  )

export const AggravatingFactorDetailSchema = z
  .object({
    factor: AggravatingFactorTypeSchema,
    other_factor: z.string().nullable().default(null),
    enhancement_months: z.number().nullable().default(null),
    inferred: z.boolean().default(false),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (data.factor === 'Other' && data.other_factor === null) {
        return false
      }
      return true
    },
    {
      message: "other_factor is required when factor is 'Other'",
    },
  )

export const GuiltyPleaDetailSchema = z
  .object({
    pleaded_guilty: z.boolean(),
    court_type: CourtTypeSchema.nullable().default(null),
    high_court_stage: HighCourtPleaStageSchema.nullable().default(null),
    district_court_stage: DistrictCourtPleaStageSchema.nullable().default(null),
    reduction_years: z.number().int().nullable().default(null),
    reduction_months: z.number().int().nullable().default(null),
    reduction_percentage: z.number().min(0).max(100).nullable().default(null),
    inferred: z.boolean().default(false),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (data.pleaded_guilty && data.court_type === null) {
        return false
      }
      if (data.court_type === 'High Court' && data.high_court_stage === null) {
        return false
      }
      if (
        data.court_type === 'District Court' &&
        data.district_court_stage === null
      ) {
        return false
      }
      return true
    },
    {
      message: 'Conditional fields validation failed',
    },
  )
  .transform((data) => ({
    ...data,
    total_reduction_months:
      data.reduction_years === null && data.reduction_months === null
        ? null
        : (data.reduction_years || 0) * 12 + (data.reduction_months || 0),
  }))

export const MitigatingFactorDetailSchema = z
  .object({
    factor: MitigatingFactorTypeSchema,
    other_factor: z.string().nullable().default(null),
    reduction_months: z.number().nullable().default(null),
    reduction_percentage: z.number().min(0).max(100).nullable().default(null),
    inferred: z.boolean().default(false),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (data.factor === 'Other' && data.other_factor === null) {
        return false
      }
      return true
    },
    {
      message: "other_factor is required when factor is 'Other'",
    },
  )

export const StartingPointDetailInputSchema = z.object({
  sentence_years: z.number(),
  sentence_months: z.number(),
  inferred: z.boolean().default(false),
  source: z.string(),
})

export const StartingPointDetailSchema =
  StartingPointDetailInputSchema.transform((data) => ({
    ...data,
    total_months: data.sentence_years * 12 + data.sentence_months,
  }))

export const SentenceAfterRoleDetailInputSchema = z.object({
  sentence_years: z.number(),
  sentence_months: z.number(),
  inferred: z.boolean().default(false),
  source: z.string(),
})

export const SentenceAfterRoleDetailSchema =
  SentenceAfterRoleDetailInputSchema.transform((data) => ({
    ...data,
    total_months: data.sentence_years * 12 + data.sentence_months,
  }))

export const NotionalSentenceDetailInputSchema = z.object({
  sentence_years: z.number(),
  sentence_months: z.number(),
  inferred: z.boolean().default(false),
  source: z.string(),
})

export const NotionalSentenceDetailSchema =
  NotionalSentenceDetailInputSchema.transform((data) => ({
    ...data,
    total_months: data.sentence_years * 12 + data.sentence_months,
  }))

export const MitigationReductionDetailSchema = z.object({
  reduction_months: z.number(),
  inferred: z.boolean().default(false),
  source: z.string(),
})

export const FinalSentenceDetailInputSchema = z.object({
  sentence_years: z.number(),
  sentence_months: z.number(),
  source: z.string(),
})

export const FinalSentenceDetailSchema =
  FinalSentenceDetailInputSchema.transform((data) => ({
    ...data,
    total_months: data.sentence_years * 12 + data.sentence_months,
  }))

export const ChargeDetailSchema = z.object({
  charge_no: z.number(),
  charge_name: ChargeNameSchema,
  defendant_name: z.string(),
  defendant_id: z.number(),
  source: z.string(),
})

export const TrialSchema = z
  .object({
    charge_type: ChargeDetailSchema,
    drugs: z.array(DrugDetailSchema).min(1),
    aggravating_factors: z
      .array(AggravatingFactorDetailSchema)
      .nullable()
      .default(null),
    mitigating_factors: z
      .array(MitigatingFactorDetailSchema)
      .nullable()
      .default(null),
    guilty_plea: GuiltyPleaDetailSchema,
    starting_point: StartingPointDetailSchema,
    sentence_after_role: SentenceAfterRoleDetailSchema.nullable().default(null),
    notional_sentence: NotionalSentenceDetailSchema,
    mitigation_reduction:
      MitigationReductionDetailSchema.nullable().default(null),
    final_sentence: FinalSentenceDetailSchema,
  })
  .superRefine((data, ctx) => {
    const afterRoleTotal = data.sentence_after_role
      ? data.sentence_after_role.total_months
      : data.starting_point.total_months
    const notionalTotal = data.notional_sentence.total_months

    if (notionalTotal < afterRoleTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['notional_sentence'],
        message:
          'Notional sentence cannot be less than sentence after role/starting point',
      })
    }

    const currentSentence =
      notionalTotal - (data.mitigation_reduction?.reduction_months || 0)
    const finalTotal = data.final_sentence.total_months

    if (finalTotal > currentSentence) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['final_sentence'],
        message:
          'Final sentence cannot be greater than notional sentence minus mitigation reduction',
      })
    }

    if (
      data.guilty_plea.total_reduction_months !== null &&
      finalTotal !== currentSentence - data.guilty_plea.total_reduction_months
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['final_sentence'],
        message:
          'Final sentence must be equal to notional sentence minus mitigation reduction minus guilty plea reduction',
      })
    }
  })

export const TrialsSchema = z.object({
  trials: z.array(TrialSchema),
})
