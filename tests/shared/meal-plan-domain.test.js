import { describe, expect, it } from 'vitest'
import { normalizeMealPlanWrite, sortMealPlansBySchedule } from '../../shared/domain/meal-plan'

describe('meal-plan domain', () => {
  it('sorts meal plans by date then meal type order', () => {
    const sorted = sortMealPlansBySchedule([
      { _id: '4', date: '2026-04-11', mealType: 'lunch' },
      { _id: '2', date: '2026-04-10', mealType: 'dinner' },
      { _id: '1', date: '2026-04-10', mealType: 'breakfast' },
      { _id: '3', date: '2026-04-10', mealType: 'snack' }
    ])

    expect(sorted.map((item) => item._id)).toEqual(['1', '2', '3', '4'])
  })

  it('normalizes writes and embeds a recipe snapshot', () => {
    const result = normalizeMealPlanWrite({
      date: ' 2026-04-10 ',
      mealType: ' Lunch ',
      servings: ' 3 ',
      notes: ' low spice ',
      recipe: {
        _id: 'recipe-1',
        name: ' Tomato Egg ',
        summary: ' quick ',
        coverImageId: 'img-1',
        servings: '2',
        deletedAt: 'ignored'
      }
    })

    expect(result).toEqual({
      date: '2026-04-10',
      mealType: 'lunch',
      servings: '3',
      notes: 'low spice',
      recipeId: 'recipe-1',
      recipe: {
        _id: 'recipe-1',
        name: 'Tomato Egg',
        summary: 'quick',
        coverImageId: 'img-1',
        servings: '2'
      }
    })
  })
})
