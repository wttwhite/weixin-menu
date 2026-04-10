import { describe, expect, it } from 'vitest'
import { createApiRouter } from '../../cloudfunctions/api/lib/router'
import { ERROR_CODES } from '../../shared/constants/error-codes'

describe('createApiRouter', () => {
  it('returns SPACE_FORBIDDEN when current user is not a member of the target space', async () => {
    const router = createApiRouter({
      handlers: {
        noop: async () => ({ ok: true })
      },
      assertSpaceMember: async () => false
    })

    const response = await router.dispatch(
      { action: 'noop', spaceId: 'space-1' },
      { openid: 'user-1' },
      {}
    )

    expect(response).toEqual({
      code: ERROR_CODES.SPACE_FORBIDDEN,
      message: 'SPACE_FORBIDDEN',
      data: null,
      retryable: false
    })
  })
})
