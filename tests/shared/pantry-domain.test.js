import { describe, expect, it } from 'vitest'
import {
  derivePantryStatus,
  matchesPantryFilters,
  normalizePantryItemWrite
} from '../../shared/domain/pantry'

describe('derivePantryStatus', () => {
  it('marks items as expiring soon when the expiration date is near', () => {
    expect(
      derivePantryStatus({
        expirationDate: '2026-04-12',
        now: '2026-04-10'
      })
    ).toBe('expiring-soon')
  })

  it('marks items as expired when the expiration date has passed', () => {
    expect(
      derivePantryStatus({
        expirationDate: '2026-04-09',
        now: '2026-04-10'
      })
    ).toBe('expired')
  })

  it('marks items without an expiration date as fresh', () => {
    expect(
      derivePantryStatus({
        expirationDate: '',
        now: '2026-04-10'
      })
    ).toBe('fresh')
  })
})

describe('normalizePantryItemWrite', () => {
  it('fills defaults and normalizes trimmed pantry fields', () => {
    expect(
      normalizePantryItemWrite({
        name: '  Milk  ',
        category: ' dairy ',
        quantity: '',
        unit: ' box ',
        location: ' fridge ',
        notes: '  use soon ',
        expirationDate: '2026-04-15',
        now: '2026-04-10'
      })
    ).toEqual(
      expect.objectContaining({
        name: 'Milk',
        category: 'dairy',
        quantity: '1',
        unit: 'box',
        usageStatus: 'normal',
        location: 'fridge',
        notes: 'use soon',
        expirationDate: '2026-04-15',
        status: 'fresh',
        productionDate: '',
        shelfLifeMonths: '',
        openedDate: ''
      })
    )
  })

  it('keeps supported manual usageStatus values and falls back to normal on unknown values', () => {
    expect(
      normalizePantryItemWrite({
        name: 'Yogurt',
        usageStatus: 'opened',
        now: '2026-04-10'
      })
    ).toEqual(
      expect.objectContaining({
        usageStatus: 'opened'
      })
    )

    expect(
      normalizePantryItemWrite({
        name: 'Yogurt',
        usageStatus: 'mystery',
        now: '2026-04-10'
      })
    ).toEqual(
      expect.objectContaining({
        usageStatus: 'normal'
      })
    )
  })

  it('drops impossible expiration dates during normalization', () => {
    expect(
      normalizePantryItemWrite({
        name: 'Eggs',
        expirationDate: '2026-02-30',
        now: '2026-04-10'
      })
    ).toEqual(
      expect.objectContaining({
        expirationDate: ''
      })
    )
  })

  it('derives expiration date from production date and shelf life months while keeping extra pantry fields', () => {
    expect(
      normalizePantryItemWrite({
        name: 'Yogurt',
        quantity: '3',
        productionDate: '2026-01-15',
        shelfLifeMonths: '2',
        openedDate: '2026-01-20',
        usageStatus: 'discarded',
        now: '2026-02-01'
      })
    ).toEqual(
      expect.objectContaining({
        quantity: '3',
        productionDate: '2026-01-15',
        shelfLifeMonths: '2',
        openedDate: '2026-01-20',
        expirationDate: '2026-03-15',
        usageStatus: 'discarded',
        status: 'fresh'
      })
    )
  })
})

describe('matchesPantryFilters', () => {
  const item = {
    category: 'produce',
    location: 'fridge',
    status: 'expiring-soon'
  }

  it('matches when all provided filters align', () => {
    expect(
      matchesPantryFilters(item, {
        category: 'produce',
        location: 'fridge',
        status: 'expiring-soon'
      })
    ).toBe(true)
  })

  it('ignores blank filters and rejects non-matching values', () => {
    expect(
      matchesPantryFilters(item, {
        category: '',
        location: 'freezer',
        status: ''
      })
    ).toBe(false)
  })
})
