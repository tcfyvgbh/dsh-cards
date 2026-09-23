import { isRecord } from './check.ts'
import { parseSpecInput, type ValidationResult } from './validate.ts'

/**
 * Parse a raw tool-arguments JSON string and validate its `spec`.
 * @returns undefined when the input is not a string or the JSON is unreadable.
 */
export function specFromArgs(argsRaw: unknown): ValidationResult | undefined {
  if (typeof argsRaw !== 'string') return undefined
  try {
    const args: unknown = JSON.parse(argsRaw)
    return parseSpecInput(isRecord(args) ? args.spec : undefined)
  } catch {
    return undefined
  }
}
