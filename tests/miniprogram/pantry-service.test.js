import { describe, expect, it, vi } from 'vitest'
import {
  createPantryService,
  createPantryItem,
  createPantryCategory,
  createPantryLocation,
  deletePantryItem,
  deletePantryCategory,
  deletePantryLocation,
  getPantryItem,
  listPantry,
  listPantryCategories,
  listPantryLocations,
  reorderPantryCategories,
  reorderPantryLocations,
  updatePantryCategory,
  updatePantryLocation,
  updatePantryItem
} from '../../miniprogram/services/pantry'

describe('createPantryService', () => {
  it('calls the api cloud function for pantry CRUD and manager actions', async () => {
    const callCloud = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'pantry-1', name: 'Milk' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { _id: 'pantry-1', name: 'Milk' }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { _id: 'pantry-1', name: 'Oat Milk' }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            pantryItemId: 'pantry-1',
            deleted: true
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { _id: 'pantry-1', name: 'Milk' }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'dairy', pantryItemCount: 1, deletable: false }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: 'frozen', pantryItemCount: 0, deletable: true }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: '冷藏', pantryItemCount: 1, deletable: false }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            deleted: true,
            name: 'frozen'
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'fridge', pantryItemCount: 1, deletable: false }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: 'freezer', pantryItemCount: 0, deletable: true }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: 'chiller', pantryItemCount: 1, deletable: false }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            deleted: true,
            name: 'freezer'
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: 'dry', pantryItemCount: 0, deletable: true },
              { name: 'dairy', pantryItemCount: 1, deletable: false }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: 'cabinet', pantryItemCount: 0, deletable: true },
              { name: 'fridge', pantryItemCount: 1, deletable: false }
            ]
          }
        }
      })

    const service = createPantryService({ callCloud })

    await expect(
      service.listPantry('space-1', {
        category: 'dairy'
      })
    ).resolves.toEqual({
      items: [{ _id: 'pantry-1', name: 'Milk' }]
    })

    await expect(
      service.createPantryItem('space-1', {
        name: 'Milk'
      })
    ).resolves.toEqual({
      item: { _id: 'pantry-1', name: 'Milk' }
    })

    await expect(
      service.updatePantryItem('space-1', 'pantry-1', {
        name: 'Oat Milk'
      })
    ).resolves.toEqual({
      item: { _id: 'pantry-1', name: 'Oat Milk' }
    })

    await expect(service.deletePantryItem('space-1', 'pantry-1')).resolves.toEqual({
      pantryItemId: 'pantry-1',
      deleted: true
    })

    await expect(service.getPantryItem('space-1', 'pantry-1')).resolves.toEqual({
      item: { _id: 'pantry-1', name: 'Milk' }
    })
    await expect(service.listPantryCategories('space-1')).resolves.toEqual({
      items: [{ name: 'dairy', pantryItemCount: 1, deletable: false }]
    })
    await expect(service.createPantryCategory('space-1', 'frozen')).resolves.toEqual({
      item: { name: 'frozen', pantryItemCount: 0, deletable: true }
    })
    await expect(service.updatePantryCategory('space-1', 'dairy', '冷藏')).resolves.toEqual({
      item: { name: '冷藏', pantryItemCount: 1, deletable: false }
    })
    await expect(service.deletePantryCategory('space-1', 'frozen')).resolves.toEqual({
      deleted: true,
      name: 'frozen'
    })
    await expect(service.listPantryLocations('space-1')).resolves.toEqual({
      items: [{ name: 'fridge', pantryItemCount: 1, deletable: false }]
    })
    await expect(service.createPantryLocation('space-1', 'freezer')).resolves.toEqual({
      item: { name: 'freezer', pantryItemCount: 0, deletable: true }
    })
    await expect(service.updatePantryLocation('space-1', 'fridge', 'chiller')).resolves.toEqual({
      item: { name: 'chiller', pantryItemCount: 1, deletable: false }
    })
    await expect(service.deletePantryLocation('space-1', 'freezer')).resolves.toEqual({
      deleted: true,
      name: 'freezer'
    })
    await expect(service.reorderPantryCategories('space-1', ['dry', 'dairy'])).resolves.toEqual({
      items: [
        { name: 'dry', pantryItemCount: 0, deletable: true },
        { name: 'dairy', pantryItemCount: 1, deletable: false }
      ]
    })
    await expect(service.reorderPantryLocations('space-1', ['cabinet', 'fridge'])).resolves.toEqual({
      items: [
        { name: 'cabinet', pantryItemCount: 0, deletable: true },
        { name: 'fridge', pantryItemCount: 1, deletable: false }
      ]
    })

    expect(callCloud).toHaveBeenNthCalledWith(1, 'api', {
      action: 'listPantry',
      spaceId: 'space-1',
      filters: {
        category: 'dairy'
      }
    })
    expect(callCloud).toHaveBeenNthCalledWith(2, 'api', {
      action: 'createPantryItem',
      spaceId: 'space-1',
      item: {
        name: 'Milk'
      }
    })
    expect(callCloud).toHaveBeenNthCalledWith(3, 'api', {
      action: 'updatePantryItem',
      spaceId: 'space-1',
      pantryItemId: 'pantry-1',
      item: {
        name: 'Oat Milk'
      }
    })
    expect(callCloud).toHaveBeenNthCalledWith(4, 'api', {
      action: 'deletePantryItem',
      spaceId: 'space-1',
      pantryItemId: 'pantry-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(5, 'api', {
      action: 'getPantryItem',
      spaceId: 'space-1',
      pantryItemId: 'pantry-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(6, 'api', {
      action: 'listPantryCategories',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(7, 'api', {
      action: 'createPantryCategory',
      spaceId: 'space-1',
      name: 'frozen'
    })
    expect(callCloud).toHaveBeenNthCalledWith(8, 'api', {
      action: 'updatePantryCategory',
      spaceId: 'space-1',
      previousName: 'dairy',
      name: '冷藏'
    })
    expect(callCloud).toHaveBeenNthCalledWith(9, 'api', {
      action: 'deletePantryCategory',
      spaceId: 'space-1',
      name: 'frozen'
    })
    expect(callCloud).toHaveBeenNthCalledWith(10, 'api', {
      action: 'listPantryLocations',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(11, 'api', {
      action: 'createPantryLocation',
      spaceId: 'space-1',
      name: 'freezer'
    })
    expect(callCloud).toHaveBeenNthCalledWith(12, 'api', {
      action: 'updatePantryLocation',
      spaceId: 'space-1',
      previousName: 'fridge',
      name: 'chiller'
    })
    expect(callCloud).toHaveBeenNthCalledWith(13, 'api', {
      action: 'deletePantryLocation',
      spaceId: 'space-1',
      name: 'freezer'
    })
    expect(callCloud).toHaveBeenNthCalledWith(14, 'api', {
      action: 'reorderPantryCategories',
      spaceId: 'space-1',
      names: ['dry', 'dairy']
    })
    expect(callCloud).toHaveBeenNthCalledWith(15, 'api', {
      action: 'reorderPantryLocations',
      spaceId: 'space-1',
      names: ['cabinet', 'fridge']
    })
  })

  it('unwraps non-zero api responses into thrown errors', async () => {
    const service = createPantryService({
      callCloud: vi.fn().mockResolvedValue({
        result: {
          code: 400,
          message: 'Item name is required',
          data: null
        }
      })
    })

    await expect(service.createPantryItem('space-1', { name: '' })).rejects.toMatchObject({
      code: 400,
      message: 'Item name is required'
    })
  })
})

describe('pantry service helpers', () => {
  const callCloud = vi.fn()

  it('exposes convenience exports', () => {
    expect(typeof listPantry).toBe('function')
    expect(typeof createPantryItem).toBe('function')
    expect(typeof updatePantryItem).toBe('function')
    expect(typeof deletePantryItem).toBe('function')
    expect(typeof getPantryItem).toBe('function')
    expect(typeof listPantryCategories).toBe('function')
    expect(typeof createPantryCategory).toBe('function')
    expect(typeof updatePantryCategory).toBe('function')
    expect(typeof deletePantryCategory).toBe('function')
    expect(typeof reorderPantryCategories).toBe('function')
    expect(typeof listPantryLocations).toBe('function')
    expect(typeof createPantryLocation).toBe('function')
    expect(typeof updatePantryLocation).toBe('function')
    expect(typeof deletePantryLocation).toBe('function')
    expect(typeof reorderPantryLocations).toBe('function')
  })

  it('delegates convenience calls through createPantryService', async () => {
    callCloud.mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: []
        }
      }
    })

    await listPantry('space-1', {}, { callCloud })

    expect(callCloud).toHaveBeenCalledWith('api', {
      action: 'listPantry',
      spaceId: 'space-1',
      filters: {}
    })
  })
})
