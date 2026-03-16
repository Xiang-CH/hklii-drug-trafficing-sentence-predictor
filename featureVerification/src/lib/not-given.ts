import { MANDATORY_NOT_GIVEN_FIELDS } from './schema'

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
    setAtPath(cloned, tokens, null)
  }

  return cloned
}
