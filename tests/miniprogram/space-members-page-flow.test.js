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

describe('space-members page flow', () => {
  it('lets owners edit another member display name and keeps fallback labels', async () => {
    const callFunction = vi.fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            openid: 'owner-1',
            activeSpaceId: 'space-1',
            role: 'owner',
            spaces: [{ spaceId: 'space-1', name: '家庭厨房', role: 'owner', inviteCode: 'ABCD12' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            members: [
              { openid: 'owner-1', role: 'owner', status: 'active', displayName: '主理人' },
              { openid: 'member-1', role: 'member', status: 'active', name: '帮厨原名' }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            spaceId: 'space-1',
            memberOpenid: 'member-1',
            displayName: '新称呼'
          }
        }
      })
    const showToast = vi.fn()
    const showModal = vi.fn().mockResolvedValue({
      confirm: true,
      content: '新称呼'
    })
    global.wx = {
      cloud: { callFunction },
      showToast,
      showModal,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      },
      setActiveSpaceId: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/space-members/index.js')
    await page.loadMembers()

    expect(page.data.members[1].name).toBe('帮厨原名')
    await page.handleEditMember({
      currentTarget: {
        dataset: {
          memberOpenid: 'member-1',
          name: '帮厨原名'
        }
      }
    })

    expect(showModal).toHaveBeenCalled()
    expect(callFunction).toHaveBeenCalledTimes(3)
    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: {
        action: 'updateMemberDisplayName',
        spaceId: 'space-1',
        memberOpenid: 'member-1',
        displayName: '新称呼'
      },
      config: undefined
    })
    expect(page.data.members[1]).toEqual(
      expect.objectContaining({
        openid: 'member-1',
        name: '新称呼'
      })
    )
    expect(showToast).toHaveBeenCalledWith({
      title: '成员昵称已更新',
      icon: 'success'
    })
  })

  it('removes a member locally after confirmation without reloading the full member list', async () => {
    const callFunction = vi.fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            openid: 'owner-1',
            activeSpaceId: 'space-1',
            role: 'owner',
            spaces: [{ spaceId: 'space-1', name: '家庭厨房', role: 'owner', inviteCode: 'ABCD12' }]
          }
        }
      })
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            spaceId: 'space-1',
            memberOpenid: 'member-1',
            removed: true
          }
        }
      })
    const showToast = vi.fn()
    const showModal = vi.fn().mockResolvedValue({
      confirm: true
    })
    global.wx = {
      cloud: { callFunction },
      showToast,
      showModal,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      },
      setActiveSpaceId: vi.fn()
    })

    const page = await loadPage('../../miniprogram/pages/space-members/index.js')
    await page.loadMembers()

    await page.handleRemoveMember({
      currentTarget: {
        dataset: {
          memberOpenid: 'member-1'
        }
      }
    })

    expect(showModal).toHaveBeenCalled()
    expect(callFunction).toHaveBeenCalledTimes(3)
    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: {
        action: 'removeMember',
        spaceId: 'space-1',
        memberOpenid: 'member-1'
      },
      config: undefined
    })
    expect(page.data.members).toHaveLength(1)
    expect(page.data.members[0].openid).toBe('owner-1')
    expect(showToast).toHaveBeenCalledWith({
      title: '成员已移除',
      icon: 'success'
    })
  })
})
