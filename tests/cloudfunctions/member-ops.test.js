import { describe, expect, it } from 'vitest'
import { createMemberOpsHandler } from '../../cloudfunctions/memberOps/index'
import { bootstrapSession } from '../../cloudfunctions/memberOps/services/bootstrap-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'
import { createFakeDb } from '../helpers/fake-db'

describe('bootstrapSession', () => {
  it('returns spaces and the active role for the current user', async () => {
    const result = await bootstrapSession(
      { openid: 'user-1', preferredSpaceId: 'space-1' },
      {
        listMemberships: async () => [
          { spaceId: 'space-1', role: 'owner', status: 'active', name: 'Home' }
        ]
      }
    )

    expect(result.activeSpaceId).toBe('space-1')
    expect(result.role).toBe('owner')
    expect(result.spaces).toHaveLength(1)
  })
})

describe('memberOps.main', () => {
  it('supports create-space and join-space flow', async () => {
    const fakeDb = createFakeDb()
    const createOwnerHandler = () =>
      createMemberOpsHandler({
        createContext: () => ({ openid: 'owner-1' }),
        createRepository: () => fakeDb.repository()
      })

    const ownerHandler = createOwnerHandler()
    const createResult = await ownerHandler({
      action: 'createSpace',
      name: 'Family'
    })

    expect(createResult.code).toBe(ERROR_CODES.OK)
    expect(createResult.data.spaceId).toBeTruthy()
    expect(createResult.data.role).toBe('owner')
    expect(createResult.data.inviteCode).toMatch(/^[A-Z0-9]{6}$/)

    const memberHandler = createMemberOpsHandler({
      createContext: () => ({ openid: 'user-2' }),
      createRepository: () => fakeDb.repository()
    })

    const joinResult = await memberHandler({
      action: 'joinSpace',
      inviteCode: createResult.data.inviteCode
    })

    expect(joinResult.code).toBe(ERROR_CODES.OK)
    expect(joinResult.data.spaceId).toBe(createResult.data.spaceId)
    expect(joinResult.data.role).toBe('member')

    const snapshot = fakeDb.getSnapshot()
    expect(snapshot.memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ openid: 'owner-1', role: 'owner', status: 'active' }),
        expect.objectContaining({ openid: 'user-2', role: 'member', status: 'active' })
      ])
    )
  })
})
