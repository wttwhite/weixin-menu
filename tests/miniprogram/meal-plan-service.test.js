import { describe, expect, it, vi } from 'vitest'
import {
  createMealPlan,
  createMealPlanService,
  deleteMealPlan,
  getMealPlan,
  listMealPlans,
  updateMealPlan
} from '../../miniprogram/services/meal-plan'

describe('createMealPlanService', () => {
  it('calls the api cloud function for meal plan CRUD actions', async () => {
    const callCloud = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { items: [] }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { _id: 'meal-1' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { _id: 'meal-1' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { _id: 'meal-1', notes: 'updated' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { mealPlanId: 'meal-1', deleted: true }
        }
      })

    const service = createMealPlanService({ callCloud })
    await service.listMealPlans('space-1')
    await service.getMealPlan('space-1', 'meal-1')
    await service.createMealPlan('space-1', {
      planDate: '2026-04-10',
      mealType: 'dinner',
      recipes: [{ recipeId: 'recipe-1', servingsOverride: '2', notes: '' }]
    })
    await service.updateMealPlan('space-1', 'meal-1', {
      planDate: '2026-04-11',
      mealType: 'lunch',
      recipes: [{ recipeId: 'recipe-1', servingsOverride: '3', notes: '' }]
    })
    await service.deleteMealPlan('space-1', 'meal-1')

    expect(callCloud).toHaveBeenNthCalledWith(1, 'api', {
      action: 'listMealPlans',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(2, 'api', {
      action: 'getMealPlan',
      spaceId: 'space-1',
      mealPlanId: 'meal-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(3, 'api', {
      action: 'createMealPlan',
      spaceId: 'space-1',
      plan: {
        planDate: '2026-04-10',
        mealType: 'dinner',
        recipes: [{ recipeId: 'recipe-1', servingsOverride: '2', notes: '' }]
      }
    })
    expect(callCloud).toHaveBeenNthCalledWith(4, 'api', {
      action: 'updateMealPlan',
      spaceId: 'space-1',
      mealPlanId: 'meal-1',
      plan: {
        planDate: '2026-04-11',
        mealType: 'lunch',
        recipes: [{ recipeId: 'recipe-1', servingsOverride: '3', notes: '' }]
      }
    })
    expect(callCloud).toHaveBeenNthCalledWith(5, 'api', {
      action: 'deleteMealPlan',
      spaceId: 'space-1',
      mealPlanId: 'meal-1'
    })
  })

  it('unwraps non-zero api responses into thrown errors', async () => {
    const service = createMealPlanService({
      callCloud: vi.fn().mockResolvedValue({
        result: {
          code: 400,
          message: 'recipeId is required',
          data: null
        }
      })
    })

    await expect(service.createMealPlan('space-1', {})).rejects.toMatchObject({
      code: 400,
      message: 'recipeId is required'
    })
  })
})

describe('meal-plan service helpers', () => {
  it('exposes convenience exports', () => {
    expect(typeof listMealPlans).toBe('function')
    expect(typeof getMealPlan).toBe('function')
    expect(typeof createMealPlan).toBe('function')
    expect(typeof updateMealPlan).toBe('function')
    expect(typeof deleteMealPlan).toBe('function')
  })
})
