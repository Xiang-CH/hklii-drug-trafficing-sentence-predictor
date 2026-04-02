import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  ChargeForDefendantSchema,
  FinalSentenceDetailSchema,
  GuiltyPleaDetailSchema,
  getDefaultValueForArrayItem,
  getDefaultValueForField,
  getDefaultValueForFieldSchema,
  getFieldSchema,
  isFieldNullable,
} from './schema'

describe('getDefaultValueForFieldSchema', () => {
  it('handles all supported schema branches', () => {
    const defaultString = z.string().default('hello')
    const defaultNumber = z.number().default(7)
    const enumSchema = z.enum(['A', 'B', 'C'])
    const unionSchema = z.union([z.number(), z.array(z.string())])
    const objectSchema = z.object({ x: z.string() })

    expect(getDefaultValueForFieldSchema(defaultString, 'any')).toBe('hello')
    expect(getDefaultValueForFieldSchema(defaultNumber, 'any')).toBe(7)
    expect(getDefaultValueForFieldSchema(z.string(), 'any')).toBe('')
    expect(getDefaultValueForFieldSchema(z.number(), 'any')).toBe(0)
    expect(getDefaultValueForFieldSchema(z.boolean(), 'any')).toBe(false)
    expect(getDefaultValueForFieldSchema(enumSchema, 'any')).toBe('A')
    expect(getDefaultValueForFieldSchema(z.array(z.string()), 'any')).toEqual(
      [],
    )

    // Object branch delegates to getDefaultValueForField(fieldName)
    expect(getDefaultValueForFieldSchema(objectSchema, 'guilty_plea')).toEqual(
      getDefaultValueForField('guilty_plea'),
    )
    expect(getDefaultValueForFieldSchema(objectSchema)).toBeNull()

    // Union branch uses first option
    expect(getDefaultValueForFieldSchema(unionSchema, 'any')).toBe(0)

    // Nullable/Optional non-primitive branch returns null
    expect(getDefaultValueForFieldSchema(z.nullable(z.unknown()), 'any')).toBe(
      null,
    )
    expect(getDefaultValueForFieldSchema(z.optional(z.unknown()), 'any')).toBe(
      null,
    )

    // Fallback branch
    expect(getDefaultValueForFieldSchema(z.unknown(), 'any')).toBeNull()
  })
})

describe('isFieldNullable', () => {
  it('unwraps transformed parent schemas such as guilty_plea', () => {
    expect(isFieldNullable('court_type', 'guilty_plea')).toBe(true)
    expect(isFieldNullable('high_court_stage', 'guilty_plea')).toBe(true)
    expect(isFieldNullable('district_court_stage', 'guilty_plea')).toBe(true)
    expect(isFieldNullable('reduction_years', 'guilty_plea')).toBe(true)
    expect(isFieldNullable('pleaded_guilty', 'guilty_plea')).toBe(false)
  })
})

describe('getDefaultValueForArrayItem', () => {
  it('returns object defaults for defendants and trials', () => {
    expect(() =>
      getDefaultValueForArrayItem('defendants', 'defendants'),
    ).not.toThrow()
    expect(() => getDefaultValueForArrayItem('trials', 'trials')).not.toThrow()
    expect(getDefaultValueForArrayItem('defendants', 'defendants')).toEqual(
      expect.any(Object),
    )
    expect(getDefaultValueForArrayItem('trials', 'trials')).toEqual(
      expect.any(Object),
    )
  })

  it('returns a single trafficking_mode item default, not a nested array', () => {
    const defaultItem = getDefaultValueForArrayItem(
      'trafficking_mode',
      'defendants_of_charge',
    )

    expect(defaultItem).toEqual({
      mode: 'Street-level dealing',
      source: '',
    })
  })
})

describe('getFieldSchema', () => {
  it('does not throw for root array parents', () => {
    expect(() => getFieldSchema('defendants', 'defendants')).not.toThrow()
    expect(() => getFieldSchema('trials', 'trials')).not.toThrow()
  })
})

describe('getDefaultValueForField', () => {
  it('does not wrap trafficking_mode into nested array for array item set value', () => {
    const defaultValue = getDefaultValueForField(
      'trafficking_mode',
      'trafficking_mode',
      true,
    )

    expect(defaultValue).toEqual([
      {
        mode: 'Street-level dealing',
        source: '',
      },
    ])
  })
})

describe('ChargeForDefendantSchema trafficking_mode compatibility', () => {
  it('coerces legacy object into a single-item array', () => {
    const parsed = ChargeForDefendantSchema.parse({
      defendant_name: 'A',
      defendant_id: 1,
      trafficking_mode: {
        mode: 'Courier delivery',
        source: 'test source',
      },
      roles_facts: null,
      reasons_for_offence: null,
      benefits_received: null,
    })

    expect(parsed.trafficking_mode).toEqual([
      { mode: 'Courier delivery', source: 'test source' },
    ])
  })
})

describe('trial decimal month fields', () => {
  it('accepts decimal months for guilty plea reduction and final sentence', () => {
    const guiltyPlea = GuiltyPleaDetailSchema.parse({
      pleaded_guilty: true,
      court_type: 'District Court',
      high_court_stage: null,
      high_court_stage_other: null,
      district_court_stage: 'Plea day',
      district_court_stage_other: null,
      reduction_years: 0,
      reduction_months: 1.5,
      reduction_percentage: null,
      inferred: false,
      source: 'test source',
    })

    const finalSentence = FinalSentenceDetailSchema.parse({
      sentence_years: 2,
      sentence_months: 3.5,
      source: 'test source',
    })

    expect(guiltyPlea.reduction_months).toBe(1.5)
    expect(guiltyPlea.total_reduction_months).toBe(1.5)
    expect(finalSentence.sentence_months).toBe(3.5)
    expect(finalSentence.total_months).toBe(27.5)
  })
})
