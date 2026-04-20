import { describe, expect, it } from 'vitest'
import {
  createPantryItem,
  createPantryLocation,
  createPantryCategory,
  getPantryItem,
  deletePantryItem,
  listPantry,
  listPantryLocations,
  listPantryCategories,
  reorderPantryLocations,
  reorderPantryCategories,
  deletePantryLocation,
  deletePantryCategory,
  updatePantryLocation,
  updatePantryCategory,
  updatePantryItem
} from '../../cloudfunctions/api/services/pantry-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const items = []
  const spaces = new Map([
    [
      'space-1',
      {
        _id: 'space-1',
        settings: {
          pantryCategories: ['dairy', 'dry'],
          pantryLocations: ['fridge', 'cabinet']
        }
      }
    ],
    [
      'space-2',
      {
        _id: 'space-2',
        settings: {
          pantryCategories: [],
          pantryLocations: []
        }
      }
    ]
  ])
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
    async getPantryListMetadata(spaceId, query = {}) {
      const activeItems = items.filter((item) => item.spaceId === spaceId && item.deletedAt === '')
      const filteredItems = activeItems.filter((item) => {
        if (query.category && item.category !== query.category) {
          return false
        }
        if (query.location && item.location !== query.location) {
          return false
        }
        return true
      })
      const categories = []
      const locations = []

      activeItems.forEach((item) => {
        if (item.category && !categories.includes(item.category)) {
          categories.push(item.category)
        }
        if (item.location && !locations.includes(item.location)) {
          locations.push(item.location)
        }
      })

      return {
        total: filteredItems.length,
        categories,
        locations
      }
    },
    getLastListQuery() {
      return lastListQuery
    },
    async getSpace(spaceId) {
      const space = spaces.get(spaceId)
      return space ? JSON.parse(JSON.stringify(space)) : null
    },
    async updateSpace(spaceId, data) {
      const current = spaces.get(spaceId)
      if (!current) {
        return null
      }

      const next = {
        ...current,
        ...data,
        settings: {
          ...(current.settings || {}),
          ...((data && data.settings) || {})
        }
      }
      spaces.set(spaceId, next)
      return JSON.parse(JSON.stringify(next))
    },
    __getSpaceSettings(spaceId) {
      const space = spaces.get(spaceId)
      return JSON.parse(JSON.stringify(space ? space.settings || {} : {}))
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
  it('supports pantry category and location CRUD with counts and rename propagation', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Milk',
          category: 'dairy',
          location: 'fridge'
        }
      },
      context,
      repository
    )

    const listedCategories = await listPantryCategories(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )
    expect(listedCategories.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'dairy',
          pantryItemCount: 1,
          deletable: false
        }),
        expect.objectContaining({
          name: 'dry',
          pantryItemCount: 0,
          deletable: true
        })
      ])
    )

    const createdCategory = await createPantryCategory(
      {
        spaceId: 'space-1',
        name: 'frozen'
      },
      context,
      repository
    )
    expect(createdCategory.item).toEqual(
      expect.objectContaining({
        name: 'frozen',
        pantryItemCount: 0,
        deletable: true
      })
    )
    expect(repository.__getSpaceSettings('space-1').pantryCategories).toContain('frozen')

    const renamedCategory = await updatePantryCategory(
      {
        spaceId: 'space-1',
        previousName: 'dairy',
        name: 'cold-storage'
      },
      context,
      repository
    )
    expect(renamedCategory.item).toEqual(
      expect.objectContaining({
        name: 'cold-storage',
        pantryItemCount: 1
      })
    )
    expect((await repository.getPantryItem('space-1', 'pantry-1')).category).toBe('cold-storage')

    await expect(
      deletePantryCategory(
        {
          spaceId: 'space-1',
          name: 'cold-storage'
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT
    })

    const removedCategory = await deletePantryCategory(
      {
        spaceId: 'space-1',
        name: 'frozen'
      },
      context,
      repository
    )
    expect(removedCategory).toEqual({
      deleted: true,
      name: 'frozen'
    })

    const listedLocations = await listPantryLocations(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )
    expect(listedLocations.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'fridge',
          pantryItemCount: 1,
          deletable: false
        }),
        expect.objectContaining({
          name: 'cabinet',
          pantryItemCount: 0,
          deletable: true
        })
      ])
    )

    const createdLocation = await createPantryLocation(
      {
        spaceId: 'space-1',
        name: 'freezer'
      },
      context,
      repository
    )
    expect(createdLocation.item).toEqual(
      expect.objectContaining({
        name: 'freezer',
        pantryItemCount: 0,
        deletable: true
      })
    )
    expect(repository.__getSpaceSettings('space-1').pantryLocations).toContain('freezer')

    const renamedLocation = await updatePantryLocation(
      {
        spaceId: 'space-1',
        previousName: 'fridge',
        name: 'chiller'
      },
      context,
      repository
    )
    expect(renamedLocation.item).toEqual(
      expect.objectContaining({
        name: 'chiller',
        pantryItemCount: 1
      })
    )
    expect((await repository.getPantryItem('space-1', 'pantry-1')).location).toBe('chiller')

    await expect(
      deletePantryLocation(
        {
          spaceId: 'space-1',
          name: 'chiller'
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT
    })

    const removedLocation = await deletePantryLocation(
      {
        spaceId: 'space-1',
        name: 'freezer'
      },
      context,
      repository
    )
    expect(removedLocation).toEqual({
      deleted: true,
      name: 'freezer'
    })
  })

  it('reorders pantry categories and locations by updating stored settings order', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Milk',
          category: 'dairy',
          location: 'fridge'
        }
      },
      context,
      repository
    )

    const categoryResult = await reorderPantryCategories(
      {
        spaceId: 'space-1',
        names: ['dry', 'dairy']
      },
      context,
      repository
    )
    expect(categoryResult.items.map((item) => item.name)).toEqual(['dry', 'dairy'])
    expect(repository.__getSpaceSettings('space-1').pantryCategories).toEqual(['dry', 'dairy'])

    const locationResult = await reorderPantryLocations(
      {
        spaceId: 'space-1',
        names: ['cabinet', 'fridge']
      },
      context,
      repository
    )
    expect(locationResult.items.map((item) => item.name)).toEqual(['cabinet', 'fridge'])
    expect(repository.__getSpaceSettings('space-1').pantryLocations).toEqual(['cabinet', 'fridge'])
  })

  it('returns truncation metadata and complete filter options from active items', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Milk',
          category: 'dairy',
          location: 'fridge'
        }
      },
      context,
      repository
    )
    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Rice',
          category: 'dry',
          location: 'cabinet'
        }
      },
      context,
      repository
    )

    const limited = await listPantry(
      {
        spaceId: 'space-1',
        filters: {},
        limit: 1
      },
      context,
      repository
    )

    expect(limited.items).toHaveLength(1)
    expect(limited.total).toBe(2)
    expect(limited.hasMore).toBe(true)
    expect(limited.filterOptions).toEqual({
      categories: ['dairy', 'dry'],
      locations: ['fridge', 'cabinet']
    })
  })

  it('pushes deleted filtering to repository query so deleted rows do not consume cap slots', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Milk',
          category: 'dairy',
          location: 'fridge'
        }
      },
      context,
      repository
    )
    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Rice',
          category: 'dry',
          location: 'cabinet'
        }
      },
      context,
      repository
    )
    await deletePantryItem(
      {
        spaceId: 'space-1',
        pantryItemId: 'pantry-1'
      },
      context,
      repository
    )

    const limited = await listPantry(
      {
        spaceId: 'space-1',
        filters: {},
        limit: 1
      },
      context,
      repository
    )

    expect(repository.getLastListQuery()).toEqual({
      spaceId: 'space-1',
      category: '',
      location: '',
      deletedAt: '',
      limit: 1
    })
    expect(limited.items).toHaveLength(1)
    expect(limited.items[0].name).toBe('Rice')
  })

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
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
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
        status: 'expiring',
        handledType: null,
        handledAt: null,
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
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )

    expect(updated.item).toEqual(
      expect.objectContaining({
        _id: 'pantry-1',
        name: 'Greek Yogurt',
        quantity: '2',
        status: 'active',
        updatedBy: 'user-1'
      })
    )

    const filtered = await listPantry(
      {
        spaceId: 'space-1',
        filters: {
          category: 'dairy',
          status: 'active'
        },
        now: '2026-04-10'
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )

    expect(repository.getLastListQuery()).toEqual({
      spaceId: 'space-1',
      category: 'dairy',
      location: '',
      deletedAt: '',
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
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )

    const beforeDelete = await listPantry(
      {
        spaceId: 'space-1',
        filters: {},
        now: '2026-04-10'
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )
    expect(beforeDelete.items).toHaveLength(1)

    const deleted = await deletePantryItem(
      {
        spaceId: 'space-1',
        pantryItemId: 'pantry-1',
        now: '2026-04-10'
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
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
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )

    expect(afterDelete.items).toEqual([])
  })

  it('preserves existing status on update when edit payload does not include it', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await createPantryItem(
      {
        spaceId: 'space-1',
        item: {
          name: 'Milk',
          status: 'opened'
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )

    const updated = await updatePantryItem(
      {
        spaceId: 'space-1',
        pantryItemId: 'pantry-1',
        item: {
          name: 'Fresh Milk'
        }
      },
      context,
      repository,
      {
        clock: {
          now: () => new Date('2026-04-10T04:00:00.000Z')
        }
      }
    )

    expect(updated.item).toEqual(
      expect.objectContaining({
        name: 'Fresh Milk',
        status: 'opened'
      })
    )
  })
})
