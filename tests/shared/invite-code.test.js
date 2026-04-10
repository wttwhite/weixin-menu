import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInviteCode } from '../../shared/utils/invite-code'

describe('createInviteCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns six uppercase alphanumeric characters', () => {
    const code = createInviteCode()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })

  it('supports custom length', () => {
    const code = createInviteCode(10)
    expect(code).toMatch(/^[A-Z0-9]{10}$/)
  })

  it('uses crypto.getRandomValues when available', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(target) {
        for (let index = 0; index < target.length; index += 1) {
          target[index] = 35
        }
        return target
      }
    })

    expect(createInviteCode(4)).toBe('9999')
  })
})
