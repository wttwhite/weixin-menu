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

describe('recipe edit page flow', () => {
  it('keeps recommendationScore in editor state by default', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn()
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

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    expect(Object.prototype.hasOwnProperty.call(page.data.form, 'recommendationScore')).toBe(true)
  })

  it('does not re-bootstrap and wipe dirty form edits on hide/show cycle', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'tag-1', name: '家常', color: '#E6A23C' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'recipe-1',
              name: 'Mapo Tofu',
              tagIds: ['tag-1'],
              ingredients: [{ name: 'Tofu' }],
              steps: [{ content: 'Cook' }]
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
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({ recipeId: 'recipe-1' })
    page.onShow()
    await waitUntilLoaded(page)

    page.setData({
      form: {
        ...page.data.form,
        name: 'Local Draft Name'
      }
    })
    expect(page.data.form.name).toBe('Local Draft Name')

    page.onShow()
    await flushAsyncWork()

    expect(page.data.form.name).toBe('Local Draft Name')
    expect(callFunction).toHaveBeenCalledTimes(2)
  })
})
