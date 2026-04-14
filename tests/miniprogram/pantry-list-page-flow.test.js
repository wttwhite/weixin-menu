import { beforeEach, describe, expect, it, vi } from 'vitest'

function createPageInstance(pageConfig) {
  const instance = {
    data: { ...(pageConfig.data || {}) },
    setData(nextData) {
      this.data = {
        ...this.data,
        ...nextData
      }
    }
  }

  Object.keys(pageConfig).forEach((key) => {
    if (key === 'data' || typeof pageConfig[key] !== 'function') {
      return
    }
    instance[key] = pageConfig[key].bind(instance)
  })

  return instance
}

async function loadPage(modulePath) {
  let capturedPage = null
  global.Page = (config) => {
    capturedPage = config
  }

  await import(modulePath)
  return createPageInstance(capturedPage)
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Page
  delete global.wx
  delete global.getApp
})

describe('pantry list page flow', () => {
  it('keeps empty-state CTA hidden when pantry loading fails', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 500,
            message: 'server error',
            data: null
          }
        })
      },
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.errorMessage).toBe('server error')
    expect(page.data.showEmptyState).toBe(false)
    expect(page.data.visibleItems).toEqual([])
  })

  it('builds pantry rail categories and filters visible items by category, keyword, and processed toggle', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValue({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              },
              {
                _id: 'pantry-2',
                name: 'Rice',
                category: 'dry',
                location: 'cabinet',
                quantity: '2',
                unit: '袋',
                status: 'fresh',
                usageStatus: 'used-up'
              },
              {
                _id: 'pantry-3',
                name: 'Yogurt',
                category: 'dairy',
                location: 'fridge',
                quantity: '3',
                unit: '杯',
                status: 'expiring-soon',
                usageStatus: 'opened'
              }
            ],
            filterOptions: {
              categories: ['dairy', 'dry'],
              locations: ['fridge', 'cabinet']
            }
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.activeCategoryKey).toBe('all')
    expect(page.data.categoryViewItems.map((item) => item.label)).toEqual(['全部', 'dairy', 'dry'])
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Milk', 'Yogurt'])
    expect(page.data.managementStatusText).toBe('正常 1 · 已开封 1 · 即将过期 1 · 已过期 0 · 已用完 1 · 已丢弃 0')
    expect(page.data.managementCategoryCountText).toBe('dairy 2 · dry 1')
    expect(page.data.items[0].statusLabel).toBe('')
    expect(page.data.items[0].showStatusBadge).toBe(false)
    expect(page.data.items[2].statusLabel).toBe('临期')
    expect(page.data.items[2].showStatusBadge).toBe(true)

    page.handleToggleProcessed()
    expect(page.data.showProcessed).toBe(true)
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Milk', 'Rice', 'Yogurt'])

    page.handleSearchInput({
      detail: {
        value: 'yo'
      }
    })
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Yogurt'])

    page.handleCategoryChange({
      currentTarget: {
        dataset: {
          key: 'dairy'
        }
      }
    })
    expect(page.data.activeCategoryKey).toBe('dairy')
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Yogurt'])

    page.handleSearchInput({
      detail: {
        value: ''
      }
    })
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Milk', 'Yogurt'])

    page.handleToggleProcessed()
    expect(page.data.showProcessed).toBe(false)
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Milk', 'Yogurt'])

    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(callFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'listPantry',
        spaceId: 'space-1',
        filters: {}
      },
      config: undefined
    })
  })

  it('opens the settings modal from the top-right entry and loads categories and locations together', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
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
            items: [{ name: 'fridge', pantryItemCount: 1, deletable: false }]
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openSettingsModal()
    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'api',
      data: {
        action: 'listPantryCategories',
        spaceId: 'space-1'
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenNthCalledWith(3, {
      name: 'api',
      data: {
        action: 'listPantryLocations',
        spaceId: 'space-1'
      },
      config: undefined
    })
    expect(page.data.showSettingsModal).toBe(true)
    expect(page.data.categoryManagerItems).toEqual([
      expect.objectContaining({
        name: 'dairy',
        pantryItemCount: 1,
        deletable: false
      })
    ])
    expect(page.data.locationManagerItems).toEqual([
      expect.objectContaining({
        name: 'fridge',
        pantryItemCount: 1,
        deletable: false
      })
    ])
  })

  it('treats missing category and location data as empty state without showing not-found toast', async () => {
    const showToast = vi.fn()
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 404,
          message: 'Pantry category not found',
          data: null
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 404,
          message: 'Pantry location not found',
          data: null
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openSettingsModal()

    expect(showToast).not.toHaveBeenCalledWith({
      title: '没有找到对应的数据',
      icon: 'none'
    })
    expect(page.data.showSettingsModal).toBe(true)
    expect(page.data.categoryManagerItems).toEqual([])
    expect(page.data.locationManagerItems).toEqual([])
  })

  it('shows a deploy hint when creating a category hits an unsupported cloud action', async () => {
    const showToast = vi.fn()
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: []
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: []
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 404,
          message: 'Unsupported action',
          data: null
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()
    await page.openSettingsModal()

    page.handleCategoryManagerInput({
      detail: {
        value: 'dry'
      }
    })
    await page.submitCategoryManagerCreate()

    expect(showToast).toHaveBeenCalledWith({
      title: '云函数未更新，请重新部署 api 云函数',
      icon: 'none'
    })
  })

  it('reorders category manager items by dragging the handle and persists the new order', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: 'dairy', pantryItemCount: 1, deletable: false },
              { name: 'dry', pantryItemCount: 0, deletable: true }
            ]
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
            items: [
              { name: 'dry', pantryItemCount: 0, deletable: true },
              { name: 'dairy', pantryItemCount: 1, deletable: false }
            ]
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()
    await page.openSettingsModal()

    page.handleManagerDragStart({
      currentTarget: {
        dataset: {
          type: 'category',
          index: 0
        }
      },
      touches: [{ pageY: 0 }]
    })
    expect(page.data.draggingManagerType).toBe('category')
    expect(page.data.draggingManagerIndex).toBe(0)

    page.handleManagerDragMove({
      currentTarget: {
        dataset: {
          type: 'category'
        }
      },
      touches: [{ pageY: 80 }]
    })

    expect(page.data.categoryManagerItems.map((item) => item.name)).toEqual(['dry', 'dairy'])
    expect(page.data.draggingManagerIndex).toBe(1)

    await page.handleManagerDragEnd({
      currentTarget: {
        dataset: {
          type: 'category'
        }
      }
    })

    expect(callFunction).toHaveBeenNthCalledWith(4, {
      name: 'api',
      data: {
        action: 'reorderPantryCategories',
        spaceId: 'space-1',
        names: ['dry', 'dairy']
      },
      config: undefined
    })
    expect(page.data.draggingManagerType).toBe('')
  })

  it('creates, renames, and deletes pantry categories from the settings modal', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
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
            items: [{ name: 'fridge', pantryItemCount: 1, deletable: false }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: 'dry', pantryItemCount: 0, deletable: true }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: 'dairy', pantryItemCount: 1, deletable: false },
              { name: 'dry', pantryItemCount: 0, deletable: true }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: '冷藏乳品', pantryItemCount: 1, deletable: false }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: '冷藏乳品',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: '冷藏乳品', pantryItemCount: 1, deletable: false },
              { name: 'dry', pantryItemCount: 0, deletable: true }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            deleted: true,
            name: 'dry'
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: '冷藏乳品',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '冷藏乳品', pantryItemCount: 1, deletable: false }]
          }
        }
      })
    const showModal = vi
      .fn()
      .mockResolvedValueOnce({
        confirm: true,
        content: '冷藏乳品'
      })
      .mockResolvedValueOnce({
        confirm: true
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showModal,
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openSettingsModal()
    page.handleCategoryManagerInput({
      detail: {
        value: 'dry'
      }
    })
    await page.submitCategoryManagerCreate()

    expect(callFunction).toHaveBeenNthCalledWith(4, {
      name: 'api',
      data: {
        action: 'createPantryCategory',
        spaceId: 'space-1',
        name: 'dry'
      },
      config: undefined
    })
    expect(page.data.categoryManagerInput).toBe('')

    await page.renameCategoryManagerItem({
      currentTarget: {
        dataset: {
          name: 'dairy'
        }
      }
    })
    expect(callFunction).toHaveBeenNthCalledWith(7, {
      name: 'api',
      data: {
        action: 'updatePantryCategory',
        spaceId: 'space-1',
        previousName: 'dairy',
        name: '冷藏乳品'
      },
      config: undefined
    })

    await page.deleteCategoryManagerItem({
      currentTarget: {
        dataset: {
          name: 'dry',
          deletable: true
        }
      }
    })
    expect(callFunction).toHaveBeenNthCalledWith(10, {
      name: 'api',
      data: {
        action: 'deletePantryCategory',
        spaceId: 'space-1',
        name: 'dry'
      },
      config: undefined
    })
    expect(page.data.categoryManagerItems).toEqual([
      expect.objectContaining({
        name: '冷藏乳品',
        pantryItemCount: 1,
        deletable: false
      })
    ])
  })

  it('cycles usageStatus through cloud update and refreshes the local list state', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'pantry-1',
              name: 'Milk',
              category: 'dairy',
              location: 'fridge',
              quantity: '1',
              unit: '盒',
              status: 'fresh',
              usageStatus: 'opened'
            }
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.handleCycleUsageStatus({
      currentTarget: {
        dataset: {
          pantryItemId: 'pantry-1'
        }
      }
    })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'api',
      data: {
        action: 'updatePantryItem',
        spaceId: 'space-1',
        pantryItemId: 'pantry-1',
        item: expect.objectContaining({
          name: 'Milk',
          usageStatus: 'opened'
        })
      },
      config: undefined
    })
    expect(page.data.items[0]).toEqual(
      expect.objectContaining({
        usageStatus: 'opened',
        usageStatusLabel: '已开封'
      })
    )
  })

  it('uses server-provided filter options so capped list does not hide categories/locations', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            { _id: 'pantry-1', name: 'Milk', category: 'dairy', location: 'fridge', status: 'fresh' }
          ],
          total: 2,
          hasMore: true,
          limit: 1,
          filterOptions: {
            categories: ['dairy', 'dry'],
            locations: ['fridge', 'cabinet']
          }
        }
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.categoryViewItems.map((item) => item.label)).toEqual(['全部', 'dairy', 'dry'])
  })

  it('shows truncation hint when server indicates capped list has more items', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            { _id: 'pantry-1', name: 'Milk', category: 'dairy', location: 'fridge', status: 'fresh' }
          ],
          total: 3,
          hasMore: true,
          limit: 1
        }
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.truncationMessage).toBe('当前仅显示前 1 条库存，请继续筛选以缩小范围。')
  })

  it('deletes pantry items from the visible list through cloud delete', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              },
              {
                _id: 'pantry-2',
                name: 'Rice',
                category: 'dry',
                location: 'cabinet',
                quantity: '2',
                unit: '袋',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
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
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.handleDeleteItem({
      currentTarget: {
        dataset: {
          pantryItemId: 'pantry-1'
        }
      }
    })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'api',
      data: {
        action: 'deletePantryItem',
        spaceId: 'space-1',
        pantryItemId: 'pantry-1'
      },
      config: undefined
    })
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Rice'])
    expect(page.data.categoryViewItems.map((item) => item.label)).toEqual(['全部', 'dairy', 'dry'])
  })

  it('shows cloud error toast when usageStatus update fails', async () => {
    const showToast = vi.fn()
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'pantry-1',
                name: 'Milk',
                category: 'dairy',
                location: 'fridge',
                quantity: '1',
                unit: '盒',
                status: 'fresh',
                usageStatus: 'normal'
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 500,
          message: 'cloud write failed',
          data: null
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      showToast,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.handleCycleUsageStatus({
      currentTarget: {
        dataset: {
          pantryItemId: 'pantry-1'
        }
      }
    })
    await flushAsyncWork()

    expect(showToast).toHaveBeenCalledWith({
      title: 'cloud write failed',
      icon: 'none'
    })
    expect(page.data.items[0]).toEqual(
      expect.objectContaining({
        usageStatus: 'normal'
      })
    )
  })
})
