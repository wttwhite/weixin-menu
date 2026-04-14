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

  it('does not render recommendation score in metric summary when score is unset', async () => {
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
                  recommendationScore: '',
                  servings: 2
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

    expect(page.data.items[0].metricSummary).toContain('2 人份')
    expect(page.data.items[0].metricSummary).not.toContain('推荐')
  })

  it('builds category sections and filters visible recipes when section changes', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              items: [
                { _id: 'recipe-1', name: 'Mapo', category: '川菜' },
                { _id: 'recipe-2', name: 'Soup', category: '汤' },
                { _id: 'recipe-3', name: 'Twice Cooked Pork', category: '川菜' }
              ]
            }
          }
        })
      },
      navigateTo: vi.fn(),
      switchTab: vi.fn(),
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

    expect(page.data.sectionOptions).toEqual([
      { key: 'all', label: '全部' },
      { key: '川菜', label: '川菜' },
      { key: '汤', label: '汤' }
    ])
    expect(page.data.activeSectionKey).toBe('all')
    expect(page.data.visibleItems).toHaveLength(3)

    page.handleSectionChange({
      currentTarget: {
        dataset: {
          key: '川菜'
        }
      }
    })

    expect(page.data.activeSectionKey).toBe('川菜')
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Mapo', 'Twice Cooked Pork'])
  })

  it('switches to pantry tab from the recipes quick link', async () => {
    const switchTab = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      navigateTo: vi.fn(),
      switchTab,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipes/index.js')
    page.goPantry()

    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/pantry/index'
    })
  })

  it('toggles selected recipes in page state and clears them from the bottom action bar', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              items: [
                { _id: 'recipe-1', name: 'Mapo', category: '川菜' },
                { _id: 'recipe-2', name: 'Soup', category: '汤' }
              ]
            }
          }
        })
      },
      navigateTo: vi.fn(),
      switchTab: vi.fn(),
      showToast: vi.fn(),
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

    page.toggleRecipeSelection({
      currentTarget: {
        dataset: {
          recipeId: 'recipe-1'
        }
      }
    })

    expect(page.data.selectedRecipeIds).toEqual(['recipe-1'])
    expect(page.data.selectedRecipesCount).toBe(1)

    page.toggleRecipeSelection({
      currentTarget: {
        dataset: {
          recipeId: 'recipe-2'
        }
      }
    })

    expect(page.data.selectedRecipeIds).toEqual(['recipe-1', 'recipe-2'])
    expect(page.data.selectedRecipesCount).toBe(2)

    page.clearSelectedRecipes()

    expect(page.data.selectedRecipeIds).toEqual([])
    expect(page.data.selectedRecipesCount).toBe(0)
  })

  it('shows placeholder toasts for random pick and add-to-plan actions', async () => {
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              items: [{ _id: 'recipe-1', name: 'Mapo', category: '川菜' }]
            }
          }
        })
      },
      navigateTo: vi.fn(),
      switchTab: vi.fn(),
      showToast,
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

    page.handleRandomPick()
    expect(showToast).toHaveBeenCalledWith({
      title: '随机点菜待实现',
      icon: 'none'
    })

    page.handlePlanSelectedRecipes()
    expect(showToast).toHaveBeenCalledWith({
      title: '请先选择菜谱',
      icon: 'none'
    })

    page.toggleRecipeSelection({
      currentTarget: {
        dataset: {
          recipeId: 'recipe-1'
        }
      }
    })
    page.handlePlanSelectedRecipes()

    expect(showToast).toHaveBeenCalledWith({
      title: '加入计划待实现',
      icon: 'none'
    })
  })

  it('opens category manager modal and loads category counts from cloud', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'recipe-1', name: 'Mapo', category: '健康时蔬' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: '健康时蔬', recipeCount: 1, deletable: false },
              { name: '饮品酒水', recipeCount: 0, deletable: true }
            ]
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      switchTab: vi.fn(),
      showToast: vi.fn(),
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
    await page.openCategoryManager()

    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'api',
      data: {
        action: 'listRecipeCategories',
        spaceId: 'space-1'
      },
      config: undefined
    })
    expect(page.data.showCategoryManager).toBe(true)
    expect(page.data.categoryManagerItems).toEqual([
      expect.objectContaining({
        name: '健康时蔬',
        recipeCount: 1,
        deletable: false
      }),
      expect.objectContaining({
        name: '饮品酒水',
        recipeCount: 0,
        deletable: true
      })
    ])
  })
})
