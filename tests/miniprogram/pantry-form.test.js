import { describe, expect, it } from 'vitest'
import {
  createEmptyPantryForm,
  resolveExpirationDate,
  buildManagerOptionLabels,
  getPickerIndex,
  getPickerValue
} from '../../miniprogram/utils/pantry-form'

describe('pantry form helpers', () => {
  it('creates the default pantry draft used by create flows', () => {
    expect(createEmptyPantryForm()).toEqual({
      name: '',
      category: '',
      quantity: '1',
      unit: '',
      location: '',
      productionDate: '',
      shelfLifeMonths: '',
      openedDate: '',
      status: 'active',
      handledType: '',
      handledAt: '',
      expirationDate: '',
      notes: ''
    })
  })

  it('derives expirationDate from productionDate and shelfLifeMonths', () => {
    expect(
      resolveExpirationDate({
        productionDate: '2026-04-16',
        shelfLifeMonths: '2',
        expirationDate: ''
      })
    ).toBe('2026-06-16')
  })

  it('builds picker labels and resolves values safely', () => {
    const options = buildManagerOptionLabels([{ name: '冷藏' }, { name: '冷冻' }], '橱柜')

    expect(options).toEqual(['未设置', '冷藏', '冷冻', '橱柜'])
    expect(getPickerIndex(options, '冷冻')).toBe(2)
    expect(getPickerValue(options, 2)).toBe('冷冻')
    expect(getPickerValue(options, 0)).toBe('')
  })
})
