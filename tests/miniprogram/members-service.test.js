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
})
