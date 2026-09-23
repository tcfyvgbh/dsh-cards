import { describe, expect, it } from 'vitest'
import { specFromArgs } from '../src/spec/args.ts'

describe('specFromArgs', () => {
  it('parses and validates the spec inside raw tool arguments', () => {
    const result = specFromArgs(JSON.stringify({ spec: { items: [{ type: 'text', text: 'a' }] } }))
    expect(result).toEqual({ ok: true, spec: { items: [{ type: 'text', text: 'a' }] }, nodes: 1 })
  })

  it('returns undefined for non-strings and unreadable JSON', () => {
    expect(specFromArgs(undefined)).toBeUndefined()
    expect(specFromArgs({ spec: {} })).toBeUndefined()
    expect(specFromArgs('{"spec":')).toBeUndefined()
  })

  it('reports a missing or invalid spec as a failed validation', () => {
    const result = specFromArgs('{}')
    expect(result?.ok).toBe(false)
  })
})
