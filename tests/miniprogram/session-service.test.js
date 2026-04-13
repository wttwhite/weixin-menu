import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrap,
  createSessionService,
  resolveActiveSpaceId
} from '../../miniprogram/services/session'

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('resolveActiveSpaceId', () => {
  it('falls back to the first available space when storage is empty', () => {
    expect(resolveActiveSpaceId('', [{ id: 'space-1' }, { id: 'space-2' }])).toBe('space-1')
  })

  it('keeps the stored space when it is still available', () => {
    expect(resolveActiveSpaceId('space-2', [{ id: 'space-1' }, { id: 'space-2' }])).toBe('space-2')
  })

  it('returns an empty string when there are no spaces', () => {
    expect(resolveActiveSpaceId('space-1', [])).toBe('')
  })
})

describe('bootstrap', () => {
  it('persists the resolved active space from bootstrap data', async () => {
    const setActiveSpaceId = vi.fn()
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaces: [{ id: 'space-1', name: 'Home' }, { id: 'space-2', name: 'Studio' }],
          activeSpaceId: '',
          role: 'owner'
        }
      }
    })

    const result = await bootstrap({
      callCloud,
      getActiveSpaceId: () => '',
      setActiveSpaceId
    })

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'bootstrap',
      preferredSpaceId: ''
    })
    expect(setActiveSpaceId).toHaveBeenCalledWith('space-1')
    expect(result.activeSpaceId).toBe('space-1')
  })

  it('clears stored active space when bootstrap returns no spaces', async () => {
    const clearActiveSpaceId = vi.fn()
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaces: [],
          activeSpaceId: '',
          role: ''
        }
      }
    })

    const result = await bootstrap({
      callCloud,
      getActiveSpaceId: () => 'space-1',
      setActiveSpaceId: vi.fn(),
      clearActiveSpaceId
    })

    expect(clearActiveSpaceId).toHaveBeenCalledTimes(1)
    expect(result.activeSpaceId).toBe('')
    expect(result.spaces).toEqual([])
  })

  it('throws when cloud bootstrap returns a non-zero response code', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 403,
        message: 'SPACE_FORBIDDEN',
        data: null
      }
    })

    await expect(
      bootstrap({
        callCloud,
        getActiveSpaceId: () => ''
      })
    ).rejects.toMatchObject({
      code: 403,
      message: 'SPACE_FORBIDDEN'
    })
  })

  it('throws when bootstrap response misses numeric code', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        data: {
          spaces: [{ id: 'space-1' }]
        }
      }
    })
    const clearActiveSpaceId = vi.fn()

    await expect(
      bootstrap({
        callCloud,
        getActiveSpaceId: () => 'space-1',
        setActiveSpaceId: vi.fn(),
        clearActiveSpaceId
      })
    ).rejects.toThrow(/响应格式无效/)
    expect(clearActiveSpaceId).not.toHaveBeenCalled()
  })

  it('throws when bootstrap response data is malformed', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          activeSpaceId: 'space-1'
        }
      }
    })
    const clearActiveSpaceId = vi.fn()

    await expect(
      bootstrap({
        callCloud,
        getActiveSpaceId: () => 'space-1',
        setActiveSpaceId: vi.fn(),
        clearActiveSpaceId
      })
    ).rejects.toThrow(/空间数据格式无效/)
    expect(clearActiveSpaceId).not.toHaveBeenCalled()
  })

  it('throws when bootstrap spaces contains entries without a usable id', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaces: [{}],
          activeSpaceId: '',
          role: ''
        }
      }
    })
    const clearActiveSpaceId = vi.fn()

    await expect(
      bootstrap({
        callCloud,
        getActiveSpaceId: () => 'space-1',
        setActiveSpaceId: vi.fn(),
        clearActiveSpaceId
      })
    ).rejects.toThrow(/空间数据格式无效/)
    expect(clearActiveSpaceId).not.toHaveBeenCalled()
  })

  it('throws when bootstrap spaces mixes valid and invalid entries', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaces: [{ id: 'space-1' }, {}],
          activeSpaceId: 'space-1',
          role: 'owner'
        }
      }
    })
    const clearActiveSpaceId = vi.fn()

    await expect(
      bootstrap({
        callCloud,
        getActiveSpaceId: () => 'space-1',
        setActiveSpaceId: vi.fn(),
        clearActiveSpaceId
      })
    ).rejects.toThrow(/空间数据格式无效/)
    expect(clearActiveSpaceId).not.toHaveBeenCalled()
  })
})

describe('createSessionService', () => {
  it('persists active space after creating a space', async () => {
    const storage = {
      getActiveSpaceId: vi.fn(() => ''),
      setActiveSpaceId: vi.fn(),
      clearActiveSpaceId: vi.fn()
    }
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaceId: 'space-3',
          activeSpaceId: 'space-3',
          name: 'Family',
          role: 'owner'
        }
      }
    })
    const service = createSessionService({
      callCloud,
      storage
    })

    const result = await service.createSpace('Family')

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'createSpace',
      name: 'Family'
    })
    expect(storage.setActiveSpaceId).toHaveBeenCalledWith('space-3')
    expect(result.activeSpaceId).toBe('space-3')
  })

  it('persists active space after joining a space', async () => {
    const storage = {
      getActiveSpaceId: vi.fn(() => ''),
      setActiveSpaceId: vi.fn(),
      clearActiveSpaceId: vi.fn()
    }
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaceId: 'space-9',
          activeSpaceId: 'space-9',
          name: 'Home',
          role: 'member'
        }
      }
    })
    const service = createSessionService({
      callCloud,
      storage
    })

    const result = await service.joinSpace('AB12CD')

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'joinSpace',
      inviteCode: 'AB12CD'
    })
    expect(storage.setActiveSpaceId).toHaveBeenCalledWith('space-9')
    expect(result.activeSpaceId).toBe('space-9')
  })

  it('returns members from listMembers', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          members: [{ openid: 'user-1', role: 'owner' }],
          spaceId: 'space-1'
        }
      }
    })
    const service = createSessionService({
      callCloud,
      storage: {
        getActiveSpaceId: vi.fn(() => ''),
        setActiveSpaceId: vi.fn(),
        clearActiveSpaceId: vi.fn()
      }
    })

    const result = await service.listMembers('space-1')

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'listMembers',
      spaceId: 'space-1'
    })
    expect(result.members).toEqual([{ openid: 'user-1', role: 'owner' }])
  })

  it('throws when create-space success payload is malformed', async () => {
    const service = createSessionService({
      callCloud: vi.fn().mockResolvedValue({
        result: {
          code: 0,
          data: null
        }
      }),
      storage: {
        getActiveSpaceId: vi.fn(() => ''),
        setActiveSpaceId: vi.fn(),
        clearActiveSpaceId: vi.fn()
      }
    })

    await expect(service.createSpace('Family')).rejects.toThrow(/响应格式无效/)
  })

  it('updates storage when switching spaces', async () => {
    const storage = {
      getActiveSpaceId: vi.fn(() => 'space-1'),
      setActiveSpaceId: vi.fn(),
      clearActiveSpaceId: vi.fn()
    }
    const service = createSessionService({
      callCloud: vi.fn(),
      storage
    })

    const result = await service.switchSpace('space-2')

    expect(storage.setActiveSpaceId).toHaveBeenCalledWith('space-2')
    expect(result.activeSpaceId).toBe('space-2')
  })
})

describe('app session contract', () => {
  it('keeps activeSpaceId as the only app-level session state', async () => {
    let appConfig = null
    global.App = (config) => {
      appConfig = config
    }
    global.wx = {
      cloud: {
        init: vi.fn()
      }
    }

    await import('../../miniprogram/app.js')
    const { envList } = await import('../../miniprogram/envList.js')
    const expectedEnv = envList[0] && envList[0].envId ? envList[0].envId : ''

    expect(appConfig.globalData).toEqual({
      env: expectedEnv,
      activeSpaceId: ''
    })
    expect(appConfig.setSession).toBeUndefined()
    expect(typeof appConfig.setActiveSpaceId).toBe('function')

    delete global.App
    delete global.wx
  })
})
