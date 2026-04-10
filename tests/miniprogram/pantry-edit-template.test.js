import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('pantry edit template', () => {
  it('does not block selecting past expiration dates in date picker', () => {
    const template = readFileSync('miniprogram/pages/pantry-edit/index.wxml', 'utf8')
    expect(template.includes('start="{{today}}"')).toBe(false)
  })
})
