import { describe, expect, it } from 'vitest'
import {
  createMealPlan,
  deleteMealPlan,
  listMealPlans,
  updateMealPlan
} from '../../cloudfunctions/api/services/meal-plan-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const items = []
  const recipes = [
    {
      _id: 'recipe-1',
      spaceId: 'space-1',
      name: 'Tomato Egg',
      summary: 'Quick dish',
      coverImageId: 'img-1',
      servings: '2',
      deletedAt: ''
    },
    {
      _id: 'recipe-2',
      spaceId: 'space-1',
      name: 'Mapo Tofu',
      summary: 'Classic',
      coverImageId: 'img-2',
      servings: '4',
      deletedAt: ''
    }
  ]
  let nextId = 1

  return {
    async listMealPlans(spaceId, query = {}) {
      return items
        .filter((item) => item.spaceId === spaceId && item.deletedAt === (query.deletedAt || ''))
        .slice(0, query.limit || items.length)
        .map((item) => ({ ...item }))
    },
    async getMealPlanListMetadata(spaceId, query = {}) {
      return {
        total: items.filter((item) => item.spaceId === spaceId && item.deletedAt === (query.deletedAt || '')).length
      }
    },
    async createMealPlan(data) {
      const item = {
        _id: `meal-${nextId++}`,
        ...data
      }
      items.push(item)
      return { ...item }
    },
    async getMealPlan(spaceId, mealPlanId) {
      const item = items.find((entry) => entry.spaceId === spaceId && entry._id === mealPlanId)
      return item ? { ...item } : null
    },
    async updateMealPlan(spaceId, mealPlanId, patch) {
      const index = items.findIndex((entry) => entry.spaceId === spaceId && entry._id === mealPlanId)
      if (index === -1) {
        return null
      }
      items[index] = {
        ...items[index],
        ...patch
      }
      return { ...items[index] }
    },
    async getRecipe(spaceId, recipeId) {
      const item = recipes.find((entry) => entry.spaceId === spaceId && entry._id === recipeId)
      return item ? { ...item } : null
    }
  }
}

describe('meal-plan service', () => {
  it('creates and lists meal plans with embedded recipes snapshots', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createMealPlan(
      {
        spaceId: 'space-1',
        plan: {
          planDate: '2026-04-10',
          mealType: 'dinner',
          status: 'planned',
          recipes: [{ recipeId: 'recipe-1', servingsOverride: '3', notes: '' }]
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T08:00:00.000Z')
        }
      }
    )
    await createMealPlan(
      {
        spaceId: 'space-1',
        plan: {
          planDate: '2026-04-10',
          mealType: 'breakfast',
          recipes: [{ recipeId: 'recipe-2', servingsOverride: '2', notes: '' }]
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T08:01:00.000Z')
        }
      }
    )

    const result = await listMealPlans(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        planDate: '2026-04-10',
        mealType: 'breakfast',
        status: 'planned',
        recipes: [
          expect.objectContaining({
            recipeId: 'recipe-2',
            recipeNameSnapshot: 'Mapo Tofu',
            servingsOverride: '2',
            recipe: expect.objectContaining({
              _id: 'recipe-2',
              name: 'Mapo Tofu'
            })
          })
        ]
      })
    )
    expect(result.items[1]).toEqual(
      expect.objectContaining({
        planDate: '2026-04-10',
        mealType: 'dinner',
        recipes: [
          expect.objectContaining({
            recipeId: 'recipe-1',
            recipeNameSnapshot: 'Tomato Egg',
            servingsOverride: '3',
            recipe: expect.objectContaining({
              _id: 'recipe-1',
              name: 'Tomato Egg'
            })
          })
        ]
      })
    )
  })

  it('updates and soft deletes meal plans', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createMealPlan(
      {
        spaceId: 'space-1',
        plan: {
          planDate: '2026-04-10',
          mealType: 'lunch',
          recipes: [{ recipeId: 'recipe-1', servingsOverride: '2', notes: '' }]
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T08:00:00.000Z')
        }
      }
    )

    const updated = await updateMealPlan(
      {
        spaceId: 'space-1',
        mealPlanId: created.item._id,
        plan: {
          planDate: '2026-04-11',
          mealType: 'dinner',
          status: 'cancelled',
          notes: 'extra tofu',
          recipes: [{ recipeId: 'recipe-2', servingsOverride: '5', notes: 'extra tofu' }]
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T09:00:00.000Z')
        }
      }
    )

    expect(updated.item).toEqual(
      expect.objectContaining({
        planDate: '2026-04-11',
        mealType: 'dinner',
        status: 'cancelled',
        notes: 'extra tofu',
        recipes: [
          expect.objectContaining({
            recipeId: 'recipe-2',
            recipeNameSnapshot: 'Mapo Tofu',
            servingsOverride: '5',
            notes: 'extra tofu',
            recipe: expect.objectContaining({
              _id: 'recipe-2',
              name: 'Mapo Tofu'
            })
          })
        ]
      })
    )

    const deleted = await deleteMealPlan(
      {
        spaceId: 'space-1',
        mealPlanId: created.item._id
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T10:00:00.000Z')
        }
      }
    )

    expect(deleted).toEqual({
      mealPlanId: created.item._id,
      deleted: true
    })
    await expect(listMealPlans({ spaceId: 'space-1' }, context, repository)).resolves.toEqual({
      items: [],
      total: 0,
      limit: 100,
      hasMore: false
    })
  })

  it('rejects writes when recipeId is missing or unknown', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await expect(
      createMealPlan(
        {
        spaceId: 'space-1',
        plan: {
          planDate: '2026-04-10',
          mealType: 'dinner',
          recipes: []
        }
      },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })

    await expect(
      createMealPlan(
        {
          spaceId: 'space-1',
          plan: {
            planDate: '2026-04-10',
            mealType: 'dinner',
            recipes: [{ recipeId: 'missing', servingsOverride: '', notes: '' }]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND
    })
  })

  it('rejects writes when any recipe entry is malformed instead of silently dropping it', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await expect(
      createMealPlan(
        {
          spaceId: 'space-1',
          plan: {
            planDate: '2026-04-10',
            mealType: 'dinner',
            recipes: [
              { recipeId: 'recipe-1', servingsOverride: '2', notes: '' },
              { recipeId: '', servingsOverride: '1', notes: '' }
            ]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('returns list metadata when plans exceed the default limit', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    for (let index = 0; index < 101; index += 1) {
      await createMealPlan(
        {
          spaceId: 'space-1',
          plan: {
            planDate: '2026-04-10',
            mealType: 'dinner',
            recipes: [{ recipeId: 'recipe-1', servingsOverride: '2', notes: '' }]
          }
        },
        context,
        repository,
        {
          clock: {
            now: () => new Date(`2026-04-10T08:${String(index % 60).padStart(2, '0')}:00.000Z`)
          }
        }
      )
    }

    const result = await listMealPlans(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )

    expect(result.total).toBe(101)
    expect(result.limit).toBe(100)
    expect(result.hasMore).toBe(true)
    expect(result.items).toHaveLength(100)
  })
})
