import { describe, expect, it } from 'vitest'
import {
  buildRecipeCategoryManagerItems
} from '../../miniprogram/utils/recipe-category-manager'
import {
  buildPantryManagerItems,
  getPantryManagerConfig
} from '../../miniprogram/utils/pantry-manager'

describe('category and pantry manager helpers', () => {
  it('builds recipe category manager items with count and delete state', () => {
    const items = buildRecipeCategoryManagerItems([
      { name: '家常菜', recipeCount: 4, deletable: false },
      { name: '饮品', recipeCount: 0, deletable: true }
    ])

    expect(items[0]).toEqual(
      expect.objectContaining({
        name: '家常菜',
        countText: '4 个菜谱',
        showDelete: false
      })
    )
    expect(items[1].showDelete).toBe(true)
  })

  it('returns pantry manager config for category and location modes', () => {
    expect(getPantryManagerConfig('category')).toEqual(
      expect.objectContaining({
        title: '食材分类',
        listMethod: 'listPantryCategories'
      })
    )
    expect(getPantryManagerConfig('location')).toEqual(
      expect.objectContaining({
        title: '食材位置',
        listMethod: 'listPantryLocations'
      })
    )
  })

  it('builds pantry manager items with reusable status text and delete visibility', () => {
    const items = buildPantryManagerItems([
      { name: '冷藏', pantryItemCount: 3, deletable: false },
      { name: '橱柜', pantryItemCount: 0, deletable: true }
    ], 'location')

    expect(items[0].countText).toBe('3 项食材')
    expect(items[0].showDelete).toBe(false)
    expect(items[1].showDelete).toBe(true)
  })
})
