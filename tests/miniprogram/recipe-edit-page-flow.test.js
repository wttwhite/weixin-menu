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
            items: [{ _id: 'tag-1', name: '家常', color: '#E6A23C' }]
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

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.loadErrorMessage).toBe('')
    expect(page.data.availableTags).toEqual([
      expect.objectContaining({
        _id: 'tag-1'
      })
    ])
  })

  it('retries bootstrap when activeSpaceId was initially missing and later becomes available', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [{ _id: 'tag-1', name: '家常', color: '#E6A23C' }]
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

    expect(callFunction).toHaveBeenCalledTimes(1)
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
            items: [{ _id: 'tag-2', name: '新空间标签', color: '#67C23A' }]
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

    expect(callFunction).toHaveBeenCalledTimes(2)
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
})
