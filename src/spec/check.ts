import { LIMITS, type Cell, type Node } from './types.ts'

/** One validation problem, addressed by a JSON-ish path such as `items[2].rows[3]`. */
export interface SpecError { readonly path: string; readonly message: string }

/** Outcome of checking one value: a normalized value, or the errors that prevented it. */
export interface Checked<T> { readonly value?: T; readonly errors: readonly SpecError[] }

/** Validates one node object whose `type` already matched. */
export type Rule = (value: Readonly<Record<string, unknown>>, path: string, depth: number) => Checked<Node>

export function ok<T>(value: T): Checked<T> {
  return { value, errors: [] }
}

export function fail<T>(path: string, message: string): Checked<T> {
  return { errors: [{ path, message }] }
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Short human-readable description of a received value, used in error messages. */
export function describe(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '空值'
  if (Array.isArray(value)) return '数组'
  if (typeof value === 'string') return JSON.stringify(value.length > 30 ? `${value.slice(0, 30)}...` : value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return '对象'
}

export function str(value: unknown, path: string): Checked<string> {
  if (value === undefined) return fail(path, '缺少必填字段')
  if (typeof value !== 'string') return fail(path, `应为字符串，收到 ${describe(value)}`)
  if (value.length > LIMITS.text) return fail(path, `字符串长度 ${value.length} 超过上限 ${LIMITS.text}`)
  return ok(value)
}

export function num(value: unknown, path: string): Checked<number> {
  if (value === undefined) return fail(path, '缺少必填字段')
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(path, `应为数字，收到 ${describe(value)}`)
  return ok(value)
}

export function cell(value: unknown, path: string): Checked<Cell> {
  if (typeof value === 'number') return num(value, path)
  if (typeof value === 'string') return str(value, path)
  if (value === undefined) return fail(path, '缺少必填字段')
  return fail(path, `应为字符串或数字，收到 ${describe(value)}`)
}

export function bool(value: unknown, path: string): Checked<boolean> {
  if (typeof value === 'boolean') return ok(value)
  return fail(path, `应为 true 或 false，收到 ${describe(value)}`)
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): Checked<T> {
  if (value === undefined) return fail(path, '缺少必填字段')
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return ok(value as T)
  return fail(path, `只允许 ${allowed.join(' | ')}，收到 ${describe(value)}`)
}

export function intRange(value: unknown, min: number, max: number, path: string): Checked<number> {
  if (value === undefined) return fail(path, '缺少必填字段')
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return fail(path, `应为 ${min} 到 ${max} 之间的整数，收到 ${describe(value)}`)
  }
  return ok(value)
}

/** Skip the check when the field is absent. */
export function optional<T>(
  value: unknown,
  path: string,
  check: (value: unknown, path: string) => Checked<T>,
): Checked<T | undefined> {
  return value === undefined ? ok(undefined) : check(value, path)
}

/** Check that a value is an array whose length sits within bounds. */
export function list(
  value: unknown,
  path: string,
  bounds: { readonly min: number; readonly max: number; readonly noun: string },
): Checked<readonly unknown[]> {
  if (value === undefined) return fail(path, '缺少必填字段')
  if (!Array.isArray(value)) return fail(path, `应为数组，收到 ${describe(value)}`)
  if (value.length < bounds.min) return fail(path, `至少需要 ${bounds.min} 个${bounds.noun}`)
  if (value.length > bounds.max) return fail(path, `${bounds.noun}数量 ${value.length} 超过上限 ${bounds.max}`)
  return ok(value)
}

/** Check every element of an already-checked array; errors from all elements are reported. */
export function each<T>(
  checked: Checked<readonly unknown[]>,
  path: string,
  check: (item: unknown, path: string) => Checked<T>,
): Checked<readonly T[]> {
  if (checked.value === undefined) return { errors: checked.errors }
  const results = checked.value.map((item, index) => check(item, `${path}[${index}]`))
  const errors = results.flatMap(result => result.errors)
  return errors.length > 0 ? { errors } : ok(results.map(result => result.value as T))
}

/** Combine field checks into one object; absent optional fields are omitted from the result. */
export function object<T>(checks: Readonly<Record<string, Checked<unknown>>>): Checked<T> {
  const errors = Object.values(checks).flatMap(check => check.errors)
  if (errors.length > 0) return { errors }
  const entries = Object.entries(checks)
    .filter(([, check]) => check.value !== undefined)
    .map(([key, check]) => [key, check.value] as const)
  return ok(Object.fromEntries(entries) as T)
}
