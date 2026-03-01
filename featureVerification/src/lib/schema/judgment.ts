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
  time: z.string().refine(
    (val) => {
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
  defendant_id: z.number(),
  trafficking_mode: TraffickingModeSchema.nullable().default(null),
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
  cases_heard: z.array(z.string().regex(/^[A-Z]+\s+\d+\/\d{4}$/)).min(1),
  charges: z.array(ChargeSchema),
})

export const JudgementSchema = JudgementInputSchema.transform((data) => ({
  ...data,
  court: data.neutral_citation.split(' ')[1],
  defendants: [] as Array<typeof DefendantInfoSchema>,
}))
