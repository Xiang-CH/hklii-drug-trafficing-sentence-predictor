import { z } from 'zod'
import {
  MANDATORY_NOT_GIVEN_FIELDS,
  getDefaultValueForField,
  getDefaultValueForFieldSchema,
  getSchemaByPath,
} from './schema'

type NotGivenMap = Record<string, boolean>

function parsePath(path: string): Array<string | number> {
  const out: Array<string | number> = []
  const re = /([^[.\]]+)|\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(path)) !== null) {
    if (m[1]) out.push(m[1])
    else if (m[2]) out.push(Number(m[2]))
  }
  return out
}

function setAtPath(obj: any, tokens: Array<string | number>, value: any) {
  let cur = obj
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i]
    if (cur == null) return
    cur = cur[t as any]
  }
  const last = tokens[tokens.length - 1]
  if (cur != null) cur[last as any] = value
}

function unwrapSchema(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return unwrapSchema((schema as any)._def.innerType)
  }
  if (schema instanceof z.ZodDefault) {
    return unwrapSchema((schema as any)._def.innerType)
  }
  if (schema instanceof z.ZodPipe) {
    return unwrapSchema((schema as any).in)
  }
  if ((schema as any)?._def?.type === 'pipe' && (schema as any)?._def?.in) {
    return unwrapSchema((schema as any)._def.in)
  }
  return schema
}

function getDefaultFromSchema(
  schema: z.ZodTypeAny,
  fieldNameForFallback?: string,
  parentFieldForFallback?: string,
): any {
  if (schema instanceof z.ZodDefault) {
    const defaultFn = (schema as any)._def.defaultValue
    return typeof defaultFn === 'function' ? defaultFn() : defaultFn
  }

  if (schema instanceof z.ZodNullable || schema instanceof z.ZodOptional) {
    return null
  }

  const unwrapped = unwrapSchema(schema)

  if (unwrapped instanceof z.ZodString) return ''
  if (unwrapped instanceof z.ZodNumber) return 0
  if (unwrapped instanceof z.ZodBoolean) return false
  if (unwrapped instanceof z.ZodEnum) return unwrapped.options[0]
  if (unwrapped instanceof z.ZodArray) return []
  if (unwrapped instanceof z.ZodUnion) {
    const firstOption = (unwrapped as any)._def.options[0]
    return getDefaultFromSchema(firstOption)
  }
  if (unwrapped instanceof z.ZodObject) {
    const shape = unwrapped.shape
    const result: Record<string, any> = {}
    for (const [key, childSchema] of Object.entries(shape)) {
      result[key] = getDefaultFromSchema(childSchema as z.ZodTypeAny, key)
    }
    return result
  }

  if (fieldNameForFallback) {
    return getDefaultValueForField(fieldNameForFallback, parentFieldForFallback)
  }

  return null
}

function getLastStringTokens(tokens: Array<string | number>): {
  fieldName?: string
  parentFieldName?: string
} {
  let fieldName: string | undefined
  let parentFieldName: string | undefined

  for (const token of tokens) {
    if (typeof token !== 'string') continue
    parentFieldName = fieldName
    fieldName = token
  }

  return { fieldName, parentFieldName }
}

function isEmptyLike(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

function joinPath(basePath: string, key: string): string {
  return basePath ? `${basePath}.${key}` : key
}

function traverseMandatoryNotGiven(
  value: unknown,
  basePath: string,
  map: NotGivenMap,
) {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      traverseMandatoryNotGiven(item, `${basePath}[${index}]`, map)
    })
    return
  }
  if (typeof value !== 'object') return

  for (const [key, childValue] of Object.entries(value)) {
    const currentPath = joinPath(basePath, key)
    if (MANDATORY_NOT_GIVEN_FIELDS.includes(key) && isEmptyLike(childValue)) {
      map[currentPath] = true
    }
    traverseMandatoryNotGiven(childValue, currentPath, map)
  }
}

export function deriveNotGivenMapFromPayload(payload: {
  judgement?: unknown
  defendants?: unknown
  trials?: unknown
}): NotGivenMap {
  const map: NotGivenMap = {}
  traverseMandatoryNotGiven(payload.judgement, 'judgement', map)
  traverseMandatoryNotGiven(payload.defendants, 'defendants', map)
  traverseMandatoryNotGiven(payload.trials, 'trials', map)
  return map
}

export function applyNotGivenToPayload<T extends object>(
  payload: T,
  notGivenMap: NotGivenMap,
): T {
  const cloned: any =
    typeof structuredClone === 'function'
      ? structuredClone(payload)
      : JSON.parse(JSON.stringify(payload))

  for (const [path, isNotGiven] of Object.entries(notGivenMap)) {
    if (!isNotGiven) continue
    if (
      !(
        path.startsWith('judgement') ||
        path.startsWith('defendants') ||
        path.startsWith('trials')
      )
    ) {
      continue
    }
    const tokens = parsePath(path)
    if (tokens.length === 0) continue
    const fieldSchema = getSchemaByPath(path)
    // console.log(`Applying not given to path: ${path}, schema is array: ${fieldSchema instanceof z.ZodArray}`)
    const { fieldName, parentFieldName } = getLastStringTokens(tokens)
    // console.log(`Applying not given to path: ${path}, fieldName: ${fieldName}, parentFieldName: ${parentFieldName}`)
    const defaultValue = fieldSchema
      ? getDefaultValueForFieldSchema(fieldSchema, fieldName)
      : getDefaultValueForField(fieldName || '', parentFieldName || '')

    // console.log(`Applying not given to path: ${path}, defaultValue: ${defaultValue}`)
    setAtPath(cloned, tokens, defaultValue)
  }

  return cloned
}
