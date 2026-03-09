import { z } from 'zod'

export const NationalityCategorySchema = z.enum([
  'Hong Kong resident',
  'Mainland Chinese',
  'Foreign nationality',
])

export const HKResidentStatusSchema = z.enum([
  'Permanent resident',
  'Resident',
  'New arrival',
  'N/A',
])

export const GenderSchema = z.enum(['Male', 'Female'])

export const MaritalStatusSchema = z.enum([
  'Single',
  'Married',
  'Separated/divorced',
  'Widowed',
  'Cohabiting',
])

export const ParentalStatusEnumSchema = z.enum([
  'No children',
  'Parent',
  'Expecting parent',
])

export const CustodyStatusSchema = z.enum([
  'Parent with custody',
  'Parent without custody',
])

export const HouseholdCompositionSchema = z.enum([
  'Lives alone',
  'Lives with family',
  'Lives with non-family',
  'Homeless',
])

export const EducationLevelSchema = z.enum([
  'Uneducated',
  'Primary',
  'Secondary - Lower',
  'Secondary - Upper',
  'Tertiary',
])

export const OccupationCategorySchema = z.enum([
  'Unemployed',
  'Manager',
  'Professional',
  'Associate professional',
  'Clerical support worker',
  'Service and sales worker',
  'Craft and related worker',
  'Plant and machine operator and assembler',
  'Elementary occupation',
  'Skilled agricultural and fishery worker',
  'Student',
  'Other',
])

export const CriminalRecordSchema = z.enum([
  'None',
  'Drug trafficking',
  'Dangerous drug offences',
  'Other offences',
])

export const PositiveHabitSchema = z.enum([
  'Volunteering',
  'Studying',
  'Working',
  'Negative drug tests',
  'Participation in rehabilitation/self-improvement',
])

export const FamilySupportSchema = z.enum([
  'None',
  'Family presence in court',
  'Letters of support from family',
  'Other',
])

export const HealthStatusTypeSchema = z.enum([
  'Drug addiction',
  'Mental health',
  'Physical health',
])

export const GovernmentSubsidyEnumSchema = z.enum(['CSSA', 'Other'])

export const NationalitySchema = z
  .object({
    category: NationalityCategorySchema,
    hk_resident_status: HKResidentStatusSchema.nullable().default(null),
    foreign_country_code: z.string().length(2).nullable().default(null),
    infer_reason: z.string().nullable().default(null),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (
        data.category === 'Hong Kong resident' &&
        data.hk_resident_status === null
      ) {
        return false
      }
      if (
        data.category === 'Foreign nationality' &&
        data.foreign_country_code === null
      ) {
        return false
      }
      return true
    },
    {
      message: 'Conditional fields validation failed',
    },
  )

export const AgeAtOffenceSchema = z.object({
  age: z.union([z.number(), z.array(z.number()).length(2)]),
  source: z.string(),
})

export const AgeAtSentencingSchema = z.object({
  age: z.union([z.number(), z.array(z.number()).length(2)]),
  source: z.string(),
})

export const ParentalStatusSchema = z.object({
  status: ParentalStatusEnumSchema,
  custody: CustodyStatusSchema.nullable().default(null),
  source: z.string(),
})

export const HealthConditionSchema = z.object({
  name: z.string(),
  type: HealthStatusTypeSchema,
  source: z.string(),
})

export const OccupationSchema = z.object({
  occupation_category: OccupationCategorySchema,
  occupation_name: z.string().nullable().default(null),
  source: z.string(),
})

export const DefendantNameDetailSchema = z.object({
  name: z.string(),
  source: z.string(),
})

export const GenderDetailSchema = z.object({
  gender: GenderSchema,
  source: z.string(),
})

export const MaritalStatusDetailSchema = z.object({
  status: MaritalStatusSchema,
  source: z.string(),
})

export const HouseholdCompositionDetailSchema = z.object({
  composition: HouseholdCompositionSchema,
  source: z.string(),
})

export const DrugTreatmentDetailSchema = z.object({
  participated: z.boolean(),
  source: z.string(),
})

export const EducationLevelDetailSchema = z.object({
  level: EducationLevelSchema,
  source: z.string(),
})

export const MonthlyWageDetailSchema = z
  .object({
    wage: z.union([
      z.number().int().min(0),
      z.array(z.number().int()).length(2),
    ]),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (!Array.isArray(data.wage)) {
        return true
      }
      return data.wage[0] <= data.wage[1]
    },
    {
      message: 'Lower bound of wage range cannot be greater than upper bound',
      path: ['wage'],
    },
  )
  .refine(
    (data) => {
      if (!Array.isArray(data.wage)) {
        return true
      }
      return data.wage.every((value) => value >= 0)
    },
    {
      message: 'Wage cannot be negative',
      path: ['wage'],
    },
  )

export const GovernmentSubsidyRecipientSchema = z
  .object({
    scheme_type: GovernmentSubsidyEnumSchema,
    other_scheme: z.string().nullable().default(null),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (data.scheme_type !== 'Other') {
        return true
      }
      return !!data.other_scheme
    },
    {
      message: "other_scheme must be specified if scheme_type is 'Other'",
      path: ['other_scheme'],
    },
  )

export const CriminalRecordDetailSchema = z.object({
  record: CriminalRecordSchema,
  source: z.string(),
})

export const PositiveHabitDetailSchema = z.object({
  habit: PositiveHabitSchema,
  source: z.string(),
})

export const FamilySupportDetailSchema = z.object({
  support: FamilySupportSchema,
  source: z.string(),
})

export const DefendantProfileSchema = z.object({
  defendant_id: z.number(),
  defendant_name: DefendantNameDetailSchema,
  nationality: NationalitySchema.nullable().default(null),
  age_at_offence: AgeAtOffenceSchema.nullable().default(null),
  age_at_sentencing: AgeAtSentencingSchema.nullable().default(null),
  gender: GenderDetailSchema.nullable().default(null),
  marital_status: MaritalStatusDetailSchema.nullable().default(null),
  parental_status: ParentalStatusSchema.nullable().default(null),
  household_composition:
    HouseholdCompositionDetailSchema.nullable().default(null),
  health_conditions: z.array(HealthConditionSchema).nullable().default(null),
  drug_treatment_participation:
    DrugTreatmentDetailSchema.nullable().default(null),
  education_level: EducationLevelDetailSchema.nullable().default(null),
  occupation: OccupationSchema.nullable().default(null),
  monthly_wage: MonthlyWageDetailSchema.nullable().default(null),
  government_subsidy_recipient:
    GovernmentSubsidyRecipientSchema.nullable().default(null),
  criminal_records: z
    .array(CriminalRecordDetailSchema)
    .nullable()
    .default(null),
  positive_habits_after_arrest: z
    .array(PositiveHabitDetailSchema)
    .nullable()
    .default(null),
  family_supports: z.array(FamilySupportDetailSchema).nullable().default(null),
})

export const DefendantsSchema = z.object({
  defendants: z.array(DefendantProfileSchema).min(1),
})
