import { beforeEach, describe, expect, it, vi } from 'vitest'
const NativeDate = Date

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
  global.Date = NativeDate
})

describe('recipes page flow', () => {
  it('shows newest recipes first even when the list response is unordered', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn()
          .mockResolvedValueOnce({
            result: {
              code: 0,
              data: {
                items: [
                  { _id: 'recipe-old', name: '旧菜谱', category: '家常', createdAt: '2026-04-20T08:00:00.000Z' },
                  { _id: 'recipe-new', name: '新菜谱', category: '家常', createdAt: '2026-04-28T08:00:00.000Z' },
                  { _id: 'recipe-mid', name: '中间菜谱', category: '家常', updatedAt: '2026-04-24T08:00:00.000Z' }
                ]
              }
            }
          })
          .mockResolvedValueOnce({
            result: {
              code: 0,
              data: {
                items: [
                  { name: '家常', recipeCount: 3 }
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

    expect(page.data.items.map((item) => item.name)).toEqual(['新菜谱', '中间菜谱', '旧菜谱'])
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['新菜谱', '中间菜谱', '旧菜谱'])
  })

  it('passes active category to create page and omits it for all-section', async () => {
    const navigateTo = vi.fn()
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
      navigateTo,
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

    page.handleSectionChange({
      currentTarget: {
        dataset: {
          key: '川菜'
        }
      }
    })
    page.goCreate()
    page.handleSectionChange({
      currentTarget: {
        dataset: {
          key: 'all'
        }
      }
    })
    page.goCreate()

    expect(navigateTo).toHaveBeenNthCalledWith(1, {
      url: '/pages/recipe-edit/index?category=%E5%B7%9D%E8%8F%9C'
    })
    expect(navigateTo).toHaveBeenNthCalledWith(2, {
      url: '/pages/recipe-edit/index'
    })
  })

  it('skips one full reload when returning directly from create mode without creating a recipe', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            { _id: 'recipe-1', name: 'Mapo', category: '川菜' }
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

    page.suppressNextOnShowReload()
    page.onShow()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(2)
  })

  it('reuses loaded recipe data on repeated onShow when active space is unchanged', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            { _id: 'recipe-1', name: 'Mapo', category: '川菜' }
          ]
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
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
    page.onShow()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(2)
  })

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

  it('filters visible recipes by search query and marks the search icon active only when a query exists', async () => {
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
                  summary: '麻辣下饭',
                  category: '川菜',
                  tags: [{ name: '下饭' }],
                  ingredients: [{ name: '豆腐' }]
                },
                {
                  _id: 'recipe-2',
                  name: 'Soup',
                  summary: '清淡',
                  category: '汤',
                  tags: [{ name: '暖胃' }],
                  ingredients: [{ name: '番茄' }]
                }
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

    page.toggleSearchPanel()
    expect(page.data.showSearchPanel).toBe(true)
    expect(page.data.searchToggleClass).toBe('management-card__search')

    page.handleRecipeSearchInput({ detail: { value: '豆腐' } })
    expect(page.data.recipeSearchQuery).toBe('豆腐')
    expect(page.data.searchToggleClass).toBe('management-card__search management-card__search--active')
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Mapo'])
    expect(page.data.visibleItemsCountText).toBe('1 道菜')

    page.clearRecipeSearch()
    expect(page.data.recipeSearchQuery).toBe('')
    expect(page.data.searchToggleClass).toBe('management-card__search')
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['Mapo', 'Soup'])
  })

  it('consumes queued created recipe locally, inserts it at the front, and skips full reload on return', async () => {
    const callFunction = vi.fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { _id: 'recipe-1', name: '菌菇汤', category: '美味汤羹', servings: '2' },
              { _id: 'recipe-2', name: 'Mapo', category: '川菜', servings: '3' }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: '美味汤羹', recipeCount: 1, deletable: false },
              { name: '川菜', recipeCount: 1, deletable: false }
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

    page.handleSectionChange({
      currentTarget: {
        dataset: {
          key: '美味汤羹'
        }
      }
    })

    page.queueCreatedRecipe({
      _id: 'recipe-new',
      name: '番茄菌菇汤',
      category: '美味汤羹',
      servings: '2',
      prepTimeMinutes: '10',
      cookTimeMinutes: '20',
      ingredients: [{ name: '番茄' }],
      steps: [{ content: '炖煮' }]
    })

    page.onShow()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.items.map((item) => item.name)).toEqual(['番茄菌菇汤', '菌菇汤', 'Mapo'])
    expect(page.data.visibleItems.map((item) => item.name)).toEqual(['番茄菌菇汤', '菌菇汤'])
    expect(page.data.categoryManagerItems).toEqual([
      expect.objectContaining({
        name: '美味汤羹',
        recipeCount: 2
      }),
      expect.objectContaining({
        name: '川菜',
        recipeCount: 1
      })
    ])
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
    expect(page.data.visibleItems[0].selectionSymbol).toBe('✓')

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
  })

  it('opens the add-to-plan modal with selected recipes, default date, and default dinner meal type', async () => {
    const RealDate = Date
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length) {
          super(...args)
          return
        }
        super('2026-04-21T09:00:00.000Z')
      }
      getFullYear() { return 2026 }
      getMonth() { return 3 }
      getDate() { return 21 }
    }
    global.Date = MockDate

    global.wx = {
      cloud: {
        callFunction: vi.fn()
          .mockResolvedValueOnce({
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
          .mockResolvedValueOnce({
            result: {
              code: 0,
              data: { items: [] }
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
    page.toggleRecipeSelection({
      currentTarget: {
        dataset: {
          recipeId: 'recipe-2'
        }
      }
    })
    page.handlePlanSelectedRecipes()

    expect(page.data.showPlanModal).toBe(true)
    expect(page.data.planModalDate).toBe('2026-04-21')
    expect(page.data.planModalMealType).toBe('dinner')
    expect(page.data.planModalSelectedRecipes).toEqual([
      expect.objectContaining({ _id: 'recipe-1', name: 'Mapo' }),
      expect.objectContaining({ _id: 'recipe-2', name: 'Soup' })
    ])

    global.Date = RealDate
  })

  it('removes selected recipes from the plan modal and syncs the list selection state', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn()
          .mockResolvedValueOnce({
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
          .mockResolvedValueOnce({
            result: {
              code: 0,
              data: { items: [] }
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

    page.toggleRecipeSelection({ currentTarget: { dataset: { recipeId: 'recipe-1' } } })
    page.toggleRecipeSelection({ currentTarget: { dataset: { recipeId: 'recipe-2' } } })
    page.handlePlanSelectedRecipes()
    page.removePlanModalRecipe({ currentTarget: { dataset: { recipeId: 'recipe-1' } } })

    expect(page.data.selectedRecipeIds).toEqual(['recipe-2'])
    expect(page.data.selectedRecipesCount).toBe(1)
    expect(page.data.planModalSelectedRecipes).toEqual([
      expect.objectContaining({ _id: 'recipe-2', name: 'Soup' })
    ])
    expect(page.data.items.find((item) => item._id === 'recipe-1').selected).toBe(false)
    expect(page.data.items.find((item) => item._id === 'recipe-2').selected).toBe(true)
    expect(page.data.visibleItems.find((item) => item._id === 'recipe-1').selectionSymbol).toBe('+')
    expect(page.data.visibleItems.find((item) => item._id === 'recipe-2').selectionSymbol).toBe('✓')
  })

  it('merges selected recipes into the same date and meal-type plan, dedupes by recipeId, then clears selection', async () => {
    const showToast = vi.fn()
    const markNeedsRefreshOnNextShow = vi.fn()
    const callFunction = vi.fn()
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { items: [] }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'meal-1',
                planDate: '2026-04-21',
                mealType: 'dinner',
                notes: '',
                recipes: [
                  { recipeId: 'recipe-1', recipeNameSnapshot: 'Mapo', servingsOverride: '', notes: '' },
                  { recipeId: 'recipe-3', recipeNameSnapshot: 'Noodle', servingsOverride: '', notes: '' }
                ]
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
              _id: 'meal-1',
              planDate: '2026-04-21',
              mealType: 'dinner'
            }
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
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
    global.getCurrentPages = () => ([
      {
        route: 'pages/meal-plans/index',
        markNeedsRefreshOnNextShow
      },
      {
        route: 'pages/recipes/index'
      }
    ])

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
    page.toggleRecipeSelection({
      currentTarget: {
        dataset: {
          recipeId: 'recipe-2'
        }
      }
    })
    page.handlePlanSelectedRecipes()
    page.handlePlanDateChange({
      detail: {
        value: '2026-04-21'
      }
    })

    await page.submitPlanSelection()

    expect(callFunction).toHaveBeenNthCalledWith(3, {
      name: 'api',
      data: {
        action: 'listMealPlans',
        spaceId: 'space-1'
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenNthCalledWith(4, {
      name: 'api',
      data: {
        action: 'updateMealPlan',
        spaceId: 'space-1',
        mealPlanId: 'meal-1',
        plan: {
          planDate: '2026-04-21',
          mealType: 'dinner',
          notes: '',
          recipes: [
            { recipeId: 'recipe-1', recipeNameSnapshot: 'Mapo', servingsOverride: '', notes: '' },
            { recipeId: 'recipe-3', recipeNameSnapshot: 'Noodle', servingsOverride: '', notes: '' },
            { recipeId: 'recipe-2', recipeNameSnapshot: 'Soup', servingsOverride: '', notes: '' }
          ]
        }
      },
      config: undefined
    })
    expect(page.data.showPlanModal).toBe(false)
    expect(page.data.selectedRecipeIds).toEqual([])
    expect(page.data.selectedRecipesCount).toBe(0)
    expect(markNeedsRefreshOnNextShow).toHaveBeenCalledWith('2026-04-21')
    expect(showToast).toHaveBeenCalledWith({
      title: '已加入 2026-04-21',
      icon: 'success'
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

  it('updates recipe categories locally from the category manager without reloading the full recipes page', async () => {
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
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: '家常热菜', recipeCount: 0, deletable: true }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { name: '四季时蔬', recipeCount: 1, deletable: false }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            deleted: true,
            name: '家常热菜'
          }
        }
      })
    const showModal = vi
      .fn()
      .mockResolvedValueOnce({
        confirm: true,
        content: '四季时蔬'
      })
      .mockResolvedValueOnce({
        confirm: true
      })
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      navigateTo: vi.fn(),
      switchTab: vi.fn(),
      showModal,
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
    await page.openCategoryManager()

    page.handleCategoryManagerInput({
      detail: {
        value: '家常热菜'
      }
    })
    await page.submitCategoryManagerCreate()

    expect(callFunction).toHaveBeenCalledTimes(3)
    expect(callFunction).toHaveBeenNthCalledWith(3, {
      name: 'api',
      data: {
        action: 'createRecipeCategory',
        spaceId: 'space-1',
        name: '家常热菜'
      },
      config: undefined
    })
    expect(page.data.categoryManagerItems.map((item) => item.name)).toEqual(['健康时蔬', '饮品酒水', '家常热菜'])
    expect(page.data.categoryManagerInput).toBe('')
    expect(showToast).toHaveBeenCalledWith({
      title: '已添加分类',
      icon: 'success'
    })

    await page.renameCategory({
      currentTarget: {
        dataset: {}
      },
      detail: {
        name: '健康时蔬'
      }
    })

    expect(callFunction).toHaveBeenCalledTimes(4)
    expect(callFunction).toHaveBeenNthCalledWith(4, {
      name: 'api',
      data: {
        action: 'updateRecipeCategory',
        spaceId: 'space-1',
        previousName: '健康时蔬',
        name: '四季时蔬'
      },
      config: undefined
    })
    expect(page.data.items[0]).toEqual(
      expect.objectContaining({
        _id: 'recipe-1',
        category: '四季时蔬',
        categorySummary: '四季时蔬'
      })
    )
    expect(page.data.categoryManagerItems.map((item) => item.name)).toEqual(['四季时蔬', '饮品酒水', '家常热菜'])
    expect(showToast).toHaveBeenCalledWith({
      title: '已更新分类',
      icon: 'success'
    })

    await page.deleteCategory({
      currentTarget: {
        dataset: {}
      },
      detail: {
        name: '家常热菜',
        deletable: true
      }
    })

    expect(callFunction).toHaveBeenCalledTimes(5)
    expect(callFunction).toHaveBeenNthCalledWith(5, {
      name: 'api',
      data: {
        action: 'deleteRecipeCategory',
        spaceId: 'space-1',
        name: '家常热菜'
      },
      config: undefined
    })
    expect(page.data.categoryManagerItems.map((item) => item.name)).toEqual(['四季时蔬', '饮品酒水'])
    expect(showToast).toHaveBeenCalledWith({
      title: '已删除分类',
      icon: 'success'
    })
  })

  it('reorders recipe categories from the category manager and syncs rail order', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { _id: 'recipe-1', name: 'Mapo', category: '健康时蔬' },
              { _id: 'recipe-2', name: 'Tea', category: '饮品酒水' }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: '健康时蔬', recipeCount: 1, deletable: false },
              { name: '饮品酒水', recipeCount: 1, deletable: false }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: '饮品酒水', recipeCount: 1, deletable: false },
              { name: '健康时蔬', recipeCount: 1, deletable: false }
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

    page.handleCategoryManagerDragStart({
      detail: {
        index: 0,
        touches: [{ pageY: 0 }]
      }
    })
    expect(page.data.categoryManagerDraggingIndex).toBe(0)

    page.handleCategoryManagerDragMove({
      detail: {
        touches: [{ pageY: 80 }]
      }
    })
    expect(page.data.categoryManagerItems.map((item) => item.name)).toEqual(['饮品酒水', '健康时蔬'])
    expect(page.data.categoryManagerDraggingIndex).toBe(1)

    await page.handleCategoryManagerDragEnd()

    expect(callFunction).toHaveBeenNthCalledWith(3, {
      name: 'api',
      data: {
        action: 'reorderRecipeCategories',
        spaceId: 'space-1',
        names: ['饮品酒水', '健康时蔬']
      },
      config: undefined
    })
    expect(page.data.sectionOptions).toEqual([
      { key: 'all', label: '全部' },
      { key: '饮品酒水', label: '饮品酒水' },
      { key: '健康时蔬', label: '健康时蔬' }
    ])
    expect(page.data.sectionViewItems.map((item) => item.label)).toEqual(['全部', '饮品酒水', '健康时蔬'])
    expect(page.data.categoryManagerDraggingIndex).toBe(-1)
  })
})
