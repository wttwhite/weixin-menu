import { describe, expect, it } from 'vitest'
import {
  buildShoppingItemsFromMealPlans,
  normalizeShoppingItemWrite,
  normalizeShoppingListWrite
} from '../../shared/domain/shopping'

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
        category: '',
        quantity: '3',
        unit: 'box',
        isChecked: false,
        sourceType: 'generated',
        sourceRefType: '',
        sourceRefId: '',
        recipeId: null,
        mealPlanId: null,
        notes: '',
        sortOrder: 1
      })
    )
    expect(result[1]).toEqual(
      expect.objectContaining({
        name: 'Tomato',
        category: '',
        quantity: '2',
        unit: 'pcs',
        isChecked: false,
        sourceType: 'generated',
        sourceRefType: '',
        sourceRefId: '',
        recipeId: null,
        mealPlanId: null,
        notes: '',
        sortOrder: 2
      })
    )
  })

  it('normalizes shopping list writes with original project field names', () => {
    const list = normalizeShoppingListWrite({
      name: '  Weekend List ',
      listDate: ' 2026-04-16 ',
      status: ' completed ',
      notes: ' 周末补货 '
    })

    expect(list).toEqual({
      name: 'Weekend List',
      listDate: '2026-04-16',
      status: 'completed',
      notes: '周末补货'
    })
  })

  it('normalizes manual shopping writes', () => {
    const item = normalizeShoppingItemWrite({
      name: '  milk ',
      category: '  dairy ',
      quantity: ' 2 ',
      unit: ' box ',
      notes: ' low fat ',
      sourceType: 'manual',
      sourceRefType: ' meal_plan ',
      sourceRefId: ' plan-1 ',
      recipeId: ' recipe-1 ',
      mealPlanId: ' meal-1 ',
      sortOrder: 4,
      isChecked: true
    })

    expect(item).toEqual({
      name: 'milk',
      category: 'dairy',
      quantity: '2',
      unit: 'box',
      notes: 'low fat',
      isChecked: true,
      sourceType: 'manual',
      sourceRefType: 'meal_plan',
      sourceRefId: 'plan-1',
      recipeId: 'recipe-1',
      mealPlanId: 'meal-1',
      sortOrder: 4
    })
  })
})
