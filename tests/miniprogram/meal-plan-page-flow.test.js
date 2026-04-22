import { beforeEach, describe, expect, it, vi } from 'vitest'

function assignByPath(target, path, value) {
  if (!path.includes('.') && !path.includes('[')) {
    target[path] = value
    return
  }

  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)

  let current = target
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]
    if (current[token] === undefined) {
      current[token] = /^\d+$/.test(nextToken) ? [] : {}
    }
    current = current[token]
  }
  current[tokens[tokens.length - 1]] = value
}

function createPageInstance(pageConfig) {
  const instance = {
    data: { ...(pageConfig.data || {}) },
    setData(nextData) {
      const nextState = {
        ...this.data
      }
      Object.entries(nextData).forEach(([key, value]) => {
        assignByPath(nextState, key, value)
      })
      this.data = nextState
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

async function waitUntilLoaded(page) {
  for (let i = 0; i < 20; i += 1) {
    if (!page.data.loading) {
      return
    }
    await flushAsyncWork()
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Page
  delete global.wx
  delete global.getApp
})

describe('meal-plans page flow', () => {
  it('blocks create navigation when no active space is selected', async () => {
    const showToast = vi.fn()
    const navigateTo = vi.fn()
    global.wx = {
      showToast,
      navigateTo
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: ''
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    page.data.activeSpaceId = ''
    page.goCreate()

    expect(showToast).toHaveBeenCalledWith({
      title: '请先选择空间',
      icon: 'none'
    })
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('shows truncation message when the backend reports more plans than the current slice', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            {
              _id: 'meal-1',
              planDate: '2026-04-10',
              mealType: 'dinner',
              recipes: [{ recipeId: 'recipe-1', recipeNameSnapshot: 'A', recipe: { _id: 'recipe-1', name: 'A' } }]
            }
          ],
          total: 120,
          limit: 100,
          hasMore: true
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    await page.loadMealPlans()

    expect(page.data.summary).toBe('已安排 120 条用餐计划。')
    expect(page.data.truncationMessage).toBe('当前仅显示部分计划，请继续缩小范围或等待分页支持。')
  })

  it('builds a month calendar and filters plans by selected day', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            {
              _id: 'meal-1',
              planDate: '2026-04-03',
              mealType: 'dinner',
              recipes: [{ recipeId: 'recipe-1', recipeNameSnapshot: '鸡汤', recipe: { _id: 'recipe-1', name: '鸡汤' } }]
            },
            {
              _id: 'meal-2',
              planDate: '2026-04-11',
              mealType: 'lunch',
              recipes: [{ recipeId: 'recipe-2', recipeNameSnapshot: '炒菠菜', recipe: { _id: 'recipe-2', name: '炒菠菜' } }]
            }
          ]
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    await page.loadMealPlans()

    expect(page.data.calendarItems.some((item) => item.date === '2026-04-03' && item.hasPlans)).toBe(true)
    expect(page.data.calendarItems.some((item) => item.date === '2026-04-11' && item.hasPlans)).toBe(true)

    page.handleCalendarDateSelect({
      currentTarget: {
        dataset: {
          date: '2026-04-03'
        }
      }
    })

    expect(page.data.selectedDate).toBe('2026-04-03')
    expect(page.data.selectedPlans).toHaveLength(1)
    expect(page.data.selectedPlans[0].mealTypeLabel).toBe('晚餐')
  })

  it('defaults to a collapsed calendar week and expands back to the full month on demand', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            {
              _id: 'meal-1',
              planDate: '2026-04-03',
              mealType: 'dinner',
              recipes: [{ recipeId: 'recipe-1', recipeNameSnapshot: '鸡汤', recipe: { _id: 'recipe-1', name: '鸡汤' } }]
            },
            {
              _id: 'meal-2',
              planDate: '2026-04-21',
              mealType: 'lunch',
              recipes: [{ recipeId: 'recipe-2', recipeNameSnapshot: '凉拌黄瓜', recipe: { _id: 'recipe-2', name: '凉拌黄瓜' } }]
            }
          ]
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    await page.loadMealPlans()
    page.syncCalendarView({
      todayIso: '2026-04-21',
      viewMonthKey: '2026-04',
      selectedDate: '2026-04-21'
    })

    expect(page.data.isCalendarExpanded).toBe(false)
    expect(page.data.calendarRowCount).toBe(6)
    expect(page.data.calendarViewportStyle).toContain('height: 88rpx')
    expect(page.data.calendarGridStyle).toContain('translateY(-293rpx)')

    page.toggleCalendarExpanded()

    expect(page.data.isCalendarExpanded).toBe(true)
    expect(page.data.calendarViewportStyle).toContain('height: 578rpx')
    expect(page.data.calendarGridStyle).toContain('translateY(0rpx)')
  })

  it('repositions the collapsed week and flips month when an adjacent-month date is selected', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: []
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    await page.loadMealPlans()
    page.syncCalendarView({
      todayIso: '2026-04-21',
      viewMonthKey: '2026-04',
      selectedDate: '2026-04-21'
    })

    page.handleCalendarDateSelect({
      currentTarget: {
        dataset: {
          date: '2026-04-03'
        }
      }
    })

    expect(page.data.selectedDate).toBe('2026-04-03')
    expect(page.data.calendarGridStyle).toContain('translateY(0rpx)')

    page.handleCalendarDateSelect({
      currentTarget: {
        dataset: {
          date: '2026-05-01'
        }
      }
    })

    expect(page.data.viewMonthKey).toBe('2026-05')
    expect(page.data.selectedDate).toBe('2026-05-01')
  })

  it('opens inventory check modal for the selected day and compares recipe ingredients with pantry stock', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'meal-1',
                planDate: '2026-04-03',
                mealType: 'dinner',
                recipes: [
                  { recipeId: 'recipe-1', recipeNameSnapshot: '鸡汤', recipe: { _id: 'recipe-1', name: '鸡汤' } },
                  { recipeId: 'recipe-2', recipeNameSnapshot: '炒菠菜', recipe: { _id: 'recipe-2', name: '炒菠菜' } }
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
              _id: 'recipe-1',
              name: '鸡汤',
              ingredients: [
                { name: '鸡肉', quantity: '1', unit: '袋' },
                { name: '黑木耳', quantity: '1', unit: '把' }
              ]
            }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'recipe-2',
              name: '炒菠菜',
              ingredients: [{ name: '菠菜', quantity: '1', unit: '份' }]
            }
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
                name: '鸡肉',
                quantity: '1',
                unit: '袋',
                usageStatus: 'normal',
                status: 'fresh'
              }
            ]
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    await page.loadMealPlans()
    page.handleCalendarDateSelect({
      currentTarget: {
        dataset: {
          date: '2026-04-03'
        }
      }
    })
    await page.openInventoryCheck()
    await flushAsyncWork()

    expect(page.data.showInventoryModal).toBe(true)
    expect(page.data.inventorySummary.totalText).toBe('3')
    expect(page.data.inventorySummary.inStockText).toBe('1')
    expect(page.data.inventorySummary.missingText).toBe('2')
    expect(page.data.inventorySelectedKeys).toEqual(
      expect.arrayContaining(['黑木耳__把', '菠菜__份'])
    )
    expect(page.data.inventoryGenerateButtonText).toBe('生成采购清单 (2)')
    expect(page.data.inventoryItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '鸡肉',
          statusText: '有库存',
          selectable: false
        }),
        expect.objectContaining({
          name: '黑木耳',
          statusText: '缺货',
          selectable: true,
          selected: true
        }),
        expect.objectContaining({
          name: '菠菜',
          statusText: '缺货',
          selectable: true,
          selected: true
        })
      ])
    )
  })

  it('toggles missing inventory selections and generates a new shopping list from the checked missing items', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'meal-1',
                planDate: '2026-04-06',
                mealType: 'dinner',
                recipes: [
                  { recipeId: 'recipe-1', recipeNameSnapshot: '番茄蛋花汤', recipe: { _id: 'recipe-1', name: '番茄蛋花汤' } }
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
              _id: 'recipe-1',
              name: '番茄蛋花汤',
              ingredients: [
                { name: '番茄', quantity: '1', unit: '个' },
                { name: '鸡蛋', quantity: '2', unit: '个' }
              ]
            }
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
                name: '番茄',
                quantity: '1',
                unit: '个',
                status: 'fresh'
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
              _id: 'shopping-1',
              name: '2026-04-06 食材补货',
              listDate: '2026-04-06',
              status: 'open',
              notes: '',
              updatedAt: 'list-updated-1'
            }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'shopping-1',
              name: '2026-04-06 食材补货',
              listDate: '2026-04-06',
              status: 'open',
              notes: '',
              updatedAt: 'list-updated-2'
            },
            shoppingItem: {
              _id: 'shopping-item-1',
              name: '鸡蛋'
            }
          }
        }
      })
    const showToast = vi.fn()
    const switchTab = vi.fn()
    global.wx = {
      cloud: { callFunction },
      showToast,
      navigateTo: vi.fn(),
      switchTab,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plans/index.js')
    await page.loadMealPlans()
    page.handleCalendarDateSelect({
      currentTarget: {
        dataset: {
          date: '2026-04-06'
        }
      }
    })
    await page.openInventoryCheck()
    await flushAsyncWork()

    expect(page.data.inventoryGenerateButtonText).toBe('生成采购清单 (1)')

    page.toggleInventorySelection({
      currentTarget: {
        dataset: {
          key: '鸡蛋__个'
        }
      }
    })
    expect(page.data.inventorySelectedKeys).toEqual([])
    expect(page.data.inventoryGenerateButtonText).toBe('生成采购清单 (0)')

    page.toggleInventorySelection({
      currentTarget: {
        dataset: {
          key: '鸡蛋__个'
        }
      }
    })
    expect(page.data.inventorySelectedKeys).toEqual(['鸡蛋__个'])
    expect(page.data.inventoryGenerateButtonText).toBe('生成采购清单 (1)')

    await page.generateShoppingList()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenNthCalledWith(4, {
      name: 'api',
      data: {
        action: 'createShoppingList',
        spaceId: 'space-1',
        shoppingList: {
          name: '2026-04-06 食材补货',
          listDate: '2026-04-06',
          status: 'open',
          notes: ''
        }
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenNthCalledWith(5, {
      name: 'api',
      data: {
        action: 'updateShoppingList',
        spaceId: 'space-1',
        shoppingListId: 'shopping-1',
        shoppingList: {
          name: '2026-04-06 食材补货',
          listDate: '2026-04-06',
          status: 'open',
          notes: '',
          itemDraft: {
            name: '鸡蛋',
            category: '',
            quantity: '2',
            unit: '个',
            isChecked: false,
            sourceType: 'manual',
            notes: '来自 2026-04-06 库存检查'
          }
        },
        expectedUpdatedAt: 'list-updated-1'
      },
      config: undefined
    })
    expect(showToast).toHaveBeenCalledWith({
      title: '采购清单已生成',
      icon: 'success'
    })
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/shopping/index'
    })
  })
})

describe('meal-plan edit page flow', () => {
  it('loads the target plan through getMealPlan and preserves multiple recipes in form state', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'meal-1',
              planDate: '2026-04-10',
              mealType: 'dinner',
              notes: 'group dinner',
              recipes: [
                { recipeId: 'recipe-1', servingsOverride: '2', notes: '', recipe: { _id: 'recipe-1', name: 'A' } },
                { recipeId: 'recipe-2', servingsOverride: '4', notes: '', recipe: { _id: 'recipe-2', name: 'B' } }
              ]
            }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { _id: 'recipe-1', name: 'A' },
              { _id: 'recipe-2', name: 'B' }
            ]
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plan-edit/index.js')
    page.onLoad({ mealPlanId: 'meal-1' })
    page.onShow()
    await waitUntilLoaded(page)

    expect(callFunction).toHaveBeenNthCalledWith(1, {
      name: 'api',
      data: {
        action: 'getMealPlan',
        spaceId: 'space-1',
        mealPlanId: 'meal-1'
      },
      config: undefined
    })
    expect(page.data.form.recipes).toHaveLength(2)
    expect(page.data.form.recipes[1]).toEqual(
      expect.objectContaining({
        recipeId: 'recipe-2',
        servingsOverride: '4'
      })
    )
  })

  it('shows a fallback option for a recipe snapshot that no longer exists in the current library', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'meal-1',
              planDate: '2026-04-10',
              mealType: 'dinner',
              notes: '',
              recipes: [
                { recipeId: 'recipe-missing', recipeNameSnapshot: 'Old Dish', servingsOverride: '2', notes: '' }
              ]
            }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'recipe-1', name: 'A' }]
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plan-edit/index.js')
    page.onLoad({ mealPlanId: 'meal-1' })
    page.onShow()
    await waitUntilLoaded(page)

    expect(page.data.recipeOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'recipe-missing',
          label: 'Old Dish（历史快照）'
        })
      ])
    )
  })

  it('blocks submit when any recipe row is blank or no longer available', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [{ _id: 'recipe-1', name: 'A' }]
        }
      }
    })
    const showToast = vi.fn()
    global.wx = {
      cloud: { callFunction },
      showToast,
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/meal-plan-edit/index.js')
    page.onShow()
    await waitUntilLoaded(page)
    page.setData({
      'form.recipes': [
        { recipeId: 'recipe-1', servingsOverride: '2', notes: '' },
        { recipeId: '', servingsOverride: '1', notes: '' }
      ]
    })

    await page.submit()

    expect(showToast).toHaveBeenCalledWith({
      title: '计划中包含已失效菜谱，请重新选择',
      icon: 'none'
    })
  })
})
