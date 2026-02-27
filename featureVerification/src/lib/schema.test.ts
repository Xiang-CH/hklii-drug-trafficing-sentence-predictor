import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  ChargeNameSchema,
  DefendantRoleSchema,
  GenderSchema,
  ReasonForOffenceSchema,
  getDefaultValueForField,
  getDefaultValueForFieldSchema,
  getSchemaByPath,
} from './schema'

describe('getSchemaByPath', () => {
  it('returns nested enum schema for trials path', () => {
    const schema = getSchemaByPath('trials.trials[0].roles[0].role')
    console.log(schema)
    expect(schema).toBe(DefendantRoleSchema)
  })

  it('return array schema for array fields', () => {
    const schema = getSchemaByPath('trials.trials[0].roles')
    console.log(schema)
    expect(schema).toBeInstanceOf(z.ZodArray)
  })

  it('resolves through transformed and defaulted schemas', () => {
    const chargeNameSchema = getSchemaByPath('judgement.charges[0].charge_name')
    const reasonSchema = getSchemaByPath(
      'judgement.charges[0].defendants_of_charge[0].reasons_for_offence[3].reason',
    )
    const ageSchema = getSchemaByPath('defendants[0].age_at_offence.age')

    expect(chargeNameSchema).toBe(ChargeNameSchema)
    expect(reasonSchema).toBe(ReasonForOffenceSchema)
    expect(ageSchema).toBeInstanceOf(z.ZodUnion)
  })

  it('resolves defendant field schema', () => {
    const schema = getSchemaByPath('defendants[1].gender.gender')
    expect(schema).toBe(GenderSchema)
  })

  it('returns null for invalid paths', () => {
    expect(getSchemaByPath('trials[0].roles.role')).toBeNull()
    expect(getSchemaByPath('trials[0].not_a_field')).toBeNull()
    expect(getSchemaByPath('')).toBeNull()
  })
})

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
