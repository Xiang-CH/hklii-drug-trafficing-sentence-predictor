import { z } from 'zod'
import Holidays from 'date-holidays'
import {
  districts,
  getDistrictBySubDistrict,
  subDistricts,
} from '../hk-district'

const hd = new Holidays('HK')

export const ChargeNameSchema = z.enum([
  'Trafficking in a dangerous drug',
  'Trafficking in dangerous drugs',
  'Conspiracy to traffic in a dangerous drug',
  'Conspiracy to traffic in dangerous drugs',
])

export const NatureOfPlaceSchema = z.enum([
  'Unknown',
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
  'Possession for trafficking',
  'Online trafficking',
  'Other',
])

export const DefendantRoleSchema = z.enum([
  'Courier',
  'Storekeeper',
  'Packager',
  'Lookout/scout',
  'Actual trafficker',
  'Manager/organizer',
  'Operator/financial controller',
  'International operator/financial controller',
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

export const BenefitsReceivedTypeSchema = z.enum([
  'per day',
  'per month',
  'per instance',
  'total',
  'other',
])

export const BenefitsReceivedStatusSchema = z.enum(['Yes', 'No', 'Unknown'])
const BenefitsReceivedStatusInputSchema = z.preprocess((value) => {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  return value
}, BenefitsReceivedStatusSchema)

export const ImportExportEnumSchema = z.enum(['import', 'export'])

export const TimeOfDaySchema = z.enum([
  'morning',
  'afternoon',
  'evening',
  'night',
])

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
  if (Array.isArray(data.date)) {
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
  time: z
    .string()
    .refine(
      (val) => {
        return /^\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/.test(val)
      },
      { message: 'Invalid time format (expected HH:MM:SS or HH:MM:SS+HH:MM)' },
    )
    .nullable()
    .default(null),
  time_of_day: TimeOfDaySchema.nullable().default(null),
  source: z.string(),
})

function getTimeOfDay(time: string): z.infer<typeof TimeOfDaySchema> {
  const hour = parseInt(time.split(':')[0])
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 23) return 'evening'
  return 'night'
}

export const TimeDetailSchema = TimeDetailInputSchema.superRefine(
  (data, ctx) => {
    if (!data.time) {
      return
    }

    const expectedTimeOfDay = getTimeOfDay(data.time)
    if (data.time_of_day !== expectedTimeOfDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['time_of_day'],
        message: `time_of_day must be "${expectedTimeOfDay}" when time is provided`,
      })
    }
  },
)

export const PlaceOfOffenceInputSchema = z.object({
  address: z.string(),
  nature: NatureOfPlaceSchema,
  subDistrict: SubDistrictSchema.nullable().default(null),
  source: z.string(),
})

export const PlaceOfOffenceSchema = PlaceOfOffenceInputSchema.transform(
  (data) => ({
    ...data,
    district: data.subDistrict
      ? getDistrictBySubDistrict(data.subDistrict)
      : null,
  }),
)

export const TraffickingModeSchema = z.object({
  mode: TraffickingModeEnumSchema,
  source: z.string(),
})

export const TraffickingModeListSchema = z
  .preprocess((value) => {
    if (value === null || value === undefined) {
      return null
    }

    if (Array.isArray(value)) {
      return value
    }

    return [value]
  }, z.array(TraffickingModeSchema))
  .nullable()
  .default(null)

export const RoleDetailSchema = z.object({
  role: DefendantRoleSchema,
  source: z.string(),
})

export const ReasonForOffenceDetailSchema = z.object({
  reason: ReasonForOffenceSchema,
  source: z.string(),
})

export const BenefitsReceivedDetailSchema = z
  .object({
    received: BenefitsReceivedStatusInputSchema.default('Unknown'),
    amount: z
      .union([z.number(), z.array(z.number())])
      .nullable()
      .default(null),
    amount_currency: z.string().nullable().default(null),
    amount_type: BenefitsReceivedTypeSchema.nullable().default(null),
    amount_type_other: z.string().nullable().default(null),
    non_monetary_benefits: z.string().nullable().default(null),
    source: z.string(),
  })
  .refine(
    (data) => {
      if (Array.isArray(data.amount)) {
        return data.amount.length === 2
      }
      return true
    },
    {
      message: 'amount must be a single number or an array of two numbers',
    },
  )
  .refine(
    (data) => {
      if (Array.isArray(data.amount)) {
        return data.amount[1] > data.amount[0]
      }
      return true
    },
    {
      message: 'amount array must be in the format [min, max] with max > min',
    },
  )
  .refine(
    (data) => {
      if (data.amount !== null && data.amount_type === null) {
        return false
      }
      return true
    },
    {
      message: 'amount_type is required when amount is specified',
    },
  )
  .refine(
    (data) => {
      if (data.amount_type === 'other' && data.amount_type_other === null) {
        return false
      }
      return true
    },
    {
      message: 'amount_type_other is required when amount_type is "other"',
    },
  )

export const CrossBorderDetailSchema = z.object({
  cross_border: z.boolean(),
  type: ImportExportEnumSchema.nullable().default(null),
  source: z.string(),
})

export const ChargeForDefendantSchema = z.object({
  defendant_name: z.string(),
  defendant_id: z.number(),
  trafficking_mode: TraffickingModeListSchema,
  roles_facts: z.array(RoleDetailSchema).nullable().default(null),
  reasons_for_offence: z
    .array(ReasonForOffenceDetailSchema)
    .nullable()
    .default(null),
  benefits_received: BenefitsReceivedDetailSchema.nullable().default(null),
})

export const ChargeSchema = z.object({
  charge_no: z.number(),
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
  cases_heard: z
    .array(z.string().regex(/^[A-Z]+\s+\d+[A-Za-z]?\/\d{4}$/))
    .min(1),
  charges: z.array(ChargeSchema),
})

export const JudgementSchema = JudgementInputSchema.transform((data) => {
  const defendantIdMap = new Map<string, number>()
  let currentId = 1

  for (const charge of data.charges) {
    for (const defendant of charge.defendants_of_charge) {
      if (!defendantIdMap.has(defendant.defendant_name)) {
        defendantIdMap.set(defendant.defendant_name, currentId)
        currentId += 1
      }
    }
  }

  return {
    ...data,
    court: data.neutral_citation.split(' ')[1],
    defendants: Array.from(defendantIdMap.entries())
      .map(([name, id]) => ({ id, name }))
      .sort((a, b) => a.id - b.id),
  }
})
