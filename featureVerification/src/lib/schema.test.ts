import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
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
})

describe('getFieldSchema', () => {
  it('does not throw for root array parents', () => {
    expect(() => getFieldSchema('defendants', 'defendants')).not.toThrow()
    expect(() => getFieldSchema('trials', 'trials')).not.toThrow()
  })
})
