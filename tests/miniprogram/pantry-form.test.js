import { describe, expect, it } from 'vitest'
import {
  PANTRY_UNIT_OPTIONS,
  buildUnitOptionItems,
  createEmptyPantryForm,
  formatStepperValue,
  normalizeDecimalStepperValue,
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
      unit: '袋',
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

  it('supports pantry unit quick options and decimal quantity normalization', () => {
    expect(PANTRY_UNIT_OPTIONS).toEqual(['盒', '瓶', '袋', '包'])
    expect(buildUnitOptionItems('公斤')).toEqual([
      expect.objectContaining({ label: '公斤', active: true }),
      expect.objectContaining({ label: '盒' }),
      expect.objectContaining({ label: '瓶' }),
      expect.objectContaining({ label: '袋' }),
      expect.objectContaining({ label: '包' })
    ])
    expect(normalizeDecimalStepperValue('1.5', 0.5, 0.5, 1)).toBe(1.5)
    expect(formatStepperValue(1.5, 1)).toBe('1.5')
    expect(formatStepperValue(1, 1)).toBe('1')
  })
})
