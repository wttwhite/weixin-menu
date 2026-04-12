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

describe('recipes page flow', () => {
  it('shows truncation summary when server indicates capped recipe list has more items', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              items: [{ _id: 'recipe-1', name: 'Mapo' }],
              total: 120,
              hasMore: true,
              limit: 100
            }
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

    const page = await loadPage('../../miniprogram/pages/recipes/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.summary).toContain('120')
    expect(page.data.summary).toContain('100')
  })

  it('keeps empty-state CTA hidden when recipe loading fails', async () => {
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

    const page = await loadPage('../../miniprogram/pages/recipes/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.errorMessage).toBe('server error')
    expect(page.data.showEmptyState).toBe(false)
    expect(page.data.items).toEqual([])
  })

  it('builds metric summary for recommendation, servings, and durations', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              items: [
                {
                  _id: 'recipe-1',
                  name: 'Mapo',
                  recommendationScore: 4.5,
                  servings: 3,
                  prepTimeMinutes: 10,
                  cookTimeMinutes: 20
                }
              ]
            }
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

    const page = await loadPage('../../miniprogram/pages/recipes/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.items[0].metricSummary).toContain('推荐 4.5')
    expect(page.data.items[0].metricSummary).toContain('3 人份')
    expect(page.data.items[0].metricSummary).toContain('准备 10 分钟')
    expect(page.data.items[0].metricSummary).toContain('烹饪 20 分钟')
  })
})

