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
      const nextState = { ...this.data }
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

function createCallFunctionMock() {
  return vi.fn().mockImplementation(({ name, data }) => {
    if (name === 'memberOps' && data.action === 'bootstrap') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            openid: 'owner-1',
            activeSpaceId: 'space-1',
            role: 'owner',
            spaces: [
              {
                spaceId: 'space-1',
                name: '家庭厨房',
                role: 'owner',
                inviteCode: 'ABCD12'
              }
            ]
          }
        }
      })
    }

    if (name === 'memberOps' && data.action === 'listMembers') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            members: [
              { openid: 'owner-1', role: 'owner', status: 'active', displayName: '主理人' },
              { openid: 'member-1', role: 'member', status: 'active', displayName: '帮厨' }
            ]
          }
        }
      })
    }

    if (name === 'memberOps' && data.action === 'updateMemberDisplayName') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            spaceId: data.spaceId,
            memberOpenid: data.memberOpenid,
            displayName: data.displayName
          }
        }
      })
    }

    if (name === 'memberOps' && data.action === 'renameSpace') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            spaceId: data.spaceId,
            name: data.name
          }
        }
      })
    }

    if (name === 'api' && data.action === 'getStatisticsDashboard') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            recipeCount: 12,
            pantryCount: 20,
            upcomingExpirations: 3,
            shoppingProgress: { total: 5, checked: 2, percent: 40 },
            memberCount: 2,
            recentBackup: { status: 'available', updatedAt: '2026-04-21 10:00' }
          }
        }
      })
    }

    if (name === 'api' && data.action === 'listRecipeCategories') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            items: [
              { name: '家常菜', recipeCount: 4, deletable: false },
              { name: '饮品', recipeCount: 0, deletable: true }
            ]
          }
        }
      })
    }

    if (name === 'api' && data.action === 'listPantryCategories') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            items: [
              { name: '蔬菜', pantryItemCount: 3, deletable: false },
              { name: '零食', pantryItemCount: 0, deletable: true }
            ]
          }
        }
      })
    }

    if (name === 'api' && data.action === 'listPantryLocations') {
      return Promise.resolve({
        result: {
          code: 0,
          data: {
            items: [
              { name: '冷藏', pantryItemCount: 6, deletable: false },
              { name: '橱柜', pantryItemCount: 0, deletable: true }
            ]
          }
        }
      })
    }

    return Promise.resolve({
      result: {
        code: 0,
        data: {}
      }
    })
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Page
  delete global.wx
  delete global.getApp
})

describe('profile page flow', () => {
  it('loads current space summary, current display name, and owner-only actions', async () => {
    const callFunction = createCallFunctionMock()
    global.wx = {
      cloud: { callFunction },
      navigateTo: vi.fn(),
      setClipboardData: vi.fn(),
      showToast: vi.fn(),
      showModal: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1',
        themeKey: 'default',
        themeStyle: '--page-bg: #f5f1e8;'
      },
      setActiveSpaceId: vi.fn(),
      setTheme: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/profile/index.js')
    await page.onShow()
    await flushAsyncWork()

    expect(page.data.currentDisplayName).toBe('主理人')
    expect(page.data.activeSpaceName).toBe('家庭厨房')
    expect(page.data.roleLabel).toBe('创建者')
    expect(page.data.inviteCode).toBe('ABCD12')
    expect(page.data.memberCountText).toBe('2')
    expect(page.data.recipeCountText).toBe('12')
    expect(page.data.canRenameSpace).toBe(true)
  })

  it('updates the current member display name through memberOps', async () => {
    const callFunction = createCallFunctionMock()
    const showToast = vi.fn()
    const showModal = vi.fn().mockResolvedValue({
      confirm: true,
      content: '新的昵称'
    })
    global.wx = {
      cloud: { callFunction },
      navigateTo: vi.fn(),
      setClipboardData: vi.fn(),
      showToast,
      showModal,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1',
        themeKey: 'default',
        themeStyle: '--page-bg: #f5f1e8;'
      },
      setActiveSpaceId: vi.fn(),
      setTheme: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/profile/index.js')
    page.setData({
      activeSpaceId: 'space-1',
      currentOpenid: 'owner-1',
      currentDisplayName: '主理人'
    })
    await page.handleEditDisplayName()

    expect(showModal).toHaveBeenCalled()
    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: {
        action: 'updateMemberDisplayName',
        spaceId: 'space-1',
        memberOpenid: 'owner-1',
        displayName: '新的昵称'
      },
      config: undefined
    })
    expect(page.data.currentDisplayName).toBe('新的昵称')
    expect(showToast).toHaveBeenCalledWith({
      title: '昵称已更新',
      icon: 'success'
    })
  })

  it('renames the active space locally after save without reloading the full profile', async () => {
    const callFunction = createCallFunctionMock()
    const showToast = vi.fn()
    const showModal = vi.fn().mockResolvedValue({
      confirm: true,
      content: '新的家庭厨房'
    })
    global.wx = {
      cloud: { callFunction },
      navigateTo: vi.fn(),
      setClipboardData: vi.fn(),
      showToast,
      showModal,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1',
        themeKey: 'default',
        themeStyle: '--page-bg: #f5f1e8;'
      },
      setActiveSpaceId: vi.fn(),
      setTheme: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/profile/index.js')
    page.setData({
      activeSpaceId: 'space-1',
      activeSpaceName: '家庭厨房',
      canRenameSpace: true
    })

    await page.handleRenameSpace()

    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: {
        action: 'renameSpace',
        spaceId: 'space-1',
        name: '新的家庭厨房'
      },
      config: undefined
    })
    expect(page.data.activeSpaceName).toBe('新的家庭厨房')
    expect(showToast).toHaveBeenCalledWith({
      title: '空间名已更新',
      icon: 'success'
    })
  })

  it('opens manager modals, theme modal, and navigates to nested pages', async () => {
    const callFunction = createCallFunctionMock()
    const navigateTo = vi.fn()
    global.wx = {
      cloud: { callFunction },
      navigateTo,
      setClipboardData: vi.fn(),
      showToast: vi.fn(),
      showModal: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1',
        themeKey: 'default',
        themeStyle: '--page-bg: #f5f1e8;'
      },
      setActiveSpaceId: vi.fn(),
      setTheme: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/profile/index.js')
    page.setData({ activeSpaceId: 'space-1' })

    await page.openRecipeCategoryManager()
    expect(page.data.showManagerModal).toBe(true)
    expect(page.data.managerMode).toBe('recipe-category')
    expect(page.data.managerItems).toHaveLength(2)

    await page.openPantryLocationManager()
    expect(page.data.managerMode).toBe('pantry-location')
    expect(page.data.managerItems[0].name).toBe('冷藏')

    page.openThemeModal()
    expect(page.data.showThemeModal).toBe(true)

    page.openMembers()
    page.openBackup()
    page.openStatistics()

    expect(navigateTo).toHaveBeenNthCalledWith(1, {
      url: '/pages/space-members/index'
    })
    expect(navigateTo).toHaveBeenNthCalledWith(2, {
      url: '/pages/backup/index'
    })
    expect(navigateTo).toHaveBeenNthCalledWith(3, {
      url: '/pages/statistics/index'
    })
  })
})
