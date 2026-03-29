import { z } from 'zod'

import {
  AggravatingFactorDetailSchema,
  AggravatingFactorTypeSchema,
  ChargeDetailSchema,
  CourtTypeSchema,
  DistrictCourtPleaStageSchema,
  DrugDetailSchema,
  DrugTypeSchema,
  FinalSentenceDetailInputSchema,
  GuiltyPleaDetailSchema,
  HighCourtPleaStageSchema,
  MitigatingFactorDetailSchema,
  MitigatingFactorTypeSchema,
  MitigationReductionDetailSchema,
  NotionalSentenceDetailInputSchema,
  SentenceAfterRoleDetailInputSchema,
  StartingPointDetailInputSchema,
  TrialSchema,
} from './trial'
import {
  AgeAtOffenceSchema,
  AgeAtSentencingSchema,
  CriminalRecordDetailSchema,
  CriminalRecordSchema,
  CustodyStatusSchema,
  DefendantNameDetailSchema,
  DefendantProfileSchema,
  DrugTreatmentDetailSchema,
  EducationLevelDetailSchema,
  EducationLevelSchema,
  FamilySupportDetailSchema,
  FamilySupportSchema,
  GenderDetailSchema,
  GenderSchema,
  GovernmentSubsidyEnumSchema,
  GovernmentSubsidyRecipientSchema,
  HKResidentStatusSchema,
  HealthConditionSchema,
  HealthStatusTypeSchema,
  HouseholdCompositionDetailSchema,
  HouseholdCompositionSchema,
  MaritalStatusDetailSchema,
  MaritalStatusSchema,
  MonthlyWageDetailSchema,
  NationalityCategorySchema,
  NationalitySchema,
  OccupationCategorySchema,
  OccupationSchema,
  ParentalStatusEnumSchema,
  ParentalStatusSchema,
  PositiveHabitDetailSchema,
  PositiveHabitSchema,
} from './defendant'
import {
  BenefitsReceivedDetailSchema,
  BenefitsReceivedStatusSchema,
  BenefitsReceivedTypeSchema,
  ChargeForDefendantSchema,
  ChargeNameSchema,
  ChargeSchema,
  CrossBorderDetailSchema,
  DateDetailInputSchema,
  DefendantRoleSchema,
  ImportExportEnumSchema,
  JudgementSchema,
  NatureOfPlaceSchema,
  PlaceOfOffenceInputSchema,
  ReasonForOffenceDetailSchema,
  ReasonForOffenceSchema,
  RepresentativeSchema,
  RoleDetailSchema,
  SubDistrictSchema,
  TimeDetailInputSchema,
  TimeOfDaySchema,
  TraffickingModeEnumSchema,
  TraffickingModeListSchema,
  TraffickingModeSchema,
} from './judgment'
import { MANDATORY_NOT_GIVEN_FIELDS } from './mandetory-not-given'
import { getEnumValues, unwrapSchema } from './helper'
import type { DefendantsSchema } from './defendant'
import type { TrialsSchema } from './trial'

export * from './trial'
export * from './judgment'
export * from './defendant'
export * from './mandetory-not-given'
export * from './helper'

export const FIELD_SCHEMAS: Partial<Record<string, z.ZodTypeAny>> = {
  trials: TrialSchema,
  drugs: DrugDetailSchema,
  aggravating_factors: AggravatingFactorDetailSchema,
  mitigating_factors: MitigatingFactorDetailSchema,
  guilty_plea: GuiltyPleaDetailSchema,
  starting_point: StartingPointDetailInputSchema,
  sentence_after_role: SentenceAfterRoleDetailInputSchema,
  notional_sentence: NotionalSentenceDetailInputSchema,
  mitigation_reduction: MitigationReductionDetailSchema,
  final_sentence: FinalSentenceDetailInputSchema,
  charge_name: ChargeDetailSchema,
  charge_type: ChargeDetailSchema,

  judgement: JudgementSchema,
  date: DateDetailInputSchema,
  offence_date: DateDetailInputSchema,
  time: TimeDetailInputSchema,
  offence_time: TimeDetailInputSchema,
  place_of_offence: PlaceOfOffenceInputSchema,
  trafficking_mode: z.array(TraffickingModeSchema).nullable(),
  roles_facts: RoleDetailSchema,
  reasons_for_offence: ReasonForOffenceDetailSchema,
  benefits_received: BenefitsReceivedDetailSchema,
  cross_border: CrossBorderDetailSchema,
  charges: ChargeSchema,
  representatives: RepresentativeSchema,
  defendants_of_charge: ChargeForDefendantSchema,
  cases_heard: z.string().regex(/^[A-Z]+\s+\d+[A-Za-z]?\/\d{4}$/),

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
  government_subsidy_recipient: GovernmentSubsidyRecipientSchema,
  criminal_records: CriminalRecordDetailSchema,
  positive_habits_after_arrest: PositiveHabitDetailSchema,
  family_supports: FamilySupportDetailSchema,
}

const FIELD_IS_ARRAY: Array<string> = [
  'drugs',
  'roles_facts',
  'aggravating_factors',
  'mitigating_factors',
  'charges',
  'defendants',
  'criminal_records',
  'positive_habits_after_arrest',
  'family_supports',
  'reasons_for_offence',
  'trafficking_mode',
  'representatives',
  'health_conditions',
]

export function isMandatoryNotGivenField(fieldName: string): boolean {
  return MANDATORY_NOT_GIVEN_FIELDS.includes(fieldName)
}

export function isFieldNullable(
  fieldName: string,
  parentFieldName?: string,
): boolean {
  const parentSchema = parentFieldName ? FIELD_SCHEMAS[parentFieldName] : null

  const parentObj = parentSchema ? unwrapToObject(parentSchema) : null

  if (parentObj instanceof z.ZodObject) {
    const shape = parentObj.shape
    const fieldSchema = shape[fieldName] as z.ZodTypeAny

    if (
      fieldSchema instanceof z.ZodNullable ||
      fieldSchema instanceof z.ZodOptional
    ) {
      return true
    }

    if (fieldSchema instanceof z.ZodDefault) {
      const innerType = (fieldSchema as any)._def.innerType
      return (
        innerType instanceof z.ZodNullable || innerType instanceof z.ZodOptional
      )
    }
  }

  return false
}

function unwrapToObject(schema: any): z.ZodObject<any> | null {
  let cur = schema

  // eslint-disable-next-line
  while (true) {
    if (cur instanceof z.ZodObject) return cur
    if (cur instanceof z.ZodPipe) {
      cur = cur.in
      continue
    }
    return null
  }
}

export function getFieldSchema(
  fieldName: string,
  parentFieldName?: string,
): z.ZodTypeAny | undefined {
  // Prefer the field definition inside the parent object when available.
  // This avoids collisions with root schema names like `time` and `date`.
  if (parentFieldName) {
    const parentSchema = FIELD_SCHEMAS[parentFieldName]
    const parentObj = unwrapToObject(parentSchema)
    if (parentObj instanceof z.ZodObject) {
      const shape = parentObj.shape
      const parentFieldSchema = shape[fieldName] as z.ZodTypeAny | undefined
      if (parentFieldSchema) {
        return unwrapSchema(parentFieldSchema)
      }
    }
  }

  return FIELD_SCHEMAS[fieldName]
}

export function getDefaultValueForField(
  fieldName: string,
  parentFieldName?: string,
  isSetValue = false,
): any {
  let schema: z.ZodTypeAny | undefined

  // Special case for trafficking_mode since it have legacy data and preprocessing.
  if (fieldName === 'trafficking_mode') {
    schema = TraffickingModeSchema
  } else {
    schema = getFieldSchema(fieldName, parentFieldName)
  }

  if (!schema) {
    return {}
  }

  const unwrappedSchema = unwrapSchema(schema)

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

  return getDefaultValueForFieldSchema(unwrappedSchema, fieldName)
}

export function getDefaultValueForArrayItem(
  fieldName: string,
  parentFieldName?: string,
): any {
  let schema: z.ZodTypeAny | undefined

  // Special case for trafficking_mode since it have legacy data and preprocessing.
  if (fieldName === 'trafficking_mode') {
    schema = z.array(TraffickingModeSchema).nullable()
  } else {
    schema = getFieldSchema(fieldName, parentFieldName)
  }

  if (!schema) {
    return {}
  }

  const unwrappedSchema = unwrapSchema(schema)

  if (!(unwrappedSchema instanceof z.ZodArray)) {
    return getDefaultValueForField(fieldName, parentFieldName)
  }

  const itemSchema = (unwrappedSchema as any)._def.element as z.ZodTypeAny
  return getDefaultValueForFieldSchema(itemSchema, fieldName)
}

export function getDefaultValueForFieldSchema(
  fieldSchema: z.ZodTypeAny,
  fieldName?: string,
): any {
  if (fieldSchema instanceof z.ZodDefault) {
    const defaultFn = (fieldSchema as any)._def.defaultValue
    return typeof defaultFn === 'function' ? defaultFn() : defaultFn
  }

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
    return unwrapped.options[0]
  }
  if (unwrapped instanceof z.ZodArray) {
    return []
  }
  if (unwrapped instanceof z.ZodObject) {
    return fieldName ? getDefaultValueForField(fieldName) : null
  }
  if (unwrapped instanceof z.ZodUnion) {
    const firstOption = (unwrapped as any)._def.options[0]
    return getDefaultValueForFieldSchema(firstOption, fieldName)
  }

  if (
    fieldSchema instanceof z.ZodNullable ||
    fieldSchema instanceof z.ZodOptional
  ) {
    return null
  }

  return null
}

export const ENUM_OPTIONS: Record<string, Array<string>> = {
  drug_type: getEnumValues(DrugTypeSchema),
  roles_facts_role: getEnumValues(DefendantRoleSchema),
  aggravating_factors_factor: getEnumValues(AggravatingFactorTypeSchema),
  mitigating_factors_factor: getEnumValues(MitigatingFactorTypeSchema),
  charge_type_charge_name: getEnumValues(ChargeNameSchema),
  guilty_plea_court_type: getEnumValues(CourtTypeSchema),
  guilty_plea_high_court_stage: getEnumValues(HighCourtPleaStageSchema),
  guilty_plea_district_court_stage: getEnumValues(DistrictCourtPleaStageSchema),
  charges_charge_name: getEnumValues(ChargeNameSchema),
  place_of_offence_nature: getEnumValues(NatureOfPlaceSchema),
  trafficking_mode_mode: getEnumValues(TraffickingModeEnumSchema),
  defendants_of_charge_reasons_for_offence: getEnumValues(
    ReasonForOffenceSchema,
  ),
  benefits_received_amount_type: getEnumValues(BenefitsReceivedTypeSchema),
  benefits_received_received: getEnumValues(BenefitsReceivedStatusSchema),
  reasons_for_offence_reason: getEnumValues(ReasonForOffenceSchema),
  cross_border_type: getEnumValues(ImportExportEnumSchema),
  time_time_of_day: getEnumValues(TimeOfDaySchema),
  offence_time_time_of_day: getEnumValues(TimeOfDaySchema),
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
  government_subsidy_recipient_scheme_type: getEnumValues(
    GovernmentSubsidyEnumSchema,
  ),
  criminal_records_record: getEnumValues(CriminalRecordSchema),
  health_conditions_type: getEnumValues(HealthStatusTypeSchema),
  positive_habits_after_arrest_habit: getEnumValues(PositiveHabitSchema),
  family_supports_support: getEnumValues(FamilySupportSchema),
}

export type DrugType = z.infer<typeof DrugTypeSchema>
export type DefendantRole = z.infer<typeof DefendantRoleSchema>
export type Trial = z.infer<typeof TrialSchema>
export type Trials = z.infer<typeof TrialsSchema>
export type Judgement = z.infer<typeof JudgementSchema>
export type DefendantProfile = z.infer<typeof DefendantProfileSchema>
export type Defendants = z.infer<typeof DefendantsSchema>
