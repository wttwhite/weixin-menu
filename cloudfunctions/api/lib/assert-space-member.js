const { ERROR_CODES } = require('../shared/constants/error-codes')

function createForbiddenError() {
  const error = new Error('SPACE_FORBIDDEN')
  error.code = ERROR_CODES.SPACE_FORBIDDEN
  return error
}

async function assertSpaceMember(payload) {
  const { spaceId, openid, repository } = payload || {}
  if (!spaceId) {
    return null
  }

  const membership = await repository.findMembership(spaceId, openid)
  if (!membership) {
    throw createForbiddenError()
  }

  return membership
}

module.exports = {
  assertSpaceMember,
  createForbiddenError
}
