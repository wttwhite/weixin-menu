import { describe, expect, it } from 'vitest'
import { toIsoDate, isValidIsoDate, daysBetween } from '../../shared/utils/time'

describe('toIsoDate', () => {
  it('returns yyyy-mm-dd from a Date object', () => {
    const utcDate = new Date(Date.UTC(2026, 3, 10, 12, 0, 0))
    expect(toIsoDate(utcDate)).toBe('2026-04-10')
  })
})

describe('isValidIsoDate', () => {
  it('returns true for a valid date string', () => {
    expect(isValidIsoDate('2026-04-10')).toBe(true)
  })

  it('returns false for invalid dates and non-iso format', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('10-04-2026')).toBe(false)
  })
})

describe('daysBetween', () => {
  it('returns whole-day difference between two iso dates', () => {
    expect(daysBetween('2026-04-10', '2026-04-13')).toBe(3)
  })
})
