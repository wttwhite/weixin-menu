import { describe, expect, it } from 'vitest'
import { toIsoDate, isValidIsoDate, daysBetween } from '../../shared/utils/time'

describe('toIsoDate', () => {
  it('returns yyyy-mm-dd from a Date object', () => {
    const utcDate = new Date(Date.UTC(2026, 3, 10, 12, 0, 0))
    expect(toIsoDate(utcDate)).toBe('2026-04-10')
  })

  it('normalizes timezone offsets to UTC dates', () => {
    expect(toIsoDate('2026-04-10T23:30:00-05:00')).toBe('2026-04-11')
  })
})

describe('isValidIsoDate', () => {
  it('returns true for a valid date string', () => {
    expect(isValidIsoDate('2026-04-10')).toBe(true)
  })

  it('returns false for invalid dates and non-iso format', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-01-00')).toBe(false)
    expect(isValidIsoDate('10-04-2026')).toBe(false)
  })
})

describe('daysBetween', () => {
  it('returns whole-day difference between two iso dates', () => {
    expect(daysBetween('2026-04-10', '2026-04-13')).toBe(3)
  })

  it('throws on invalid ISO date input', () => {
    expect(() => daysBetween('2026-02-30', '2026-04-13')).toThrow(
      'Invalid ISO date input for daysBetween'
    )
    expect(() => daysBetween('2026-04-10', 'nope')).toThrow(
      'Invalid ISO date input for daysBetween'
    )
  })
})
