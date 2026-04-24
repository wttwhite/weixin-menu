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

describe('recipe detail page flow', () => {
  it('maps cover image and previews the gallery in wx.previewImage', async () => {
    const previewImage = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              item: {
                _id: 'recipe-1',
                name: 'Mapo',
                coverImageId: 'img-2',
                images: [
                  { _id: 'img-1', fileId: 'cloud://gallery-1', imageRole: 'gallery' },
                  { _id: 'img-2', fileId: 'cloud://cover', imageRole: 'cover' },
                  { _id: 'img-3', localPath: '/tmp/local-gallery.jpg', imageRole: 'gallery' }
                ]
              }
            }
          }
        })
      },
      previewImage,
      navigateBack: vi.fn(),
      navigateTo: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1' })
    page.onShow()
    await flushAsyncWork()

    expect(page.data.coverImageUrl).toBe('cloud://cover')
    expect(page.data.galleryImageUrls).toEqual([
      'cloud://gallery-1',
      'cloud://cover',
      '/tmp/local-gallery.jpg'
    ])

    page.previewImage({
      currentTarget: {
        dataset: {
          current: '/tmp/local-gallery.jpg'
        }
      }
    })

    expect(previewImage).toHaveBeenCalledWith({
      current: '/tmp/local-gallery.jpg',
      urls: ['cloud://gallery-1', 'cloud://cover', '/tmp/local-gallery.jpg']
    })
  })

  it('falls back to a default hero food image when the recipe has no uploaded images', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              item: {
                _id: 'recipe-1',
                name: 'Mapo',
                images: []
              }
            }
          }
        })
      },
      previewImage: vi.fn(),
      navigateBack: vi.fn(),
      navigateTo: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1' })
    page.onShow()
    await flushAsyncWork()

    expect(page.data.coverImageUrl).toBe('/images/food-hero-table.svg')
    expect(page.data.galleryImageUrls).toEqual([])
    expect(page.data.hasGalleryItems).toBe(false)
  })

  it('closes back to meal plans when opened from plans without relying on stack history', async () => {
    const navigateBack = vi.fn()
    const switchTab = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              item: {
                _id: 'recipe-1',
                name: 'Mapo',
                images: []
              }
            }
          }
        })
      },
      previewImage: vi.fn(),
      navigateBack,
      switchTab,
      navigateTo: vi.fn()
    }
    global.getCurrentPages = () => [
      {
        route: 'pages/recipe-detail/index'
      }
    ]
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1', from: 'plans' })
    await page.goBack()

    expect(navigateBack).not.toHaveBeenCalled()
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/meal-plans/index'
    })
  })

  it('shares the current recipe detail path', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      previewImage: vi.fn(),
      navigateBack: vi.fn(),
      switchTab: vi.fn(),
      navigateTo: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1' })

    expect(page.onShareAppMessage()).toEqual({
      title: '分享菜谱',
      path: '/pages/recipe-detail/index?recipeId=recipe-1'
    })
  })

  it('does not refetch recipe detail on repeated onShow when the page already has current data', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          item: {
            _id: 'recipe-1',
            name: 'Mapo',
            images: []
          }
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
      previewImage: vi.fn(),
      navigateBack: vi.fn(),
      navigateTo: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1' })
    page.onShow()
    await flushAsyncWork()
    page.onShow()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(1)
  })

  it('refreshes detail after navigating to edit and returning to the page', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          item: {
            _id: 'recipe-1',
            name: 'Mapo',
            images: []
          }
        }
      }
    })
    const navigateTo = vi.fn()
    global.wx = {
      cloud: { callFunction },
      previewImage: vi.fn(),
      navigateBack: vi.fn(),
      navigateTo
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1' })
    page.onShow()
    await flushAsyncWork()

    page.goEdit()
    page.onShow()
    await flushAsyncWork()

    expect(navigateTo).toHaveBeenCalledWith({
      url: '/pages/recipe-edit/index?recipeId=recipe-1'
    })
    expect(callFunction).toHaveBeenCalledTimes(2)
  })

  it('marks the recipes page for refresh after deleting a recipe from detail view', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'recipe-1',
              name: 'Mapo',
              images: []
            }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            recipeId: 'recipe-1',
            deleted: true
          }
        }
      })
    const markNeedsRefreshOnNextShow = vi.fn()
    global.wx = {
      cloud: { callFunction },
      previewImage: vi.fn(),
      navigateBack: vi.fn(),
      navigateTo: vi.fn(),
      showModal: vi.fn().mockResolvedValue({ confirm: true }),
      showToast: vi.fn()
    }
    global.getCurrentPages = () => [
      {
        route: 'pages/recipes/index',
        markNeedsRefreshOnNextShow
      },
      {
        route: 'pages/recipe-detail/index'
      }
    ]
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-detail/index.js')
    page.onLoad({ recipeId: 'recipe-1' })
    page.onShow()
    await flushAsyncWork()

    await page.removeRecipe()

    expect(markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
  })
})
