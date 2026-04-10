import { describe, expect, it, vi } from 'vitest'
import {
  bootstrap,
  createSessionService,
  resolveActiveSpaceId
} from '../../miniprogram/services/session'

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
})

describe('createSessionService', () => {
  it('updates storage when switching spaces', async () => {
    const storage = {
      getActiveSpaceId: vi.fn(() => 'space-1'),
      setActiveSpaceId: vi.fn()
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
