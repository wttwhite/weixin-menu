import { describe, expect, it, vi } from 'vitest'
import {
  createRecipe,
  createRecipeCategory,
  createRecipeService,
  createRecipeTag,
  deleteRecipe,
  deleteRecipeCategory,
  deleteRecipeTag,
  getRecipeDetail,
  listRecipeCategories,
  listRecipeTags,
  updateRecipeCategory,
  listRecipes,
  updateRecipe
} from '../../miniprogram/services/recipe'

describe('createRecipeService', () => {
  it('calls the api cloud function for recipe and tag actions', async () => {
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
          data: { item: { _id: 'recipe-1' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { _id: 'recipe-1' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { recipeId: 'recipe-1', deleted: true }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { items: [] }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { _id: 'tag-1' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { tagId: 'tag-1', deleted: true }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { _id: 'recipe-1' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { items: [{ name: '热菜', recipeCount: 2 }] }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { name: '凉菜' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { item: { name: '家常热菜' } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { deleted: true, name: '饮品' }
        }
      })

    const service = createRecipeService({ callCloud })
    await service.listRecipes('space-1')
    await service.createRecipe('space-1', { name: 'Mapo Tofu' })
    await service.updateRecipe('space-1', 'recipe-1', { name: 'Mapo Tofu 2' })
    await service.deleteRecipe('space-1', 'recipe-1')
    await service.listRecipeTags('space-1')
    await service.createRecipeTag('space-1', { name: '家常' })
    await service.deleteRecipeTag('space-1', 'tag-1')
    await service.getRecipeDetail('space-1', 'recipe-1')
    await service.listRecipeCategories('space-1')
    await service.createRecipeCategory('space-1', '凉菜')
    await service.updateRecipeCategory('space-1', '热菜', '家常热菜')
    await service.deleteRecipeCategory('space-1', '饮品')

    expect(callCloud).toHaveBeenNthCalledWith(1, 'api', {
      action: 'listRecipes',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(2, 'api', {
      action: 'createRecipe',
      spaceId: 'space-1',
      recipe: { name: 'Mapo Tofu' }
    })
    expect(callCloud).toHaveBeenNthCalledWith(3, 'api', {
      action: 'updateRecipe',
      spaceId: 'space-1',
      recipeId: 'recipe-1',
      recipe: { name: 'Mapo Tofu 2' }
    })
    expect(callCloud).toHaveBeenNthCalledWith(4, 'api', {
      action: 'deleteRecipe',
      spaceId: 'space-1',
      recipeId: 'recipe-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(5, 'api', {
      action: 'listRecipeTags',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(6, 'api', {
      action: 'createRecipeTag',
      spaceId: 'space-1',
      tag: { name: '家常' }
    })
    expect(callCloud).toHaveBeenNthCalledWith(7, 'api', {
      action: 'deleteRecipeTag',
      spaceId: 'space-1',
      tagId: 'tag-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(8, 'api', {
      action: 'getRecipeDetail',
      spaceId: 'space-1',
      recipeId: 'recipe-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(9, 'api', {
      action: 'listRecipeCategories',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(10, 'api', {
      action: 'createRecipeCategory',
      spaceId: 'space-1',
      name: '凉菜'
    })
    expect(callCloud).toHaveBeenNthCalledWith(11, 'api', {
      action: 'updateRecipeCategory',
      spaceId: 'space-1',
      previousName: '热菜',
      name: '家常热菜'
    })
    expect(callCloud).toHaveBeenNthCalledWith(12, 'api', {
      action: 'deleteRecipeCategory',
      spaceId: 'space-1',
      name: '饮品'
    })
  })

  it('unwraps non-zero api responses into thrown errors', async () => {
    const service = createRecipeService({
      callCloud: vi.fn().mockResolvedValue({
        result: {
          code: 400,
          message: 'Recipe name is required',
          data: null
        }
      })
    })

    await expect(service.createRecipe('space-1', { name: '' })).rejects.toMatchObject({
      code: 400,
      message: 'Recipe name is required'
    })
  })
})

describe('recipe service helpers', () => {
  it('exposes convenience exports', () => {
    expect(typeof listRecipes).toBe('function')
    expect(typeof createRecipe).toBe('function')
    expect(typeof updateRecipe).toBe('function')
    expect(typeof deleteRecipe).toBe('function')
    expect(typeof listRecipeTags).toBe('function')
    expect(typeof createRecipeTag).toBe('function')
    expect(typeof deleteRecipeTag).toBe('function')
    expect(typeof getRecipeDetail).toBe('function')
    expect(typeof listRecipeCategories).toBe('function')
    expect(typeof createRecipeCategory).toBe('function')
    expect(typeof updateRecipeCategory).toBe('function')
    expect(typeof deleteRecipeCategory).toBe('function')
  })
})
