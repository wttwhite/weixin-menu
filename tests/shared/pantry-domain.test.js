import { describe, expect, it } from 'vitest'
import {
  derivePantryStatus,
  matchesPantryFilters,
  normalizePantryItemWrite
} from '../../shared/domain/pantry'

describe('derivePantryStatus', () => {
  it('marks items as expiring soon when the expiration date is within one month', () => {
    expect(
      derivePantryStatus({
        status: 'active',
        expirationDate: '2026-05-10',
        now: '2026-04-10'
      })
    ).toBe('expiring')
  })

  it('marks items as expired when the expiration date has passed', () => {
    expect(
      derivePantryStatus({
        status: 'active',
        expirationDate: '2026-04-09',
        now: '2026-04-10'
      })
    ).toBe('expired')
  })

  it('keeps empty or discarded items in their handled states', () => {
    expect(
      derivePantryStatus({
        status: 'empty',
        expirationDate: '',
        now: '2026-04-10'
      })
    ).toBe('empty')
    expect(
      derivePantryStatus({
        status: 'discarded',
        expirationDate: '2026-04-09',
        now: '2026-04-10'
      })
    ).toBe('discarded')
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
        location: 'fridge',
        notes: 'use soon',
        expirationDate: '2026-04-15',
        status: 'active',
        handledType: null,
        handledAt: null,
        productionDate: '',
        shelfLifeMonths: '',
        openedDate: ''
      })
    )
  })

  it('keeps half-step quantity values instead of forcing integers', () => {
    expect(
      normalizePantryItemWrite({
        name: 'Milk',
        quantity: '0.5',
        unit: '盒'
      })
    ).toEqual(
      expect.objectContaining({
        quantity: '0.5',
        unit: '盒'
      })
    )
  })

  it('keeps supported manual status values and falls back to active on unknown values', () => {
    expect(
      normalizePantryItemWrite({
        name: 'Yogurt',
        status: 'opened',
        now: '2026-04-10'
      })
    ).toEqual(
      expect.objectContaining({
        status: 'opened'
      })
    )

    expect(
      normalizePantryItemWrite({
        name: 'Yogurt',
        status: 'mystery',
        now: '2026-04-10'
      })
    ).toEqual(
      expect.objectContaining({
        status: 'active'
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
        status: 'discarded',
        handledType: 'discarded',
        handledAt: '2026-02-01T00:00:00.000Z',
        now: '2026-02-01'
      })
    ).toEqual(
      expect.objectContaining({
        quantity: '3',
        productionDate: '2026-01-15',
        shelfLifeMonths: '2',
        openedDate: '2026-01-20',
        expirationDate: '2026-03-15',
        status: 'discarded',
        handledType: 'discarded',
        handledAt: '2026-02-01T00:00:00.000Z'
      })
    )
  })
})

describe('matchesPantryFilters', () => {
  const item = {
    category: 'produce',
    location: 'fridge',
    status: 'expiring'
  }

  it('matches when all provided filters align', () => {
    expect(
      matchesPantryFilters(item, {
        category: 'produce',
        location: 'fridge',
        status: 'expiring'
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
