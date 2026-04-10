import { describe, expect, it } from 'vitest'
import { createMemberOpsHandler } from '../../cloudfunctions/memberOps/index'
import { createRepository } from '../../cloudfunctions/memberOps/lib/repository'
import { bootstrapSession } from '../../cloudfunctions/memberOps/services/bootstrap-service'
import {
  createSpace as createSpaceService,
  rotateInviteCode as rotateInviteCodeService
} from '../../cloudfunctions/memberOps/services/space-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'
import { ROLES } from '../../shared/constants/roles'
import { createFakeDb, createFakeCloudDbAdapter } from '../helpers/fake-db'

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

  it('rejects authenticated actions when openid is missing', async () => {
    let repositoryCalls = 0
    const handler = createMemberOpsHandler({
      createContext: () => ({ openid: '' }),
      createRepository: () => {
        repositoryCalls += 1
        return {}
      }
    })

    const events = [
      { action: 'bootstrap', preferredSpaceId: 'space-1' },
      { action: 'createSpace', name: 'Family' },
      { action: 'joinSpace', inviteCode: 'ABC123' },
      { action: 'listMembers', spaceId: 'space-1' },
      { action: 'removeMember', spaceId: 'space-1', memberOpenid: 'user-2' },
      { action: 'renameSpace', spaceId: 'space-1', name: 'New Name' },
      { action: 'rotateInviteCode', spaceId: 'space-1' }
    ]

    for (const event of events) {
      const response = await handler(event)
      expect(response.code).toBe(ERROR_CODES.UNAUTHORIZED)
      expect(response.message).toBe('Missing current user')
    }

    expect(repositoryCalls).toBe(0)
  })
})

describe('space-service invite code guarantees', () => {
  it('retries invite-code generation when create-space hits a collision', async () => {
    const generatedCodes = ['AAAAAA', 'BBBBBB']
    const attemptedCodes = []
    let codeIndex = 0

    const repository = {
      async findSpaceByInviteCode(code) {
        attemptedCodes.push(code)
        if (code === 'AAAAAA') {
          return { _id: 'space-existing', inviteCode: code }
        }
        return null
      },
      async createSpace(payload) {
        return { _id: 'space-2', ...payload }
      }
    }

    const result = await createSpaceService(
      { name: 'Family' },
      { openid: 'owner-1' },
      repository,
      {
        inviteCodeFactory: () => generatedCodes[codeIndex++]
      }
    )

    expect(attemptedCodes).toEqual(['AAAAAA', 'BBBBBB'])
    expect(result.inviteCode).toBe('BBBBBB')
  })

  it('retries invite-code generation when rotate hits a collision', async () => {
    const generatedCodes = ['AAAAAA', 'BBBBBB']
    const attemptedCodes = []
    let codeIndex = 0
    let updatedInviteCode = ''

    const repository = {
      async findMembership(spaceId, openid) {
        return {
          spaceId,
          openid,
          role: ROLES.OWNER,
          status: 'active'
        }
      },
      async findSpaceByInviteCode(code) {
        attemptedCodes.push(code)
        if (code === 'AAAAAA') {
          return { _id: 'space-other', inviteCode: code }
        }
        return null
      },
      async rotateInviteCode(spaceId, inviteCode) {
        updatedInviteCode = inviteCode
        return {
          _id: spaceId,
          inviteCode
        }
      }
    }

    const result = await rotateInviteCodeService(
      { spaceId: 'space-1' },
      { openid: 'owner-1' },
      repository,
      {
        inviteCodeFactory: () => generatedCodes[codeIndex++]
      }
    )

    expect(attemptedCodes).toEqual(['AAAAAA', 'BBBBBB'])
    expect(updatedInviteCode).toBe('BBBBBB')
    expect(result.inviteCode).toBe('BBBBBB')
  })
})

describe('memberOps repository createSpace', () => {
  it('rolls back the space document when owner-membership insert fails', async () => {
    const fakeCloud = createFakeCloudDbAdapter({ failNextMemberAdd: true })
    const repository = createRepository({
      cloudSdk: fakeCloud.cloudSdk,
      db: fakeCloud.db
    })

    await expect(
      repository.createSpace({
        name: 'Family',
        inviteCode: 'ABC123',
        ownerOpenid: 'owner-1'
      })
    ).rejects.toThrow('member write failed')

    expect(fakeCloud.snapshot().spaces).toHaveLength(0)
    expect(fakeCloud.calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'remove',
          collection: 'spaces'
        })
      ])
    )
  })
})
