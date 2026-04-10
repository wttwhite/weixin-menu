import { describe, expect, it } from 'vitest'
import { createInviteCode } from '../../shared/utils/invite-code'

describe('createInviteCode', () => {
  it('returns six uppercase alphanumeric characters', () => {
    const code = createInviteCode()
    expect(code).toMatch(/^[A-Z0-9]{6}$/)
  })
})
