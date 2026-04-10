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

describe('pantry edit page flow', () => {
  it('loads edit item via getPantryItem action', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          item: {
            _id: 'pantry-1',
            name: 'Milk',
            category: 'dairy',
            quantity: '1',
            unit: 'box',
            location: 'fridge',
            expirationDate: '2026-04-20',
            notes: 'test'
          }
        }
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({ pantryItemId: 'pantry-1' })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'getPantryItem',
        spaceId: 'space-1',
        pantryItemId: 'pantry-1'
      },
      config: undefined
    })
    expect(page.data.form.name).toBe('Milk')
    expect(page.data.loadErrorMessage).toBe('')
  })

  it('blocks edit actions after item load failure', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 404,
        message: 'Pantry item not found',
        data: null
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({ pantryItemId: 'pantry-1' })
    await flushAsyncWork()

    expect(page.data.loadErrorMessage).toBe('没有找到对应的数据')
    await page.submit()
    await page.removeItem()
    expect(callFunction).toHaveBeenCalledTimes(1)
  })
})
