import { describe, expect, it } from 'vitest'
import { validateBackupPayload } from '../../shared/domain/backup'

describe('validateBackupPayload', () => {
  it('accepts a full backup payload with version and top-level collections', () => {
    expect(
      validateBackupPayload({
        version: '1.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        settings: {}
      })
    ).toBe(true)
  })
})
