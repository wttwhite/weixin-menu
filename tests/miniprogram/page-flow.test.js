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
})

describe('boot page flow', () => {
  it('switches to recipes tab after bootstrap finds an active space', async () => {
    const switchTab = vi.fn()
    const setActiveSpaceId = vi.fn()
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          openid: 'user-1',
          spaces: [{ spaceId: 'space-1', name: 'Family', role: 'owner', status: 'active' }],
          activeSpaceId: 'space-1',
          role: 'owner'
        }
      }
    })

    global.wx = {
      cloud: {
        callFunction
      },
      switchTab,
      redirectTo: vi.fn(),
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn()
    }
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/boot/index.js')
    await page.runBootstrap()

    expect(setActiveSpaceId).toHaveBeenCalledWith('space-1')
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
  })

  it('shows a clean error message when cloud capability is unavailable', async () => {
    global.wx = {}
    global.getApp = () => ({
      setActiveSpaceId: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/boot/index.js')
    await page.runBootstrap()

    expect(page.data.loading).toBe(false)
    expect(page.data.title).toBe('进入应用失败')
    expect(page.data.detail).toBe('当前微信版本不支持云函数调用，请升级微信后重试')
  })

  it('offers one-click collection initialization when bootstrap fails because collections are missing', async () => {
    const redirectTo = vi.fn()
    const switchTab = vi.fn()
    const showToast = vi.fn()
    const setActiveSpaceId = vi.fn()
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 1,
          message: 'Db or Table not exist: space_members',
          data: null
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            created: ['spaces', 'space_members'],
            existing: ['recipes']
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            openid: 'user-1',
            spaces: [],
            activeSpaceId: null,
            role: null
          }
        }
      })

    global.wx = {
      cloud: {
        callFunction
      },
      redirectTo,
      switchTab,
      showToast,
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn()
    }
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/boot/index.js')
    await page.runBootstrap()

    expect(page.data.loading).toBe(false)
    expect(page.data.canInitCollections).toBe(true)
    expect(page.data.detail).toBe('云数据库缺少必要集合，可点击下方按钮自动初始化')

    await page.handleInitCollections()

    expect(callFunction).toHaveBeenNthCalledWith(1, {
      name: 'memberOps',
      data: {
        action: 'bootstrap',
        preferredSpaceId: ''
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenNthCalledWith(2, {
      name: 'memberOps',
      data: {
        action: 'initCollections'
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenNthCalledWith(3, {
      name: 'memberOps',
      data: {
        action: 'bootstrap',
        preferredSpaceId: ''
      },
      config: undefined
    })
    expect(showToast).toHaveBeenCalledWith({
      title: '云数据库初始化完成',
      icon: 'success'
    })
    expect(setActiveSpaceId).toHaveBeenCalledWith('')
    expect(redirectTo).toHaveBeenCalledWith({
      url: '/pages/space/index'
    })
    expect(switchTab).not.toHaveBeenCalled()
  })
})

describe('navigation stack safety', () => {
  it('switches to recipes tab after switching space', async () => {
    const switchTab = vi.fn()
    const redirectTo = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      switchTab,
      redirectTo,
      showToast: vi.fn(),
      navigateTo: vi.fn()
    }
    const setActiveSpaceId = vi.fn()
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/space/index.js')
    page.data.activeSpaceId = 'space-1'
    await page.handleSwitchSpace({
      currentTarget: {
        dataset: {
          spaceId: 'space-2'
        }
      }
    })

    expect(setActiveSpaceId).toHaveBeenCalledWith('space-2')
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('switches to recipes tab after creating a space', async () => {
    const switchTab = vi.fn()
    const redirectTo = vi.fn()
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          activeSpaceId: 'space-3'
        }
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      switchTab,
      redirectTo,
      showToast: vi.fn()
    }
    const setActiveSpaceId = vi.fn()
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/space-create/index.js')
    page.data.name = 'Family'
    await page.submit()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: {
        action: 'createSpace',
        name: 'Family'
      },
      config: undefined
    })
    expect(setActiveSpaceId).toHaveBeenCalledWith('space-3')
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('does not call backend when creating space with blank name', async () => {
    const switchTab = vi.fn()
    const redirectTo = vi.fn()
    const callFunction = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      switchTab,
      redirectTo,
      showToast
    }
    const setActiveSpaceId = vi.fn()
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/space-create/index.js')
    page.data.name = '   '
    await page.submit()

    expect(showToast).toHaveBeenCalledWith({
      title: '请输入空间名称',
      icon: 'none'
    })
    expect(callFunction).not.toHaveBeenCalled()
    expect(setActiveSpaceId).not.toHaveBeenCalled()
    expect(switchTab).not.toHaveBeenCalled()
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('switches to recipes tab after joining a space', async () => {
    const switchTab = vi.fn()
    const redirectTo = vi.fn()
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          activeSpaceId: 'space-8'
        }
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      switchTab,
      redirectTo,
      showToast: vi.fn()
    }
    const setActiveSpaceId = vi.fn()
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/space-join/index.js')
    page.data.inviteCode = 'ABCD12'
    await page.submit()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: {
        action: 'joinSpace',
        inviteCode: 'ABCD12'
      },
      config: undefined
    })
    expect(setActiveSpaceId).toHaveBeenCalledWith('space-8')
    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('does not call backend when joining with blank invite code', async () => {
    const switchTab = vi.fn()
    const redirectTo = vi.fn()
    const callFunction = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      switchTab,
      redirectTo,
      showToast
    }
    const setActiveSpaceId = vi.fn()
    global.getApp = () => ({
      setActiveSpaceId
    })

    const page = await loadPage('../../miniprogram/pages/space-join/index.js')
    page.data.inviteCode = '    '
    await page.submit()

    expect(showToast).toHaveBeenCalledWith({
      title: '请输入空间邀请码',
      icon: 'none'
    })
    expect(callFunction).not.toHaveBeenCalled()
    expect(setActiveSpaceId).not.toHaveBeenCalled()
    expect(switchTab).not.toHaveBeenCalled()
    expect(redirectTo).not.toHaveBeenCalled()
  })
})
