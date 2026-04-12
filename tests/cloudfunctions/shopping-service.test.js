import { describe, expect, it } from 'vitest'
import {
  createShoppingList,
  deleteShoppingList,
  generateShoppingItemsFromPlan,
  listShoppingLists,
  toggleShoppingItemChecked,
  updateShoppingList
} from '../../cloudfunctions/api/services/shopping-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const lists = []
  const items = []
  const mealPlans = [
    {
      _id: 'plan-1',
      spaceId: 'space-1',
      deletedAt: '',
      recipes: [
        {
          recipeId: 'recipe-1',
          recipeNameSnapshot: 'Tomato Egg'
        }
      ]
    }
  ]
  const recipes = [
    {
      _id: 'recipe-1',
      spaceId: 'space-1',
      deletedAt: '',
      ingredients: [{ name: 'Egg', quantity: '3', unit: 'pcs' }]
    }
  ]
  let nextListId = 1
  let nextItemId = 1

  return {
    async listShoppingLists(spaceId, query = {}) {
      return lists
        .filter((item) => item.spaceId === spaceId && item.deletedAt === (query.deletedAt || ''))
        .map((item) => ({ ...item }))
    },
    async getShoppingList(spaceId, shoppingListId) {
      const item = lists.find((entry) => entry.spaceId === spaceId && entry._id === shoppingListId)
      return item ? { ...item } : null
    },
    async createShoppingList(data) {
      const item = { _id: `shopping-${nextListId++}`, updatedAt: data.updatedAt || '', ...data }
      lists.push(item)
      return { ...item }
    },
    async updateShoppingList(spaceId, shoppingListId, patch) {
      const index = lists.findIndex((entry) => entry.spaceId === spaceId && entry._id === shoppingListId)
      if (index === -1) {
        return null
      }
      lists[index] = { ...lists[index], ...patch }
      return { ...lists[index] }
    },
    async listShoppingItems(spaceId, shoppingListId, query = {}) {
      return items
        .filter(
          (entry) =>
            entry.spaceId === spaceId &&
            entry.shoppingListId === shoppingListId &&
            entry.deletedAt === (query.deletedAt || '')
        )
        .map((item) => ({ ...item }))
    },
    async getShoppingItem(spaceId, shoppingListId, shoppingItemId) {
      const item = items.find(
        (entry) =>
          entry.spaceId === spaceId &&
          entry.shoppingListId === shoppingListId &&
          entry._id === shoppingItemId
      )
      return item ? { ...item } : null
    },
    async createShoppingItem(data) {
      const item = { _id: `item-${nextItemId++}`, updatedAt: data.updatedAt || '', ...data }
      items.push(item)
      return { ...item }
    },
    async updateShoppingItem(spaceId, shoppingListId, shoppingItemId, patch) {
      const index = items.findIndex(
        (entry) =>
          entry.spaceId === spaceId &&
          entry.shoppingListId === shoppingListId &&
          entry._id === shoppingItemId
      )
      if (index === -1) {
        return null
      }
      items[index] = { ...items[index], ...patch }
      return { ...items[index] }
    },
    async listMealPlans(spaceId) {
      return mealPlans
        .filter((item) => item.spaceId === spaceId && !item.deletedAt)
        .map((item) => ({ ...item }))
    },
    async getRecipe(spaceId, recipeId) {
      const item = recipes.find((entry) => entry.spaceId === spaceId && entry._id === recipeId)
      return item ? { ...item } : null
    }
  }
}

describe('shopping service', () => {
  it('creates, updates and lists shopping lists', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: { title: 'Weekend List' }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:00:00.000Z') }
      }
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        title: 'Weekend List'
      })
    )

    const updated = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: { title: 'Updated Weekend List' }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T09:00:00.000Z') }
      }
    )
    expect(updated.item.title).toBe('Updated Weekend List')

    const listed = await listShoppingLists({ spaceId: 'space-1' }, context, repository)
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]).toEqual(
      expect.objectContaining({
        _id: created.item._id,
        title: 'Updated Weekend List',
        progress: {
          total: 0,
          checked: 0,
          percent: 0
        }
      })
    )
  })

  it('generates items from meal plans and toggles checked state', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: { title: 'Generated List' }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:00:00.000Z') }
      }
    )

    const generated = await generateShoppingItemsFromPlan(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:10:00.000Z') }
      }
    )

    expect(generated.items).toEqual([
      expect.objectContaining({
        name: 'Egg',
        quantity: '3',
        unit: 'pcs',
        sourceType: 'generated',
        checked: false
      })
    ])

    const toggled = await toggleShoppingItemChecked(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingItemId: generated.items[0]._id,
        checked: true
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:20:00.000Z') }
      }
    )
    expect(toggled.item.checked).toBe(true)
  })

  it('soft deletes shopping lists', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: { title: 'Delete Me' }
      },
      context,
      repository
    )

    const deleted = await deleteShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:30:00.000Z') }
      }
    )

    expect(deleted).toEqual({
      shoppingListId: created.item._id,
      deleted: true
    })
  })

  it('rejects invalid input when required identifiers are missing', async () => {
    await expect(createShoppingList({}, { openid: 'user-1' }, createRepository())).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('generates shopping items from persisted meal-plan recipe snapshots by resolving full recipes', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: { title: 'Generated List' }
      },
      context,
      repository
    )

    const generated = await generateShoppingItemsFromPlan(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id
      },
      context,
      repository
    )

    expect(generated.items).toEqual([
      expect.objectContaining({
        name: 'Egg',
        quantity: '3',
        unit: 'pcs'
      })
    ])
  })

  it('returns DATA_CONFLICT when shopping list version is stale', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: { title: 'Conflict List' }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:00:00.000Z') }
      }
    )

    await expect(
      updateShoppingList(
        {
          spaceId: 'space-1',
          shoppingListId: created.item._id,
          expectedUpdatedAt: 'stale-version',
          shoppingList: { title: 'Renamed' }
        },
        context,
        repository,
        {
          clock: { now: () => new Date('2026-04-12T09:00:00.000Z') }
        }
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT,
      message: 'DATA_CONFLICT'
    })
  })
})
