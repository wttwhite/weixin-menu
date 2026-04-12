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
