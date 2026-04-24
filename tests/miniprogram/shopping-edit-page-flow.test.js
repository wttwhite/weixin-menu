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

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Page
  delete global.wx
  delete global.getApp
  delete global.getCurrentPages
})

describe('shopping edit page flow', () => {
  it('marks the shopping page for refresh after a successful submit', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {}
      }
    })
    const markNeedsRefreshOnNextShow = vi.fn()
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateBack: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })
    global.getCurrentPages = () => ([
      {
        route: 'pages/shopping/index',
        markNeedsRefreshOnNextShow
      },
      {
        route: 'pages/shopping-edit/index'
      }
    ])

    const page = await loadPage('../../miniprogram/pages/shopping-edit/index.js')
    page.setData({
      activeSpaceId: 'space-1',
      shoppingListId: 'list-1',
      shoppingItemId: 'item-1',
      shoppingListUpdatedAt: 'list-updated-at',
      shoppingItemUpdatedAt: 'item-updated-at',
      isEdit: true,
      form: {
        name: '豆瓣酱',
        quantity: '1',
        unit: '瓶',
        notes: ''
      }
    })

    await page.submit()

    expect(markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
  })
})
