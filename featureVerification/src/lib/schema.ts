import { z } from 'zod'
import Holidays from 'date-holidays'
import {
  districts,
  getDistrictBySubDistrict,
  subDistricts,
} from './hk-district'

const hd = new Holidays('HK')

// Common schemas
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

export const DefendantRoleSchema = z.enum([
  'Courier',
  'Storekeeper',
  'Lookout/scout',
  'Actual trafficker',
  'Manager/organizer',
  'Operator/financial controller',
  'International operator/financial controller',
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

export const ChargeTypeSchema = z.enum([
  'Actual Trafficking',
  'Conspiracy to Traffic',
])

// Helper function to get enum values from zod enum schema
export function getEnumValues<T extends z.ZodEnum<any>>(
  schema: T,
): Array<string> {
  return schema.options
}

// Trial schemas
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

export const RoleDetailSchema = z.object({
  role: DefendantRoleSchema,
  source: z.string(),
})

export const AggravatingFactorDetailSchema = z
  .object({
    factor: AggravatingFactorTypeSchema,
    other_factor: z.string().nullable().default(null),
    enhancement: z.number().nullable().default(null),
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

export const MitigatingFactorDetailSchema = z
  .object({
    factor: MitigatingFactorTypeSchema,
    other_factor: z.string().nullable().default(null),
    reduction: z.number().nullable().default(null),
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
  source: z.string(),
})

export const NotionalSentenceDetailSchema =
  NotionalSentenceDetailInputSchema.transform((data) => ({
    ...data,
    total_months: data.sentence_years * 12 + data.sentence_months,
  }))

export const MitigationReductionDetailSchema = z.object({
  reduction_months: z.number(),
  source: z.string(),
})

export const FinalSentenceDetailInputSchema = z.object({
  sentence_years: z.number(),
  sentence_months: z.number(),
  guilty_plea_reduction_years: z.number().nullable().default(null),
  guilty_plea_reduction_months: z.number().nullable().default(null),
  source: z.string(),
})

export const FinalSentenceDetailSchema =
  FinalSentenceDetailInputSchema.transform((data) => ({
    ...data,
    total_months: data.sentence_years * 12 + data.sentence_months,
    guilty_plea_reduction_total_months:
      data.guilty_plea_reduction_years === null &&
      data.guilty_plea_reduction_months === null
        ? null
        : (data.guilty_plea_reduction_years || 0) * 12 +
          (data.guilty_plea_reduction_months || 0),
  }))

export const ChargeDetailSchema = z.object({
  charge_no: z.number(),
  type: ChargeTypeSchema,
  defendant_name: z.string(),
  defendant_id: z.number(),
  source: z.string(),
})

export const TrialSchema = z.object({
  charge_type: ChargeDetailSchema,
  drugs: z.array(DrugDetailSchema),
  roles: z.array(RoleDetailSchema),
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

export const TrialsSchema = z.object({
  trials: z.array(TrialSchema),
})

// Judgement schemas
export const ChargeNameSchema = z.enum([
  'Trafficking in a dangerous drug',
  'Trafficking in dangerous drugs',
  'Conspiracy to traffic in a dangerous drug',
  'Conspiracy to traffic in dangerous drugs',
])

export const NatureOfPlaceSchema = z.enum([
  'Residential building',
  'Commercial building',
  'Industrial building',
  'Government or public building',
  'Entertainment venue',
  'Street',
  'Car park or parking lot',
  'Shopping mall',
  'Public transport',
  'Private vehicle',
  'Restaurant',
  'Educational institution',
  'Hospital or medical facility',
  'Outside methadone clinic',
  'Recreational area',
  'Hotel or guesthouse',
  'Construction site',
  'Vacant or abandoned property',
  'Border checkpoint',
  'Other',
])

export const TraffickingModeEnumSchema = z.enum([
  'Street-level dealing',
  'Social supply',
  'Courier delivery',
  'Parcel delivery',
  'Drug houses',
  'Vehicle-based dealing',
  'Vehicle concealment',
  'Mule trafficking',
  'Drug repackaging or storage',
  'Maritime transport',
  'Festival or event dealing',
  'Online trafficking',
  'Other',
])

export const ReasonForOffenceSchema = z.enum([
  'Financial gain',
  'Economic hardship',
  'Coercion',
  'Deception',
  'Addiction-driven',
  'Peer influence',
  'Helping other people',
  'Other',
])

export const ImportExportEnumSchema = z.enum(['import', 'export'])

// District enums
export const DistrictSchema = z.enum(districts)

export const SubDistrictSchema = z.enum(subDistricts)

export const DateDetailInputSchema = z.object({
  date: z.union([
    z.string().refine(
      (val) => {
        try {
          const date = new Date(val)
          return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(val)
        } catch {
          return false
        }
      },
      { message: 'Invalid date format (expected YYYY-MM-DD)' },
    ),
    z
      .array(
        z.string().refine(
          (val) => {
            try {
              const date = new Date(val)
              return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(val)
            } catch {
              return false
            }
          },
          { message: 'Invalid date format (expected YYYY-MM-DD)' },
        ),
      )
      .length(2),
  ]),
  source: z.string(),
})

export const DateDetailSchema = DateDetailInputSchema.transform((data) => {
  if(Array.isArray(data.date)){
    const days = data.date.map((dateStr) => {
      const dateObj = new Date(dateStr)
      return dateObj.getDay() === 0 ? 7 : dateObj.getDay()
    })
    const isHoliday = data.date.some((dateStr) => {
      const dateObj = new Date(dateStr)
      return hd.isHoliday(dateObj)
    })
    return {
      ...data,
      day_of_week: days,
      is_hk_public_holiday: isHoliday,
    }
  }
  const dateObj = new Date(data.date)
  return {
    ...data,
    day_of_week: dateObj.getDay() === 0 ? 7 : dateObj.getDay(),
    is_hk_public_holiday: hd.isHoliday(dateObj) ? true : false,
  }
})

export const TimeDetailInputSchema = z.object({
  time: z.string().refine(
    (val) => {
      // Match time with optional timezone: HH:MM:SS or HH:MM:SS+HH:MM
      return /^\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/.test(val)
    },
    { message: 'Invalid time format (expected HH:MM:SS or HH:MM:SS+HH:MM)' },
  ),
  source: z.string(),
})

export const TimeDetailSchema = TimeDetailInputSchema.transform((data) => {
  const hour = parseInt(data.time.split(':')[0])
  let time_of_day: string
  if (hour >= 6 && hour < 12) time_of_day = 'morning'
  else if (hour >= 12 && hour < 18) time_of_day = 'afternoon'
  else if (hour >= 18 && hour < 23) time_of_day = 'evening'
  else time_of_day = 'night'

  return {
    ...data,
    time_of_day,
  }
})

export const PlaceOfOffenceInputSchema = z.object({
  address: z.string(),
  nature: NatureOfPlaceSchema,
  subDistrict: SubDistrictSchema,
  source: z.string(),
})

export const PlaceOfOffenceSchema = PlaceOfOffenceInputSchema.transform(
  (data) => ({
    ...data,
    district: getDistrictBySubDistrict(data.subDistrict),
  }),
)

export const TraffickingModeSchema = z.object({
  mode: TraffickingModeEnumSchema,
  source: z.string(),
})

export const ReasonForOffenceDetailSchema = z.object({
  reason: ReasonForOffenceSchema,
  source: z.string(),
})

export const BenefitsReceivedDetailSchema = z.object({
  received: z.boolean(),
  amount: z.number().nullable().default(null),
  source: z.string(),
})

export const CrossBorderDetailSchema = z.object({
  cross_border: z.boolean(),
  type: ImportExportEnumSchema.nullable().default(null),
  source: z.string(),
})

export const ChargeForDefendantSchema = z.object({
  defendant_name: z.string(),
  defendant_id: z.number().nullable().default(null),
  trafficking_mode: TraffickingModeSchema.nullable().default(null),
  reasons_for_offence: z
    .array(ReasonForOffenceDetailSchema)
    .nullable()
    .default(null),
  benefits_received: BenefitsReceivedDetailSchema.nullable().default(null),
})

export const ChargeSchema = z.object({
  charge_no: z.number().nullable().default(null),
  charge_name: ChargeNameSchema,
  offence_date: DateDetailSchema.nullable().default(null),
  offence_time: TimeDetailSchema.nullable().default(null),
  place_of_offence: PlaceOfOffenceSchema.nullable().default(null),
  cross_border: CrossBorderDetailSchema,
  defendants_of_charge: z.array(ChargeForDefendantSchema),
})

export const RepresentativeSchema = z.object({
  name: z.string(),
  role: z.string(),
})

export const DefendantInfoSchema = z.object({
  id: z.number(),
  name: z.string(),
})

export const JudgementInputSchema = z.object({
  neutral_citation: z
    .string()
    .regex(
      /^\[\d{4}\]\s+[A-Z]+\s+\d+$/,
      'Invalid neutral citation format (e.g., [2025] HKCFI 100)',
    ),
  judge_name: z.string(),
  judgment_date_time: z.string().refine(
    (val) => {
      try {
        const date = new Date(val)
        return (
          (!isNaN(date.getTime()) &&
            val === date.toISOString().replace('Z', '+00:00')) ||
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)$/.test(val)
        )
      } catch {
        return false
      }
    },
    {
      message:
        'Invalid ISO 8601 datetime format (e.g., 2025-08-06T00:00:00+08:00)',
    },
  ),
  representatives: z.array(RepresentativeSchema),
  cases_heard: z.array(z.string().regex(/^[A-Z]+\s+\d+\/\d{4}$/)).min(1),
  charges: z.array(ChargeSchema),
})

export const JudgementSchema = JudgementInputSchema.transform((data) => ({
  ...data,
  court: data.neutral_citation.split(' ')[1],
  defendants: [] as Array<typeof DefendantInfoSchema>, // Simplified - would need complex logic
}))

// Defendants schemas
export const NationalityCategorySchema = z.enum([
  'Hong Kong resident',
  'Mainland Chinese',
  'Foreign nationality',
])

export const HKResidentStatusSchema = z.enum([
  'Permanent resident',
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

export const MonthlyWageDetailSchema = z.object({
  wage: z.number(),
  source: z.string(),
})

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

export const COMPUTED_FIELDS = [
  'total_months',
  'guilty_plea_reduction_total_months',
  'day_of_week',
  'is_hk_public_holiday',
  'time_of_day',
  'district',
  'court',
  //   'defendants',
  'tracing_id',
]

// Schema mapping for field names
export const FIELD_SCHEMAS: Partial<Record<string, z.ZodTypeAny>> = {
  // Trial schemas
  trials: TrialSchema,
  drugs: DrugDetailSchema,
  roles: RoleDetailSchema,
  aggravating_factors: AggravatingFactorDetailSchema,
  mitigating_factors: MitigatingFactorDetailSchema,
  guilty_plea: GuiltyPleaDetailSchema,
  starting_point: StartingPointDetailInputSchema,
  sentence_after_role: SentenceAfterRoleDetailInputSchema,
  notional_sentence: NotionalSentenceDetailInputSchema,
  mitigation_reduction: MitigationReductionDetailSchema,
  final_sentence: FinalSentenceDetailInputSchema,
  charge_type: ChargeDetailSchema,

  // Judgement schemas
  judgement: JudgementSchema,
  date: DateDetailInputSchema,
  offence_date: DateDetailInputSchema,
  time: TimeDetailInputSchema,
  offence_time: TimeDetailInputSchema,
  place_of_offence: PlaceOfOffenceInputSchema,
  trafficking_mode: TraffickingModeSchema,
  reasons_for_offence: ReasonForOffenceDetailSchema,
  benefits_received: BenefitsReceivedDetailSchema,
  cross_border: CrossBorderDetailSchema,
  charges: ChargeSchema,
  representatives: RepresentativeSchema,
  defendants_of_charge: ChargeForDefendantSchema,
  cases_heard: z.string().regex(/^[A-Z]+\s+\d+\/\d{4}$/),

  // Defendant schemas
  defendants: DefendantProfileSchema,
  defendant_name: DefendantNameDetailSchema,
  nationality: NationalitySchema,
  age_at_offence: AgeAtOffenceSchema,
  age_at_sentencing: AgeAtSentencingSchema,
  gender: GenderDetailSchema,
  marital_status: MaritalStatusDetailSchema,
  parental_status: ParentalStatusSchema,
  household_composition: HouseholdCompositionDetailSchema,
  health_conditions: HealthConditionSchema,
  drug_treatment_participation: DrugTreatmentDetailSchema,
  education_level: EducationLevelDetailSchema,
  occupation: OccupationSchema,
  monthly_wage: MonthlyWageDetailSchema,
  criminal_records: CriminalRecordDetailSchema,
  positive_habits_after_arrest: PositiveHabitDetailSchema,
  family_supports: FamilySupportDetailSchema,
}

const FIELD_IS_ARRAY: Array<string> = [
  'drugs',
  'roles',
  'aggravating_factors',
  'mitigating_factors',
  'charges',
  'defendants',
  'criminal_records',
  'positive_habits_after_arrest',
  'family_supports',
  'reasons_for_offence',
  'representatives',
  'health_conditions'
]

// Function to check if a field is nullable in the schema
export function isFieldNullable(
  fieldName: string,
  parentFieldName?: string,
): boolean {
  // Check parent field schema if provided
  const parentSchema = parentFieldName ? FIELD_SCHEMAS[parentFieldName] : null

  if (parentSchema && parentSchema instanceof z.ZodObject) {
    const shape = parentSchema.shape
    const fieldSchema = shape[fieldName] as z.ZodTypeAny

    // Check if the field itself is nullable or optional
    if (
      fieldSchema instanceof z.ZodNullable ||
      fieldSchema instanceof z.ZodOptional
    ) {
      return true
    }

    // Check if it's a default with nullable inner type
    if (fieldSchema instanceof z.ZodDefault) {
      const innerType = (fieldSchema as any)._def.innerType
      return (
        innerType instanceof z.ZodNullable || innerType instanceof z.ZodOptional
      )
    }
  }

  return false
}

// Function to get default value for a field based on its schema
export function getDefaultValueForField(
  fieldName: string,
  parentFieldName?: string,
  isSetValue = false,
): any {
  let schema = FIELD_SCHEMAS[fieldName]

  // If we don't have a direct schema match and we have a parent field,
  // check if the parent is an array and get its item type
  if (!schema && parentFieldName) {
    const parentSchema = FIELD_SCHEMAS[parentFieldName]
    if (parentSchema instanceof z.ZodObject) {
      const shape = parentSchema.shape
      const parentFieldSchema = shape[fieldName] as z.ZodTypeAny

      schema = unwrapSchema(parentFieldSchema)
    }
  }

  if (!schema) {
    // If no specific schema found, return empty object
    return {}
  }

  // Unwrap the schema to get to the actual type
  const unwrappedSchema = unwrapSchema(schema)

  // Check if it's a ZodObject
  if (unwrappedSchema instanceof z.ZodObject) {
    const shape = unwrappedSchema.shape
    const defaultValue: Record<string, any> = {}

    for (const [key, fieldSchema] of Object.entries(shape)) {
      defaultValue[key] = getDefaultValueForFieldSchema(
        fieldSchema as z.ZodTypeAny,
        key,
      )
    }

    if (isSetValue && FIELD_IS_ARRAY.includes(fieldName)) {
      return [defaultValue]
    }
    return defaultValue
  }

  // For other types, use the helper
  return getDefaultValueForFieldSchema(unwrappedSchema, fieldName)
}

// Helper to unwrap nullable, optional, default, and pipe wrappers
function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return unwrapSchema((schema as any)._def.innerType)
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema((schema as any)._def.innerType)
  }
  // Handle ZodPipe (created by .transform() in Zod v4)
  if ((schema as any)._def?.type === 'pipe' && (schema as any)._def?.in) {
    return unwrapSchema((schema as any)._def.in)
  }
  // if (schema instanceof z.ZodArray) {
  //   // For arrays, return the element type
  //   return unwrapSchema((schema as any)._def.type)
  // }
  return schema
}

// Helper to get default value for a specific schema type
function getDefaultValueForFieldSchema(
  fieldSchema: z.ZodTypeAny,
  fieldName: string,
): any {
  // Check if it has a default value
  if (fieldSchema instanceof z.ZodDefault) {
    const defaultFn = (fieldSchema as any)._def.defaultValue
    return typeof defaultFn === 'function' ? defaultFn() : null
  }

  // Unwrap to get the actual type
  const unwrapped = unwrapSchema(fieldSchema)

  if (unwrapped instanceof z.ZodString) {
    return ''
  }
  if (unwrapped instanceof z.ZodNumber) {
    return 0
  }
  if (unwrapped instanceof z.ZodBoolean) {
    return false
  }
  if (unwrapped instanceof z.ZodEnum) {
    // Use first enum value as default for enums (even if nullable)
    return unwrapped.options[0]
  }
  if (unwrapped instanceof z.ZodArray) {
    return []
  }
  if (unwrapped instanceof z.ZodObject) {
    // Recursively create default for nested objects
    return getDefaultValueForField(fieldName)
  }
  // For union types (e.g., string | array, number | array), default to the first option
  if (unwrapped instanceof z.ZodUnion) {
    const firstOption = (unwrapped as any)._def.options[0]
    return getDefaultValueForFieldSchema(firstOption, fieldName)
  }

  // For nullable/optional non-enum fields, return null
  if (
    fieldSchema instanceof z.ZodNullable ||
    fieldSchema instanceof z.ZodOptional
  ) {
    return null
  }

  // Default fallback
  return null
}

// Enum options mapping
// Keys are in format "parentField_fieldName" to distinguish fields with same names in different contexts
export const ENUM_OPTIONS: Record<string, Array<string>> = {
  drug_type: getEnumValues(DrugTypeSchema),
  roles_role: getEnumValues(DefendantRoleSchema),
  aggravating_factors_factor: getEnumValues(AggravatingFactorTypeSchema),
  mitigating_factors_habits: getEnumValues(PositiveHabitSchema),
  mitigating_factors_support: getEnumValues(FamilySupportSchema),
  charges_type: getEnumValues(ChargeTypeSchema),
  guilty_plea_court_type: getEnumValues(CourtTypeSchema),
  guilty_plea_high_court_stage: getEnumValues(HighCourtPleaStageSchema),
  guilty_plea_district_court_stage: getEnumValues(DistrictCourtPleaStageSchema),
  charges_charge_name: getEnumValues(ChargeNameSchema),
  place_of_offence_nature: getEnumValues(NatureOfPlaceSchema),
  trafficking_mode_mode: getEnumValues(TraffickingModeEnumSchema),
  defendants_of_charge_reasons_for_offence: getEnumValues(
    ReasonForOffenceSchema,
  ),
  reasons_for_offence_reason: getEnumValues(ReasonForOffenceSchema),
  cross_border_type: getEnumValues(ImportExportEnumSchema),
  place_of_offence_subDistrict: getEnumValues(SubDistrictSchema),
  nationality_category: getEnumValues(NationalityCategorySchema),
  nationality_hk_resident_status: getEnumValues(HKResidentStatusSchema),
  gender: getEnumValues(GenderSchema),
  marital_status_status: getEnumValues(MaritalStatusSchema),
  parental_status_status: getEnumValues(ParentalStatusEnumSchema),
  parental_status_custody: getEnumValues(CustodyStatusSchema),
  household_composition_composition: getEnumValues(HouseholdCompositionSchema),
  education_level_level: getEnumValues(EducationLevelSchema),
  occupation_occupation_category: getEnumValues(OccupationCategorySchema),
  criminal_records_record: getEnumValues(CriminalRecordSchema),
  health_conditions_type: getEnumValues(HealthStatusTypeSchema),
  positive_habits_after_arrest_habit: getEnumValues(PositiveHabitSchema),
  family_supports_support: getEnumValues(FamilySupportSchema),
}

// Type exports
export type DrugType = z.infer<typeof DrugTypeSchema>
export type DefendantRole = z.infer<typeof DefendantRoleSchema>
export type Trial = z.infer<typeof TrialSchema>
export type Trials = z.infer<typeof TrialsSchema>
export type Judgement = z.infer<typeof JudgementSchema>
export type DefendantProfile = z.infer<typeof DefendantProfileSchema>
export type Defendants = z.infer<typeof DefendantsSchema>
