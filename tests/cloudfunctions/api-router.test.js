import { describe, expect, it } from 'vitest'
import { createApiHandler, createRepository as createApiRepository } from '../../cloudfunctions/api/index'
import { createApiRouter } from '../../cloudfunctions/api/lib/router'
import { ERROR_CODES } from '../../shared/constants/error-codes'
import { createFakeCloudDbAdapter } from '../helpers/fake-db'

describe('createApiRouter', () => {
  it('returns SPACE_FORBIDDEN when current user is not a member of the target space', async () => {
    const router = createApiRouter({
      handlers: {
        noop: async () => ({ ok: true })
      }
    })

    const response = await router.dispatch(
      { action: 'noop', spaceId: 'space-1' },
      { openid: 'user-1' },
      {
        findMembership: async () => null
      }
    )

    expect(response).toEqual({
      code: ERROR_CODES.SPACE_FORBIDDEN,
      message: 'SPACE_FORBIDDEN',
      data: null,
      retryable: false
    })
  })

  it('uses default membership assertion path and passes membership to handler context', async () => {
    const router = createApiRouter({
      handlers: {
        noop: async ({ context }) => ({
          role: context.membership.role
        })
      }
    })

    const response = await router.dispatch(
      { action: 'noop', spaceId: 'space-1' },
      { openid: 'user-1' },
      {
        findMembership: async () => ({
          _id: 'member-1',
          spaceId: 'space-1',
          openid: 'user-1',
          role: 'owner',
          status: 'active'
        })
      }
    )

    expect(response.code).toBe(ERROR_CODES.OK)
    expect(response.data).toEqual({
      role: 'owner'
    })
  })
})

describe('createApiHandler', () => {
  it('rejects requests when openid is missing before repository creation and dispatch', async () => {
    let repositoryCalls = 0
    let dispatchCalls = 0
    const handler = createApiHandler({
      createContext: async () => ({ openid: '' }),
      createRepository: async () => {
        repositoryCalls += 1
        return {}
      },
      router: {
        async dispatch() {
          dispatchCalls += 1
          return { code: ERROR_CODES.OK, message: 'OK', data: null, retryable: false }
        }
      }
    })

    const response = await handler({ action: 'noop' })
    expect(response).toEqual({
      code: ERROR_CODES.UNAUTHORIZED,
      message: 'Missing current user',
      data: null,
      retryable: false
    })
    expect(repositoryCalls).toBe(0)
    expect(dispatchCalls).toBe(0)
  })

  it('normalizes async router dispatch rejections', async () => {
    const handler = createApiHandler({
      createContext: async () => ({ openid: 'user-1' }),
      createRepository: async () => ({}),
      router: {
        async dispatch() {
          const error = new Error('SPACE_FORBIDDEN')
          error.code = ERROR_CODES.SPACE_FORBIDDEN
          throw error
        }
      }
    })

    const response = await handler({ action: 'noop' })
    expect(response).toEqual({
      code: ERROR_CODES.SPACE_FORBIDDEN,
      message: 'SPACE_FORBIDDEN',
      data: null,
      retryable: false
    })
  })
})

describe('api repository wiring', () => {
  it('queries active memberships through db adapter', async () => {
    const fakeCloud = createFakeCloudDbAdapter({
      memberships: [
        {
          _id: 'member-1',
          spaceId: 'space-1',
          openid: 'user-1',
          role: 'member',
          status: 'active'
        },
        {
          _id: 'member-2',
          spaceId: 'space-1',
          openid: 'user-1',
          role: 'owner',
          status: 'removed'
        }
      ]
    })

    const repository = createApiRepository({
      cloudSdk: fakeCloud.cloudSdk,
      db: fakeCloud.db
    })

    await expect(repository.findMembership('space-1', 'user-1')).resolves.toEqual(
      expect.objectContaining({
        _id: 'member-1',
        role: 'member',
        status: 'active'
      })
    )
    await expect(repository.findMembership('space-1', 'missing')).resolves.toBeNull()
  })
})
