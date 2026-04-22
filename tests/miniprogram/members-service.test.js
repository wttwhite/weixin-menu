import { describe, expect, it, vi } from 'vitest'
import { createMembersService } from '../../miniprogram/services/members'

describe('createMembersService', () => {
  it('passes preferredSpaceId when bootstrapping member session', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaces: [],
          activeSpaceId: 'space-2',
          role: 'owner'
        }
      }
    })

    const service = createMembersService({ callCloud })
    const result = await service.bootstrapSession('space-2')

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'bootstrap',
      preferredSpaceId: 'space-2'
    })
    expect(result.role).toBe('owner')
  })

  it('calls memberOps initCollections for one-click database setup', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          created: ['spaces', 'space_members'],
          existing: ['recipes']
        }
      }
    })

    const service = createMembersService({ callCloud })
    const result = await service.initCollections()

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'initCollections'
    })
    expect(result).toEqual({
      created: ['spaces', 'space_members'],
      existing: ['recipes']
    })
  })

  it('calls memberOps to update a member display name inside a space', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaceId: 'space-1',
          memberOpenid: 'member-1',
          displayName: '小王'
        }
      }
    })

    const service = createMembersService({ callCloud })
    const result = await service.updateMemberDisplayName('space-1', 'member-1', '小王')

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'updateMemberDisplayName',
      spaceId: 'space-1',
      memberOpenid: 'member-1',
      displayName: '小王'
    })
    expect(result.displayName).toBe('小王')
  })

  it('calls memberOps renameSpace for owner space settings', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          spaceId: 'space-1',
          name: '新厨房'
        }
      }
    })

    const service = createMembersService({ callCloud })
    const result = await service.renameSpace('space-1', '新厨房')

    expect(callCloud).toHaveBeenCalledWith('memberOps', {
      action: 'renameSpace',
      spaceId: 'space-1',
      name: '新厨房'
    })
    expect(result.name).toBe('新厨房')
  })
})
