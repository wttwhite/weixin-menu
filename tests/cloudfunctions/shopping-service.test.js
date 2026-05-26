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
        shoppingList: {
          name: 'Weekend List',
          listDate: '2026-04-12',
          status: 'open',
          notes: 'Weekend restock'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:00:00.000Z') }
      }
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        name: 'Weekend List',
        listDate: '2026-04-12',
        status: 'open',
        notes: 'Weekend restock'
      })
    )

    const updated = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          name: 'Updated Weekend List',
          listDate: '2026-04-13',
          status: 'completed',
          notes: 'Updated notes'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T09:00:00.000Z') }
      }
    )
    expect(updated.item).toEqual(
      expect.objectContaining({
        name: 'Updated Weekend List',
        listDate: '2026-04-13',
        status: 'open',
        notes: 'Updated notes'
      })
    )

    const listed = await listShoppingLists({ spaceId: 'space-1' }, context, repository)
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0]).toEqual(
      expect.objectContaining({
        _id: created.item._id,
        name: 'Updated Weekend List',
        listDate: '2026-04-13',
        status: 'open',
        progress: {
          total: 0,
          checked: 0,
          percent: 0
        }
      })
    )
  })

  it('batches shopping item reads when listing multiple shopping lists', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const first = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'First List',
          listDate: '2026-05-01',
          status: 'open'
        }
      },
      context,
      repository
    )
    const second = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Second List',
          listDate: '2026-05-02',
          status: 'open'
        }
      },
      context,
      repository
    )
    await repository.createShoppingItem({
      spaceId: 'space-1',
      shoppingListId: first.item._id,
      name: 'Milk',
      isChecked: false,
      deletedAt: '',
      sourceType: 'manual'
    })
    await repository.createShoppingItem({
      spaceId: 'space-1',
      shoppingListId: second.item._id,
      name: 'Egg',
      isChecked: true,
      deletedAt: '',
      sourceType: 'manual'
    })

    const originalListShoppingItems = repository.listShoppingItems
    let batchReadCount = 0
    repository.listShoppingItems = async () => {
      throw new Error('per-list shopping item read should not be used')
    }
    repository.listShoppingItemsByListIds = async (spaceId, shoppingListIds, query) => {
      batchReadCount += 1
      const chunks = await Promise.all(
        shoppingListIds.map((shoppingListId) => originalListShoppingItems(spaceId, shoppingListId, query))
      )
      return chunks.flat()
    }

    const listed = await listShoppingLists({ spaceId: 'space-1' }, context, repository)

    expect(batchReadCount).toBe(1)
    expect(listed.items).toHaveLength(2)
    expect(listed.items.map((item) => item.items).flat()).toHaveLength(2)
  })

  it('does not rescan shopping items when only list metadata changes', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Weekend List',
          listDate: '2026-05-01',
          status: 'open'
        }
      },
      context,
      repository
    )
    repository.listShoppingItems = async () => {
      throw new Error('metadata update should not read shopping items')
    }

    const updated = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          name: 'Renamed List',
          notes: 'Only metadata changed'
        }
      },
      context,
      repository
    )

    expect(updated.item).toEqual(expect.objectContaining({
      name: 'Renamed List',
      notes: 'Only metadata changed',
      status: 'open'
    }))
  })

  it('reuses loaded records when applying toggle updates', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Reuse Existing List',
          listDate: '2026-05-01',
          status: 'open'
        }
      },
      context,
      repository
    )
    const shoppingItem = await repository.createShoppingItem({
      spaceId: 'space-1',
      shoppingListId: created.item._id,
      name: 'Milk',
      isChecked: false,
      updatedAt: '2026-05-01T08:00:00.000Z',
      deletedAt: '',
      sourceType: 'manual'
    })
    const originalUpdateShoppingList = repository.updateShoppingList
    const originalUpdateShoppingItem = repository.updateShoppingItem
    repository.updateShoppingList = async (spaceId, shoppingListId, patch, options = {}) => {
      if (!options.existing) {
        throw new Error('shopping list update should reuse existing record')
      }
      return originalUpdateShoppingList(spaceId, shoppingListId, patch, options)
    }
    repository.updateShoppingItem = async (spaceId, shoppingListId, shoppingItemId, patch, options = {}) => {
      if (!options.existing) {
        throw new Error('shopping item update should reuse existing record')
      }
      return originalUpdateShoppingItem(spaceId, shoppingListId, shoppingItemId, patch, options)
    }

    const toggled = await toggleShoppingItemChecked(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingItemId: shoppingItem._id,
        checked: true,
        shoppingListExpectedUpdatedAt: created.item.updatedAt,
        expectedUpdatedAt: shoppingItem.updatedAt
      },
      context,
      repository
    )

    expect(toggled.item.isChecked).toBe(true)
    expect(toggled.shoppingList.status).toBe('completed')
  })

  it('generates items from meal plans and toggles checked state', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Generated List',
          listDate: '2026-04-12',
          status: 'open'
        }
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
        category: '',
        quantity: '3',
        unit: 'pcs',
        sourceType: 'generated',
        isChecked: false
      })
    ])
    expect(generated.shoppingListUpdatedAt).toBe('2026-04-12T08:10:00.000Z')

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
    expect(toggled.item.isChecked).toBe(true)
    expect(toggled.shoppingListUpdatedAt).toBe('2026-04-12T08:20:00.000Z')
    expect(toggled.shoppingList).toEqual(expect.objectContaining({
      status: 'completed'
    }))
  })

  it('keeps shopping list status in sync with checked item progress', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Status List',
          listDate: '2026-04-12',
          status: 'open'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:00:00.000Z') }
      }
    )

    const first = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          itemDraft: {
            name: 'Milk',
            quantity: '1',
            unit: '盒'
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:01:00.000Z') }
      }
    )
    const second = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        expectedUpdatedAt: first.item.updatedAt,
        shoppingList: {
          itemDraft: {
            name: 'Egg',
            quantity: '6',
            unit: '个'
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:02:00.000Z') }
      }
    )

    const checkedFirst = await toggleShoppingItemChecked(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingItemId: first.shoppingItem._id,
        checked: true,
        shoppingListExpectedUpdatedAt: second.item.updatedAt
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:03:00.000Z') }
      }
    )
    expect(checkedFirst.shoppingList.status).toBe('open')

    const checkedSecond = await toggleShoppingItemChecked(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingItemId: second.shoppingItem._id,
        checked: true,
        shoppingListExpectedUpdatedAt: checkedFirst.shoppingListUpdatedAt
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:04:00.000Z') }
      }
    )
    expect(checkedSecond.shoppingList.status).toBe('completed')

    const uncheckedFirst = await toggleShoppingItemChecked(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingItemId: first.shoppingItem._id,
        checked: false,
        shoppingListExpectedUpdatedAt: checkedSecond.shoppingListUpdatedAt
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-12T08:05:00.000Z') }
      }
    )
    expect(uncheckedFirst.shoppingList.status).toBe('open')
  })

  it('returns open when an unchecked item is added to a completed shopping list', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Completed List',
          listDate: '2026-05-01',
          status: 'completed'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:00:00.000Z') }
      }
    )
    const checked = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          itemDraft: {
            name: 'Milk',
            quantity: '1',
            unit: '盒',
            isChecked: true
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:01:00.000Z') }
      }
    )

    const unchecked = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        expectedUpdatedAt: checked.item.updatedAt,
        shoppingList: {
          itemDraft: {
            name: 'Egg',
            quantity: '2',
            unit: '个'
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:02:00.000Z') }
      }
    )

    expect(unchecked.item.status).toBe('open')
  })

  it('preserves checked state when editing a shopping item draft without isChecked', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Checked List',
          listDate: '2026-05-01',
          status: 'completed'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:00:00.000Z') }
      }
    )
    const first = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          itemDraft: {
            name: 'Milk',
            quantity: '1',
            unit: '盒',
            isChecked: true
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:01:00.000Z') }
      }
    )

    const edited = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        expectedUpdatedAt: first.item.updatedAt,
        shoppingList: {
          itemDraft: {
            shoppingItemId: first.shoppingItem._id,
            expectedUpdatedAt: first.shoppingItem.updatedAt,
            name: 'Milk Plus',
            quantity: '2',
            unit: '盒'
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:02:00.000Z') }
      }
    )

    expect(edited.shoppingItem.isChecked).toBe(true)
    expect(edited.item.status).toBe('completed')
  })

  it('derives toggled list status from the updated item when item list reads are stale', async () => {
    const repository = createRepository()
    const originalListShoppingItems = repository.listShoppingItems
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Stale Toggle List',
          listDate: '2026-05-01',
          status: 'completed'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:00:00.000Z') }
      }
    )
    const first = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          itemDraft: {
            name: 'Milk',
            quantity: '1',
            unit: '盒',
            isChecked: true
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:01:00.000Z') }
      }
    )
    const second = await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        expectedUpdatedAt: first.item.updatedAt,
        shoppingList: {
          itemDraft: {
            name: 'Egg',
            quantity: '2',
            unit: '个',
            isChecked: true
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:02:00.000Z') }
      }
    )

    repository.listShoppingItems = async (spaceId, shoppingListId, query) => {
      const items = await originalListShoppingItems(spaceId, shoppingListId, query)
      return items.map((item) => (
        item._id === first.shoppingItem._id ? { ...item, isChecked: true } : item
      ))
    }

    const toggled = await toggleShoppingItemChecked(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingItemId: first.shoppingItem._id,
        checked: false,
        shoppingListExpectedUpdatedAt: second.item.updatedAt
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:03:00.000Z') }
      }
    )

    expect(toggled.item.isChecked).toBe(false)
    expect(toggled.shoppingList.status).toBe('open')
  })

  it('auto archives completed shopping lists that have not changed for a month', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Old Completed List',
          listDate: '2026-04-01',
          status: 'completed'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-01T08:00:00.000Z') }
      }
    )
    await updateShoppingList(
      {
        spaceId: 'space-1',
        shoppingListId: created.item._id,
        shoppingList: {
          itemDraft: {
            name: 'Milk',
            quantity: '1',
            unit: '盒',
            isChecked: true
          }
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-04-01T08:00:00.000Z') }
      }
    )

    const listed = await listShoppingLists(
      { spaceId: 'space-1' },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-02T08:00:00.000Z') }
      }
    )

    expect(listed.items[0]).toEqual(expect.objectContaining({
      _id: created.item._id,
      status: 'archived',
      updatedAt: '2026-05-02T08:00:00.000Z'
    }))
  })

  it('repairs stale completed lists to open when no active items are complete', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Empty Completed List',
          listDate: '2026-05-01',
          status: 'completed'
        }
      },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-01T08:00:00.000Z') }
      }
    )

    const listed = await listShoppingLists(
      { spaceId: 'space-1' },
      context,
      repository,
      {
        clock: { now: () => new Date('2026-05-02T08:00:00.000Z') }
      }
    )

    expect(listed.items[0]).toEqual(expect.objectContaining({
      _id: created.item._id,
      status: 'open',
      progress: {
        total: 0,
        checked: 0,
        percent: 0
      }
    }))
  })

  it('soft deletes shopping lists', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    const created = await createShoppingList(
      {
        spaceId: 'space-1',
        shoppingList: {
          name: 'Delete Me',
          listDate: '2026-04-12',
          status: 'open'
        }
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
        shoppingList: {
          name: 'Generated List',
          listDate: '2026-04-12',
          status: 'open'
        }
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
        shoppingList: {
          name: 'Conflict List',
          listDate: '2026-04-12',
          status: 'open'
        }
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
          shoppingList: {
            name: 'Renamed',
            listDate: '2026-04-13',
            status: 'completed'
          }
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
