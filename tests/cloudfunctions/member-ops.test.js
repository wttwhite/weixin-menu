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

  it('forbids list-members when current user is not in the space', async () => {
    const fakeDb = createFakeDb({
      spaces: [{ _id: 'space-1', name: 'Family', inviteCode: 'ABC123', ownerOpenid: 'owner-1' }],
      memberships: [{ spaceId: 'space-1', openid: 'owner-1', role: 'owner', status: 'active' }]
    })

    const handler = createMemberOpsHandler({
      createContext: () => ({ openid: 'user-2' }),
      createRepository: () => fakeDb.repository()
    })

    const response = await handler({ action: 'listMembers', spaceId: 'space-1' })
    expect(response.code).toBe(ERROR_CODES.SPACE_FORBIDDEN)
    expect(response.message).toBe('SPACE_FORBIDDEN')
  })

  it('forbids rename-space and remove-member when caller is not owner', async () => {
    const fakeDb = createFakeDb({
      spaces: [{ _id: 'space-1', name: 'Family', inviteCode: 'ABC123', ownerOpenid: 'owner-1' }],
      memberships: [
        { spaceId: 'space-1', openid: 'owner-1', role: 'owner', status: 'active' },
        { spaceId: 'space-1', openid: 'member-1', role: 'member', status: 'active' },
        { spaceId: 'space-1', openid: 'member-2', role: 'member', status: 'active' }
      ]
    })

    const handler = createMemberOpsHandler({
      createContext: () => ({ openid: 'member-1' }),
      createRepository: () => fakeDb.repository()
    })

    const renameResponse = await handler({
      action: 'renameSpace',
      spaceId: 'space-1',
      name: 'Renamed'
    })
    expect(renameResponse.code).toBe(ERROR_CODES.SPACE_FORBIDDEN)
    expect(renameResponse.message).toBe('SPACE_FORBIDDEN')

    const removeResponse = await handler({
      action: 'removeMember',
      spaceId: 'space-1',
      memberOpenid: 'member-2'
    })
    expect(removeResponse.code).toBe(ERROR_CODES.SPACE_FORBIDDEN)
    expect(removeResponse.message).toBe('SPACE_FORBIDDEN')
  })

  it('returns NOT_FOUND when removing the same member twice', async () => {
    const fakeDb = createFakeDb({
      spaces: [{ _id: 'space-1', name: 'Family', inviteCode: 'ABC123', ownerOpenid: 'owner-1' }],
      memberships: [
        { spaceId: 'space-1', openid: 'owner-1', role: 'owner', status: 'active' },
        { spaceId: 'space-1', openid: 'member-1', role: 'member', status: 'active' }
      ]
    })

    const handler = createMemberOpsHandler({
      createContext: () => ({ openid: 'owner-1' }),
      createRepository: () => fakeDb.repository()
    })

    const first = await handler({
      action: 'removeMember',
      spaceId: 'space-1',
      memberOpenid: 'member-1'
    })
    expect(first.code).toBe(ERROR_CODES.OK)

    const second = await handler({
      action: 'removeMember',
      spaceId: 'space-1',
      memberOpenid: 'member-1'
    })
    expect(second.code).toBe(ERROR_CODES.NOT_FOUND)
    expect(second.message).toBe('Member not found')
  })
})

describe('space-service invite code guarantees', () => {
  it('retries create-space when repository reports invite-code conflict during write', async () => {
    const generatedCodes = ['AAAAAA', 'BBBBBB']
    const attemptedCodes = []
    let codeIndex = 0

    const repository = {
      async createSpace(payload) {
        attemptedCodes.push(payload.inviteCode)
        if (payload.inviteCode === 'AAAAAA') {
          const error = new Error('Invite code already in use')
          error.code = ERROR_CODES.CONFLICT
          error.data = { reason: 'INVITE_CODE_TAKEN' }
          throw error
        }
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

  it('rotate-invite-code always chooses a new code and retries write conflicts', async () => {
    const generatedCodes = ['AAAAAA', 'BBBBBB', 'CCCCCC']
    const attemptedCodes = []
    let codeIndex = 0

    const repository = {
      async findMembership(spaceId, openid) {
        return {
          spaceId,
          openid,
          role: ROLES.OWNER,
          status: 'active'
        }
      },
      async getSpaceById(spaceId) {
        return {
          _id: spaceId,
          inviteCode: 'AAAAAA'
        }
      },
      async rotateInviteCode(spaceId, inviteCode) {
        attemptedCodes.push(inviteCode)
        if (inviteCode === 'BBBBBB') {
          const error = new Error('Invite code already in use')
          error.code = ERROR_CODES.CONFLICT
          error.data = { reason: 'INVITE_CODE_TAKEN' }
          throw error
        }
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

    expect(attemptedCodes).toEqual(['BBBBBB', 'CCCCCC'])
    expect(result.inviteCode).toBe('CCCCCC')
  })
})

describe('memberOps repository createSpace', () => {
  it('blocks duplicate invite-code writes at repository level', async () => {
    const fakeCloud = createFakeCloudDbAdapter()
    const repository = createRepository({
      cloudSdk: fakeCloud.cloudSdk,
      db: fakeCloud.db
    })

    const first = await repository.createSpace({
      name: 'Family',
      inviteCode: 'ABC123',
      ownerOpenid: 'owner-1'
    })
    expect(first.inviteCode).toBe('ABC123')

    await expect(
      repository.createSpace({
        name: 'Second',
        inviteCode: 'ABC123',
        ownerOpenid: 'owner-2'
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT,
      data: { reason: 'INVITE_CODE_TAKEN' }
    })

    expect(fakeCloud.snapshot().spaces).toHaveLength(1)
  })

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

describe('memberOps repository rotateInviteCode', () => {
  it('updates invite code through compare-and-swap where().update path', async () => {
    const fakeCloud = createFakeCloudDbAdapter({
      spaces: [
        {
          _id: 'space-1',
          name: 'Family',
          inviteCode: 'AAAAAA',
          ownerOpenid: 'owner-1'
        }
      ],
      inviteCodeClaims: [{ _id: 'AAAAAA', spaceId: 'space-1', status: 'active' }]
    })
    const repository = createRepository({
      cloudSdk: fakeCloud.cloudSdk,
      db: fakeCloud.db
    })

    const updated = await repository.rotateInviteCode('space-1', 'BBBBBB')
    expect(updated).toEqual(
      expect.objectContaining({
        _id: 'space-1',
        inviteCode: 'BBBBBB'
      })
    )

    const snapshot = fakeCloud.snapshot()
    expect(snapshot.spaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: 'space-1',
          inviteCode: 'BBBBBB'
        })
      ])
    )
    expect(snapshot.inviteCodeClaims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _id: 'BBBBBB',
          spaceId: 'space-1'
        })
      ])
    )
  })
})
