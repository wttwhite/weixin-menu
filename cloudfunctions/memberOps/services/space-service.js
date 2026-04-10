const { ROLES } = require('../shared/constants/roles')
const { ERROR_CODES } = require('../shared/constants/error-codes')
const { createInviteCode } = require('../shared/utils/invite-code')
const { toAppError } = require('./bootstrap-service')

const INVITE_CODE_MAX_ATTEMPTS = 8

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : ''
}

async function assertOwner(spaceId, openid, repository) {
  const membership = await repository.findMembership(spaceId, openid)
  if (!membership || membership.role !== ROLES.OWNER) {
    throw toAppError('SPACE_FORBIDDEN', ERROR_CODES.SPACE_FORBIDDEN)
  }
}

function resolveSpaceId(space) {
  return space && (space._id || space.spaceId)
}

async function createUniqueInviteCode(repository, options = {}) {
  const inviteCodeFactory = options.inviteCodeFactory || createInviteCode
  const spaceIdToIgnore = options.spaceIdToIgnore || ''
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
    const inviteCode = inviteCodeFactory()
    const existingSpace = await repository.findSpaceByInviteCode(inviteCode)
    const existingSpaceId = resolveSpaceId(existingSpace)
    if (!existingSpace || existingSpaceId === spaceIdToIgnore) {
      return inviteCode
    }
  }

  throw toAppError('Failed to generate unique invite code', ERROR_CODES.CONFLICT)
}

async function createSpace(event, context, repository, options = {}) {
  const name = normalizeName(event.name)
  if (!name) {
    throw toAppError('Space name is required', ERROR_CODES.INVALID_INPUT)
  }

  const inviteCode = await createUniqueInviteCode(repository, {
    inviteCodeFactory: options.inviteCodeFactory
  })
  const space = await repository.createSpace({
    name,
    inviteCode,
    ownerOpenid: context.openid
  })
  const spaceId = space._id || space.spaceId

  return {
    spaceId,
    name: space.name,
    inviteCode,
    role: ROLES.OWNER,
    activeSpaceId: spaceId
  }
}

async function joinSpace(event, context, repository) {
  const inviteCode = typeof event.inviteCode === 'string' ? event.inviteCode.trim().toUpperCase() : ''
  if (!inviteCode) {
    throw toAppError('Invite code is required', ERROR_CODES.INVALID_INPUT)
  }

  const space = await repository.findSpaceByInviteCode(inviteCode)
  if (!space) {
    throw toAppError('Space not found', ERROR_CODES.NOT_FOUND)
  }

  const spaceId = space._id || space.spaceId
  const existingMembership = await repository.findMembership(spaceId, context.openid)
  const membership =
    existingMembership ||
    (await repository.addOrActivateMembership({
      spaceId,
      openid: context.openid,
      role: ROLES.MEMBER
    }))

  return {
    spaceId,
    name: space.name,
    role: membership.role || ROLES.MEMBER,
    activeSpaceId: spaceId
  }
}

async function renameSpace(event, context, repository) {
  const spaceId = typeof event.spaceId === 'string' ? event.spaceId.trim() : ''
  const name = normalizeName(event.name)
  if (!spaceId || !name) {
    throw toAppError('spaceId and name are required', ERROR_CODES.INVALID_INPUT)
  }

  await assertOwner(spaceId, context.openid, repository)
  const updated = await repository.renameSpace(spaceId, name)
  if (!updated) {
    throw toAppError('Space not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    spaceId,
    name: updated.name
  }
}

async function rotateInviteCode(event, context, repository, options = {}) {
  const spaceId = typeof event.spaceId === 'string' ? event.spaceId.trim() : ''
  if (!spaceId) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }

  await assertOwner(spaceId, context.openid, repository)
  const inviteCode = await createUniqueInviteCode(repository, {
    inviteCodeFactory: options.inviteCodeFactory,
    spaceIdToIgnore: spaceId
  })
  const updated = await repository.rotateInviteCode(spaceId, inviteCode)
  if (!updated) {
    throw toAppError('Space not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    spaceId,
    inviteCode
  }
}

module.exports = {
  createSpace,
  joinSpace,
  renameSpace,
  rotateInviteCode
}
