import { describe, expect, it, vi } from 'vitest'
import {
  createPantryService,
  createPantryItem,
  deletePantryItem,
  getPantryItem,
  listPantry,
  updatePantryItem
} from '../../miniprogram/services/pantry'

describe('createPantryService', () => {
  it('calls the api cloud function for pantry CRUD actions', async () => {
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
