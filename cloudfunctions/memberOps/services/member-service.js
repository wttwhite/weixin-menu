const { ROLES } = require('../shared/constants/roles')
const { ERROR_CODES } = require('../shared/constants/error-codes')
const { toAppError } = require('./bootstrap-service')

function normalizeSpaceId(spaceId) {
  return typeof spaceId === 'string' ? spaceId.trim() : ''
}

async function assertMember(spaceId, openid, repository) {
  const membership = await repository.findMembership(spaceId, openid)
  if (!membership) {
    throw toAppError('SPACE_FORBIDDEN', ERROR_CODES.SPACE_FORBIDDEN)
  }
  return membership
}

async function listMembers(event, context, repository) {
  const spaceId = normalizeSpaceId(event.spaceId)
  if (!spaceId) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }

  await assertMember(spaceId, context.openid, repository)
  const members = await repository.listMembers(spaceId)
  return {
    spaceId,
    members
  }
}

async function removeMember(event, context, repository) {
  const spaceId = normalizeSpaceId(event.spaceId)
  const memberOpenid =
    typeof event.memberOpenid === 'string' ? event.memberOpenid.trim() : ''

  if (!spaceId || !memberOpenid) {
    throw toAppError('spaceId and memberOpenid are required', ERROR_CODES.INVALID_INPUT)
  }

  const membership = await assertMember(spaceId, context.openid, repository)
  if (membership.role !== ROLES.OWNER) {
    throw toAppError('SPACE_FORBIDDEN', ERROR_CODES.SPACE_FORBIDDEN)
  }

  if (memberOpenid === context.openid) {
    throw toAppError('Owner cannot remove self', ERROR_CODES.INVALID_INPUT)
  }

  const removed = await repository.removeMember(spaceId, memberOpenid)
  if (!removed) {
    throw toAppError('Member not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    spaceId,
    memberOpenid
  }
}

async function updateMemberDisplayName(event, context, repository) {
  const spaceId = normalizeSpaceId(event.spaceId)
  const memberOpenid =
    typeof event.memberOpenid === 'string' ? event.memberOpenid.trim() : ''
  const displayName =
    typeof event.displayName === 'string' ? event.displayName.trim() : ''

  if (!spaceId || !memberOpenid || !displayName) {
    throw toAppError('spaceId, memberOpenid and displayName are required', ERROR_CODES.INVALID_INPUT)
  }

  const membership = await assertMember(spaceId, context.openid, repository)
  if (memberOpenid !== context.openid && membership.role !== ROLES.OWNER) {
    throw toAppError('SPACE_FORBIDDEN', ERROR_CODES.SPACE_FORBIDDEN)
  }

  const updated = await repository.updateMemberDisplayName(spaceId, memberOpenid, displayName)
  if (!updated) {
    throw toAppError('Member not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    spaceId,
    memberOpenid,
    displayName: updated.displayName || ''
  }
}

module.exports = {
  listMembers,
  removeMember,
  updateMemberDisplayName
}
