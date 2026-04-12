import { describe, expect, it, vi } from 'vitest'
import { createShoppingService } from '../../miniprogram/services/shopping'

describe('createShoppingService', () => {
  it('calls shopping and statistics cloud actions', async () => {
    const callCloud = vi
      .fn()
      .mockResolvedValueOnce({ result: { code: 0, data: { items: [] } } })
      .mockResolvedValueOnce({ result: { code: 0, data: { item: { _id: 'list-1' } } } })
      .mockResolvedValueOnce({ result: { code: 0, data: { item: { _id: 'list-1', title: 'updated' } } } })
      .mockResolvedValueOnce({ result: { code: 0, data: { shoppingListId: 'list-1', deleted: true } } })
      .mockResolvedValueOnce({ result: { code: 0, data: { items: [{ _id: 'item-1' }] } } })
      .mockResolvedValueOnce({ result: { code: 0, data: { item: { _id: 'item-1', checked: true } } } })

    const service = createShoppingService({ callCloud })

    await service.listShoppingLists('space-1')
    await service.createShoppingList('space-1', { title: 'Weekend' })
    await service.updateShoppingList('space-1', 'list-1', { title: 'Updated' }, 'list-updated-at')
    await service.deleteShoppingList('space-1', 'list-1', 'list-updated-at')
    await service.generateShoppingItemsFromPlan('space-1', 'list-1', 'list-updated-at')
    await service.toggleShoppingItemChecked('space-1', 'list-1', 'item-1', true, 'item-updated-at', 'list-updated-at')

    expect(callCloud).toHaveBeenNthCalledWith(1, 'api', {
      action: 'listShoppingLists',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(2, 'api', {
      action: 'createShoppingList',
      spaceId: 'space-1',
      shoppingList: { title: 'Weekend' }
    })
    expect(callCloud).toHaveBeenNthCalledWith(3, 'api', {
      action: 'updateShoppingList',
      spaceId: 'space-1',
      shoppingListId: 'list-1',
      shoppingList: { title: 'Updated' },
      expectedUpdatedAt: 'list-updated-at'
    })
    expect(callCloud).toHaveBeenNthCalledWith(4, 'api', {
      action: 'deleteShoppingList',
      spaceId: 'space-1',
      shoppingListId: 'list-1',
      expectedUpdatedAt: 'list-updated-at'
    })
    expect(callCloud).toHaveBeenNthCalledWith(5, 'api', {
      action: 'generateShoppingItemsFromPlan',
      spaceId: 'space-1',
      shoppingListId: 'list-1',
      expectedUpdatedAt: 'list-updated-at'
    })
    expect(callCloud).toHaveBeenNthCalledWith(6, 'api', {
      action: 'toggleShoppingItemChecked',
      spaceId: 'space-1',
      shoppingListId: 'list-1',
      shoppingItemId: 'item-1',
      checked: true,
      expectedUpdatedAt: 'item-updated-at',
      shoppingListExpectedUpdatedAt: 'list-updated-at'
    })
  })

  it('throws normalized error from non-zero response', async () => {
    const service = createShoppingService({
      callCloud: vi.fn().mockResolvedValue({
        result: {
          code: 400,
          message: 'shoppingListId is required',
          data: null
        }
      })
    })

    await expect(service.listShoppingLists('')).rejects.toMatchObject({
      code: 400,
      message: 'shoppingListId is required'
    })
  })
})
