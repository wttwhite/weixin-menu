import { describe, expect, it } from 'vitest'
import { buildShoppingItemsFromMealPlans, normalizeShoppingItemWrite } from '../../shared/domain/shopping'

describe('shopping domain', () => {
  it('creates generated shopping items from meal-plan recipe ingredients', () => {
    const result = buildShoppingItemsFromMealPlans([
      {
        _id: 'plan-1',
        planDate: '2026-04-10',
        mealType: 'dinner',
        recipes: [
          {
            recipeId: 'recipe-1',
            recipeNameSnapshot: 'Tomato Egg',
            ingredients: [
              { name: 'Tofu', quantity: '1', unit: 'box' },
              { name: 'Tomato', quantity: '2', unit: 'pcs' }
            ]
          }
        ]
      },
      {
        _id: 'plan-2',
        planDate: '2026-04-11',
        mealType: 'lunch',
        recipes: [
          {
            recipeId: 'recipe-2',
            recipeNameSnapshot: 'Mapo Tofu',
            ingredients: [{ name: 'Tofu', quantity: '2', unit: 'box' }]
          }
        ]
      }
    ])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(
      expect.objectContaining({
        name: 'Tofu',
        quantity: '3',
        unit: 'box',
        sourceType: 'generated',
        checked: false
      })
    )
    expect(result[1]).toEqual(
      expect.objectContaining({
        name: 'Tomato',
        quantity: '2',
        unit: 'pcs',
        sourceType: 'generated'
      })
    )
  })

  it('normalizes manual shopping writes', () => {
    const item = normalizeShoppingItemWrite({
      name: '  milk ',
      quantity: ' 2 ',
      unit: ' box ',
      notes: ' low fat ',
      sourceType: 'manual'
    })

    expect(item).toEqual({
      name: 'milk',
      quantity: '2',
      unit: 'box',
      notes: 'low fat',
      sourceType: 'manual'
    })
  })
})
