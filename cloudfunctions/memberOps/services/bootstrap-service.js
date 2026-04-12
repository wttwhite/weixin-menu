const { ERROR_CODES } = require('../shared/constants/error-codes')

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

async function bootstrapSession(input, repository) {
  if (!input || !input.openid) {
    throw toAppError('Missing current user', ERROR_CODES.UNAUTHORIZED)
  }

  const memberships = await repository.listMemberships(input.openid)
  const spaces = (memberships || []).filter((item) => item.status === 'active')
  if (spaces.length === 0) {
    return {
      openid: input.openid,
      spaces: [],
      activeSpaceId: null,
      role: null
    }
  }

  const activeMembership =
    spaces.find((item) => item.spaceId === input.preferredSpaceId) || spaces[0]

  return {
    openid: input.openid,
    spaces,
    activeSpaceId: activeMembership.spaceId,
    role: activeMembership.role
  }
}

module.exports = {
  bootstrapSession,
  toAppError
}
