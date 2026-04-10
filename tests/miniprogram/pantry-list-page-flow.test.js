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

  it('reloads pantry list from server when category filter changes', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { _id: 'pantry-1', name: 'Milk', category: 'dairy', location: 'fridge', status: 'fresh' },
              { _id: 'pantry-2', name: 'Rice', category: 'dry', location: 'cabinet', status: 'fresh' }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { _id: 'pantry-1', name: 'Milk', category: 'dairy', location: 'fridge', status: 'fresh' }
            ]
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
    await page.handleCategoryChange({
      detail: { value: 1 }
    })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenNthCalledWith(1, {
      name: 'api',
      data: {
        action: 'listPantry',
        spaceId: 'space-1',
        filters: {}
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'api',
      data: {
        action: 'listPantry',
        spaceId: 'space-1',
        filters: {
          category: 'dairy'
        }
      },
      config: undefined
    })
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

    expect(page.data.categoryOptions).toEqual(['全部分类', 'dairy', 'dry'])
    expect(page.data.locationOptions).toEqual(['全部位置', 'fridge', 'cabinet'])
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
})
