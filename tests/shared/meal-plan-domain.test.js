import { describe, expect, it } from 'vitest'
import { normalizeMealPlanWrite, sortMealPlansBySchedule } from '../../shared/domain/meal-plan'

describe('meal-plan domain', () => {
  it('sorts meal plans by date then meal type order', () => {
    const sorted = sortMealPlansBySchedule([
      { _id: '4', planDate: '2026-04-11', mealType: 'lunch' },
      { _id: '2', planDate: '2026-04-10', mealType: 'dinner' },
      { _id: '1', planDate: '2026-04-10', mealType: 'breakfast' },
      { _id: '3', planDate: '2026-04-10', mealType: 'snack' }
    ])

    expect(sorted.map((item) => item._id)).toEqual(['1', '2', '3', '4'])
  })

  it('normalizes writes and embeds recipe snapshots array', () => {
    const result = normalizeMealPlanWrite({
      planDate: ' 2026-04-10 ',
      mealType: ' Lunch ',
      notes: ' low spice ',
      recipes: [
        {
          recipeId: 'recipe-1',
          servingsOverride: ' 3 ',
          notes: ' low spice ',
          recipe: {
            _id: 'recipe-1',
            name: ' Tomato Egg ',
            summary: ' quick ',
            coverImageId: 'img-1',
            servings: '2',
            deletedAt: 'ignored'
          }
        }
      ]
    })

    expect(result).toEqual({
      planDate: '2026-04-10',
      mealType: 'lunch',
      notes: 'low spice',
      recipes: [
        {
          recipeId: 'recipe-1',
          recipeNameSnapshot: 'Tomato Egg',
          servingsOverride: '3',
          sortOrder: 1,
          notes: 'low spice',
          recipe: {
            _id: 'recipe-1',
            name: 'Tomato Egg',
            summary: 'quick',
            coverImageId: 'img-1',
            servings: '2'
          }
        }
      ]
    })
  })

  it('keeps multiple recipe snapshots instead of collapsing to the first one', () => {
    const result = normalizeMealPlanWrite({
      planDate: '2026-04-10',
      mealType: 'dinner',
      recipes: [
        {
          recipeId: 'recipe-1',
          servingsOverride: '2',
          recipe: { _id: 'recipe-1', name: 'A' }
        },
        {
          recipeId: 'recipe-2',
          servingsOverride: '4',
          recipe: { _id: 'recipe-2', name: 'B' }
        }
      ]
    })

    expect(result.recipes).toHaveLength(2)
    expect(result.recipes[1]).toEqual(
      expect.objectContaining({
        recipeId: 'recipe-2',
        servingsOverride: '4',
        sortOrder: 2
      })
    )
  })
})
