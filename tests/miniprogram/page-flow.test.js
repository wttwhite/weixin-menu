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
})

describe('navigation stack safety', () => {
  it('reLaunches after switching space', async () => {
    const reLaunch = vi.fn()
    const redirectTo = vi.fn()
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      reLaunch,
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
    expect(reLaunch).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('reLaunches after creating a space', async () => {
    const reLaunch = vi.fn()
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
      reLaunch,
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
    expect(reLaunch).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('does not call backend when creating space with blank name', async () => {
    const reLaunch = vi.fn()
    const redirectTo = vi.fn()
    const callFunction = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      reLaunch,
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
    expect(reLaunch).not.toHaveBeenCalled()
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('reLaunches after joining a space', async () => {
    const reLaunch = vi.fn()
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
      reLaunch,
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
    expect(reLaunch).toHaveBeenCalledWith({
      url: '/pages/recipes/index'
    })
    expect(redirectTo).not.toHaveBeenCalled()
  })

  it('does not call backend when joining with blank invite code', async () => {
    const reLaunch = vi.fn()
    const redirectTo = vi.fn()
    const callFunction = vi.fn()
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      reLaunch,
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
    expect(reLaunch).not.toHaveBeenCalled()
    expect(redirectTo).not.toHaveBeenCalled()
  })
})
