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
    if (!page.data.loading && !page.data.isBootstrapping) {
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
  delete global.getCurrentPages
})

describe('recipe edit page flow', () => {
  it('sets navigation title by mode on load', async () => {
    const setNavigationBarTitle = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      setNavigationBarTitle,
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const createPage = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    createPage.onLoad({})
    expect(setNavigationBarTitle).toHaveBeenNthCalledWith(1, {
      title: '新增菜谱'
    })

    vi.resetModules()
    delete global.Page
    const editPage = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    editPage.onLoad({ recipeId: 'recipe-1' })
    expect(setNavigationBarTitle).toHaveBeenNthCalledWith(2, {
      title: '编辑菜谱'
    })
  })

  it('marks the previous recipes page to skip one onShow reload when entering create mode', async () => {
    const suppressNextOnShowReload = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      setNavigationBarTitle: vi.fn(),
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })
    global.getCurrentPages = () => ([
      {
        route: 'pages/recipes/index',
        suppressNextOnShowReload
      },
      {
        route: 'pages/recipe-edit/index'
      }
    ])

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({})

    expect(suppressNextOnShowReload).toHaveBeenCalledTimes(1)
  })

  it('syncs theme state on show so the editor can use runtime theme variables', async () => {
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
        activeSpaceId: 'space-1',
        themeKey: 'fresh-green',
        themeStyle: '--page-bg: #eef7ef; --brand: #56a36c;'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({})
    await page.onShow()
    await flushAsyncWork()

    expect(page.data.themeKey).toBe('fresh-green')
    expect(page.data.themeStyle).toContain('--page-bg')
    expect(page.data.themeStyle).toContain('#56a36c')
  })

  it('opens create mode without blocking on the loading card while metadata bootstraps in background', async () => {
    let resolveTags
    let resolveCategories
    const callFunction = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveTags = resolve
      }))
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveCategories = resolve
      }))
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
    page.onLoad({})
    const onShowPromise = page.onShow()

    expect(page.data.loading).toBe(false)
    expect(page.data.activeSpaceId).toBe('space-1')
    expect(page.data.isBootstrapping).toBe(true)

    resolveTags({
      result: {
        code: 0,
        data: {
          items: []
        }
      }
    })
    resolveCategories({
      result: {
        code: 0,
        data: {
          items: []
        }
      }
    })

    await onShowPromise
    await waitUntilLoaded(page)

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.loading).toBe(false)
  })

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

  it('loads recipe categories for selector and updates form state when selecting category, duration, and recommendation', async () => {
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
            items: [
              { name: '健康时蔬', recipeCount: 2 },
              { name: '美味汤羹', recipeCount: 1 }
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

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({})
    page.onShow()
    await waitUntilLoaded(page)

    expect(page.data.categoryOptions).toEqual(['请选择菜谱分类', '健康时蔬', '美味汤羹'])

    page.openCategorySelector()
    expect(page.data.showCategorySelector).toBe(true)

    page.handleCategoryOptionTap({
      currentTarget: {
        dataset: {
          name: '美味汤羹'
        }
      }
    })
    expect(page.data.form.category).toBe('美味汤羹')
    expect(page.data.showCategorySelector).toBe(false)

    page.handleCookTimeOptionTap({
      currentTarget: {
        dataset: {
          value: '30'
        }
      }
    })
    expect(page.data.form.cookTimeMinutes).toBe('30')

    page.handleRecommendationTap({
      currentTarget: {
        dataset: {
          value: 4
        }
      }
    })
    expect(page.data.form.recommendationScore).toBe(4)
  })

  it('prefills create form category from recipes page query param', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: []
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              { name: '健康时蔬', recipeCount: 2 },
              { name: '美味汤羹', recipeCount: 1 }
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

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({ category: '美味汤羹' })
    page.onShow()
    await waitUntilLoaded(page)

    expect(page.data.form.category).toBe('美味汤羹')
    expect(page.data.selectedCategoryLabel).toBe('美味汤羹')
    expect(page.data.selectedCategoryIndex).toBe(2)
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
            items: [{ name: '家常热菜', recipeCount: 1 }]
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
    expect(callFunction).toHaveBeenCalledTimes(3)
  })

  it('filters stale tagIds when bootstrapping existing recipe into edit form', async () => {
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
            items: [{ name: '家常热菜', recipeCount: 1 }]
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
              tagIds: ['tag-1', 'tag-stale'],
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

    expect(page.data.form.tagIds).toEqual(['tag-1'])
    expect(page.data.tagViewItems).toEqual([
      expect.objectContaining({
        _id: 'tag-1',
        selected: true
      })
    ])
  })

  it('retries bootstrap on next onShow after initial load failure', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 500,
          message: 'server error',
          data: null
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: []
          }
        }
      })
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
            items: [{ name: '家常热菜', recipeCount: 1 }]
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
    page.onLoad({})
    page.onShow()
    await waitUntilLoaded(page)

    expect(page.data.loadErrorMessage).toBe('server error')
    expect(page.data.availableTags).toEqual([])

    page.onShow()
    await waitUntilLoaded(page)

    expect(callFunction).toHaveBeenCalledTimes(4)
    expect(page.data.loadErrorMessage).toBe('')
    expect(page.data.availableTags).toEqual([
      expect.objectContaining({
        _id: 'tag-1'
      })
    ])
  })

  it('retries bootstrap when activeSpaceId was initially missing and later becomes available', async () => {
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
            items: [{ name: '家常热菜', recipeCount: 1 }]
          }
        }
      })
    const globalData = {
      activeSpaceId: ''
    }
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({})
    page.onShow()
    await waitUntilLoaded(page)

    expect(callFunction).not.toHaveBeenCalled()
    expect(page.data.activeSpaceId).toBe('')

    globalData.activeSpaceId = 'space-1'
    page.onShow()
    await waitUntilLoaded(page)

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.activeSpaceId).toBe('space-1')
    expect(page.data.loadErrorMessage).toBe('')
  })

  it('re-bootstraps and resets local draft when active space changes', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'tag-1', name: '旧空间标签', color: '#E6A23C' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '旧分类', recipeCount: 1 }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'tag-2', name: '新空间标签', color: '#67C23A' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '新分类', recipeCount: 1 }]
          }
        }
      })
    const globalData = {
      activeSpaceId: 'space-1'
    }
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.onLoad({})
    page.onShow()
    await waitUntilLoaded(page)

    page.setData({
      form: {
        ...page.data.form,
        name: 'Local Draft Name'
      }
    })
    expect(page.data.form.name).toBe('Local Draft Name')

    globalData.activeSpaceId = 'space-2'
    page.onShow()
    await waitUntilLoaded(page)

    expect(callFunction).toHaveBeenCalledTimes(4)
    expect(page.data.activeSpaceId).toBe('space-2')
    expect(page.data.form.name).toBe('')
    expect(page.data.availableTags).toEqual([
      expect.objectContaining({
        _id: 'tag-2'
      })
    ])
  })

  it('auto-discards uploaded file when user removed pending image before upload completed', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          imageId: 'img-1',
          discarded: true
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
    page.setData({
      activeSpaceId: 'space-1',
      form: {
        ...page.data.form,
        images: [
          {
            _id: 'local-1',
            imageRole: 'cover',
            uploadStatus: 'uploading',
            localPath: '/tmp/cover.jpg'
          }
        ]
      }
    })

    await page.handleImageRemove({
      detail: {
        imageId: 'local-1'
      }
    })
    expect(page.data.form.images).toEqual([])

    await page.handleImageUploaded({
      detail: {
        localId: 'local-1',
        item: {
          _id: 'img-1',
          imageRole: 'cover',
          uploadStatus: 'confirmed',
          fileId: 'cloud://img-1'
        }
      }
    })

    expect(callFunction).toHaveBeenCalledWith({
      name: 'fileOps',
      data: {
        action: 'discardRecipeImage',
        spaceId: 'space-1',
        imageId: 'img-1'
      },
      config: undefined
    })
    expect(page.data.form.images).toEqual([])
  })

  it('blocks submit while there are uploading images so placeholders are not persisted', async () => {
    const callFunction = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      activeSpaceId: 'space-1',
      loading: false,
      loadErrorMessage: '',
      form: {
        ...page.data.form,
        name: 'Mapo Tofu',
        images: [
          {
            _id: 'local-1',
            imageRole: 'cover',
            uploadStatus: 'uploading',
            localPath: '/tmp/cover.jpg'
          }
        ]
      }
    })

    await page.submit()

    expect(showToast).toHaveBeenCalledWith({
      title: '图片仍在上传，请稍候再保存',
      icon: 'none'
    })
    expect(callFunction).not.toHaveBeenCalled()
  })

  it('does not block create-mode submit when background metadata loading has failed', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          item: {
            _id: 'recipe-new',
            name: '番茄炒蛋'
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
    page.setData({
      activeSpaceId: 'space-1',
      loading: false,
      loadErrorMessage: 'metadata failed',
      isEdit: false,
      form: {
        ...page.data.form,
        name: '番茄炒蛋',
        ingredients: [{ name: '番茄' }],
        steps: [{ content: '翻炒' }],
        images: []
      }
    })

    await page.submit()

    expect(callFunction).toHaveBeenCalled()
  })

  it('queues created recipe onto the previous recipes page before navigating back', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          item: {
            _id: 'recipe-new',
            name: '番茄菌菇汤',
            category: '美味汤羹',
            servings: '2',
            prepTimeMinutes: '10',
            cookTimeMinutes: '20',
            ingredients: [{ name: '番茄' }],
            steps: [{ content: '炖煮' }]
          }
        }
      }
    })
    const showToast = vi.fn()
    const navigateBack = vi.fn()
    const queueCreatedRecipe = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateBack,
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })
    global.getCurrentPages = () => [
      {
        route: 'pages/recipes/index',
        queueCreatedRecipe
      },
      {
        route: 'pages/recipe-edit/index'
      }
    ]

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      activeSpaceId: 'space-1',
      loading: false,
      loadErrorMessage: '',
      isEdit: false,
      form: {
        ...page.data.form,
        name: '番茄菌菇汤',
        category: '美味汤羹',
        servings: '2',
        prepTimeMinutes: '10',
        cookTimeMinutes: '20',
        ingredients: [{ name: '番茄' }],
        steps: [{ content: '炖煮' }],
        images: []
      }
    })

    await page.submit()

    expect(queueCreatedRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'recipe-new',
        name: '番茄菌菇汤',
        category: '美味汤羹'
      })
    )
    expect(showToast).toHaveBeenCalledWith({
      title: '已创建菜谱',
      icon: 'success'
    })
    expect(navigateBack).toHaveBeenCalled()
  })

  it('marks the recipes page for refresh after updating an existing recipe', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          item: {
            _id: 'recipe-1',
            name: '更新后的菜谱'
          }
        }
      }
    })
    const markNeedsRefreshOnNextShow = vi.fn()
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
    global.getCurrentPages = () => ([
      {
        route: 'pages/recipes/index',
        markNeedsRefreshOnNextShow
      },
      {
        route: 'pages/recipe-edit/index'
      }
    ])

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      activeSpaceId: 'space-1',
      recipeId: 'recipe-1',
      isEdit: true,
      loading: false,
      loadErrorMessage: '',
      form: {
        ...page.data.form,
        name: '更新后的菜谱',
        images: [],
        ingredients: [{ name: '番茄' }],
        steps: [{ content: '翻炒' }]
      }
    })

    await page.submit()

    expect(markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
  })

  it('create-mode back discards confirmed draft images before navigating away', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          discarded: true
        }
      }
    })
    const navigateBack = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack,
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      isEdit: false,
      activeSpaceId: 'space-1',
      form: {
        ...page.data.form,
        images: [
          {
            _id: 'img-1',
            uploadStatus: 'confirmed',
            imageRole: 'cover',
            fileId: 'cloud://img-1'
          }
        ]
      }
    })

    await page.goBack()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'fileOps',
      data: {
        action: 'discardRecipeImage',
        spaceId: 'space-1',
        imageId: 'img-1'
      },
      config: undefined
    })
    expect(navigateBack).toHaveBeenCalled()
  })

  it('create-mode back is blocked while uploads are in flight', async () => {
    const navigateBack = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      showToast,
      navigateBack,
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      isEdit: false,
      activeSpaceId: 'space-1',
      form: {
        ...page.data.form,
        images: [
          {
            _id: 'local-1',
            uploadStatus: 'uploading',
            imageRole: 'cover'
          }
        ]
      }
    })

    await page.goBack()

    expect(showToast).toHaveBeenCalledWith({
      title: '图片仍在上传，请稍候再退出',
      icon: 'none'
    })
    expect(navigateBack).not.toHaveBeenCalled()
  })

  it('create-mode back surfaces cleanup failure and keeps page for retry', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 500,
        message: 'cleanup failed'
      }
    })
    const navigateBack = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateBack,
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      isEdit: false,
      activeSpaceId: 'space-1',
      form: {
        ...page.data.form,
        images: [
          {
            _id: 'img-1',
            uploadStatus: 'confirmed',
            imageRole: 'cover',
            fileId: 'cloud://img-1'
          }
        ]
      }
    })

    await page.goBack()

    expect(showToast).toHaveBeenCalledWith({
      title: 'cleanup failed',
      icon: 'none'
    })
    expect(navigateBack).not.toHaveBeenCalled()
  })

  it('onUnload in create mode discards confirmed draft images via lifecycle exit path', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          discarded: true
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
    page.setData({
      isEdit: false,
      activeSpaceId: 'space-1',
      form: {
        ...page.data.form,
        images: [
          {
            _id: 'img-on-unload',
            uploadStatus: 'confirmed',
            imageRole: 'cover',
            fileId: 'cloud://img-on-unload'
          }
        ]
      }
    })

    await page.onUnload()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'fileOps',
      data: {
        action: 'discardRecipeImage',
        spaceId: 'space-1',
        imageId: 'img-on-unload'
      },
      config: undefined
    })
  })

  it('keeps recoverable discard-failed image when delayed cancel cleanup fails, then allows retry remove', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 500,
          message: 'discard later failed'
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            discarded: true
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
    page.setData({
      activeSpaceId: 'space-1',
      cancelledPendingImageIds: ['local-1'],
      form: {
        ...page.data.form,
        images: []
      }
    })

    await page.handleImageUploaded({
      detail: {
        localId: 'local-1',
        item: {
          _id: 'img-retry',
          imageRole: 'cover',
          uploadStatus: 'confirmed',
          fileId: 'cloud://img-retry'
        }
      }
    })

    expect(page.data.form.images).toEqual([
      expect.objectContaining({
        _id: 'img-retry',
        uploadStatus: 'discard-failed'
      })
    ])

    await page.handleImageRemove({
      detail: {
        imageId: 'img-retry'
      }
    })

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.form.images).toEqual([])
  })

  it('create-mode space switch discards confirmed draft images before reset', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            discarded: true
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ _id: 'tag-new', name: '新空间标签', color: '#67C23A' }]
          }
        }
      })
    const globalData = {
      activeSpaceId: 'space-1'
    }
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      hasBootstrapped: true,
      activeSpaceId: 'space-1',
      loading: false,
      isEdit: false,
      form: {
        ...page.data.form,
        name: 'Draft Recipe',
        images: [
          {
            _id: 'img-switch',
            uploadStatus: 'confirmed',
            imageRole: 'cover',
            fileId: 'cloud://img-switch'
          }
        ]
      }
    })

    globalData.activeSpaceId = 'space-2'
    page.onShow()
    await waitUntilLoaded(page)

    expect(callFunction).toHaveBeenCalledWith({
      name: 'fileOps',
      data: {
        action: 'discardRecipeImage',
        spaceId: 'space-1',
        imageId: 'img-switch'
      },
      config: undefined
    })
    expect(page.data.activeSpaceId).toBe('space-2')
    expect(page.data.form.images).toEqual([])
  })

  it('create-mode space switch keeps current draft when confirmed cleanup fails', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 500,
        message: 'discard failed on switch'
      }
    })
    const showToast = vi.fn()
    const globalData = {
      activeSpaceId: 'space-1'
    }
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateBack: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData
    })

    const page = await loadPage('../../miniprogram/pages/recipe-edit/index.js')
    page.setData({
      hasBootstrapped: true,
      activeSpaceId: 'space-1',
      loading: false,
      isEdit: false,
      form: {
        ...page.data.form,
        name: 'Draft Recipe',
        images: [
          {
            _id: 'img-switch-fail',
            uploadStatus: 'confirmed',
            imageRole: 'cover',
            fileId: 'cloud://img-switch-fail'
          }
        ]
      }
    })

    globalData.activeSpaceId = 'space-2'
    await page.onShow()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(callFunction).toHaveBeenCalledWith({
      name: 'fileOps',
      data: {
        action: 'discardRecipeImage',
        spaceId: 'space-1',
        imageId: 'img-switch-fail'
      },
      config: undefined
    })
    expect(showToast).toHaveBeenCalledWith({
      title: 'discard failed on switch',
      icon: 'none'
    })
    expect(page.data.activeSpaceId).toBe('space-1')
    expect(page.data.form.name).toBe('Draft Recipe')
    expect(page.data.form.images).toEqual([
      expect.objectContaining({
        _id: 'img-switch-fail'
      })
    ])
  })
})
