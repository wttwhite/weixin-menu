import { describe, expect, it } from 'vitest'
import {
  createPantryItem,
  getPantryItem,
  deletePantryItem,
  listPantry,
  updatePantryItem
} from '../../cloudfunctions/api/services/pantry-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const items = []
  let nextId = 1
  let lastListQuery = null

  return {
    async listPantryItems(spaceId, query = {}) {
      lastListQuery = {
        spaceId,
        ...query
      }

      const filtered = items.filter((item) => {
        if (item.spaceId !== spaceId || item.deletedAt !== '') {
          return false
        }
        if (query.category && item.category !== query.category) {
          return false
        }
        if (query.location && item.location !== query.location) {
          return false
        }
        return true
      })

      const limit = typeof query.limit === 'number' ? query.limit : filtered.length
      return filtered.slice(0, limit).map((item) => ({ ...item }))
    },
    getLastListQuery() {
      return lastListQuery
    },
    async listPantryItemsLegacy(spaceId) {
      return items
        .filter((item) => item.spaceId === spaceId && item.deletedAt === '')
        .map((item) => ({ ...item }))
    },
    async createPantryItem(data) {
      const item = {
        _id: `pantry-${nextId++}`,
        ...data
      }
      items.push(item)
      return { ...item }
    },
    async getPantryItem(spaceId, pantryItemId) {
      const item = items.find((entry) => entry.spaceId === spaceId && entry._id === pantryItemId)
      return item ? { ...item } : null
    },
    async updatePantryItem(spaceId, pantryItemId, data) {
      const index = items.findIndex((entry) => entry.spaceId === spaceId && entry._id === pantryItemId)
      if (index === -1) {
        return null
      }

      items[index] = {
        ...items[index],
        ...data
      }
      return { ...items[index] }
    }
  }
}

describe('pantry service', () => {
  it('reads a pantry item through getPantryItem', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Milk',
          category: 'dairy',
          quantity: '1',
          unit: 'box',
          location: 'fridge',
          expirationDate: '2026-04-11',
          notes: ''
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

    const result = await getPantryItem(
      {
        spaceId: 'space-1',
        pantryItemId: 'pantry-1'
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T08:00:00.000Z')
        }
      }
    )

    expect(result.item).toEqual(
      expect.objectContaining({
        _id: 'pantry-1',
        name: 'Milk'
      })
    )
  })

  it('uses server clock for write timestamps instead of event.now', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Yogurt',
          category: 'dairy',
          quantity: '1',
          unit: 'cup',
          location: 'fridge',
          expirationDate: '2026-04-11',
          notes: ''
        },
        now: '1999-01-01'
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T06:30:00.000Z')
        }
      }
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        createdAt: '2026-04-10T06:30:00.000Z',
        updatedAt: '2026-04-10T06:30:00.000Z'
      })
    )
  })

  it('uses business timezone date for pantry status near +08:00 midnight boundaries', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Boundary Milk',
          expirationDate: '2026-04-09'
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-09T16:30:00.000Z')
        }
      }
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        status: 'expired',
        createdAt: '2026-04-09T16:30:00.000Z',
        updatedAt: '2026-04-09T16:30:00.000Z'
      })
    )
  })

  it('rejects invalid expiration dates on create', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await expect(
      createPantryItem(
        {
          spaceId: 'space-1',
          item: {
            name: 'Bad Date Item',
            expirationDate: '2026-02-30'
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('lists, creates, updates, filters, and soft deletes pantry items within a space', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: ' Yogurt ',
          category: ' dairy ',
          quantity: '',
          unit: ' cup ',
          location: ' fridge ',
          expirationDate: '2026-04-11',
          notes: ' breakfast '
        },
        now: '2026-04-10'
      },
      context,
      repository
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        _id: 'pantry-1',
        spaceId: 'space-1',
        name: 'Yogurt',
        category: 'dairy',
        quantity: '1',
        unit: 'cup',
        location: 'fridge',
        status: 'expiring-soon',
        notes: 'breakfast',
        createdBy: 'user-1',
        deletedAt: ''
      })
    )

    const updated = await updatePantryItem(
      {
        spaceId: 'space-1',
        pantryItemId: 'pantry-1',
        item: {
          name: 'Greek Yogurt',
          category: 'dairy',
          quantity: '2',
          unit: 'cup',
          location: 'fridge',
          expirationDate: '2026-04-20',
          notes: 'plain'
        },
        now: '2026-04-10'
      },
      context,
      repository
    )

    expect(updated.item).toEqual(
      expect.objectContaining({
        _id: 'pantry-1',
        name: 'Greek Yogurt',
        quantity: '2',
        status: 'fresh',
        updatedBy: 'user-1'
      })
    )

    const filtered = await listPantry(
      {
        spaceId: 'space-1',
        filters: {
          category: 'dairy',
          status: 'fresh'
        },
        now: '2026-04-10'
      },
      context,
      repository
    )

    expect(repository.getLastListQuery()).toEqual({
      spaceId: 'space-1',
      category: 'dairy',
      location: '',
      limit: 100
    })
    expect(filtered.items).toHaveLength(1)
    expect(filtered.items[0]).toEqual(
      expect.objectContaining({
        _id: 'pantry-1',
        name: 'Greek Yogurt'
      })
    )

    await createPantryItem(
      {
        spaceId: 'space-2',
        item: {
          name: 'Rice',
          category: 'dry-goods',
          quantity: '1',
          unit: 'bag',
          location: 'pantry',
          expirationDate: '',
          notes: ''
        },
        now: '2026-04-10'
      },
      context,
      repository
    )

    const beforeDelete = await listPantry(
      {
        spaceId: 'space-1',
        filters: {},
        now: '2026-04-10'
      },
      context,
      repository
    )
    expect(beforeDelete.items).toHaveLength(1)

    const deleted = await deletePantryItem(
      {
        spaceId: 'space-1',
        pantryItemId: 'pantry-1',
        now: '2026-04-10'
      },
      context,
      repository
    )

    expect(deleted).toEqual({
      pantryItemId: 'pantry-1',
      deleted: true
    })

    const afterDelete = await listPantry(
      {
        spaceId: 'space-1',
        filters: {},
        now: '2026-04-10'
      },
      context,
      repository
    )

    expect(afterDelete.items).toEqual([])
  })
})
