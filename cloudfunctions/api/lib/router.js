const { buildOkResponse, buildErrorResponse } = require('../shared/utils/response')
const { ERROR_CODES } = require('../shared/constants/error-codes')
const { assertSpaceMember: defaultAssertSpaceMember } = require('./assert-space-member')

function createForbiddenError() {
  const error = new Error('SPACE_FORBIDDEN')
  error.code = ERROR_CODES.SPACE_FORBIDDEN
  return error
}

function normalizeError(error) {
  if (error && typeof error.code === 'number') {
    return buildErrorResponse(error.message || 'Request failed', error.code, false, error.data || null)
  }

  return buildErrorResponse(
    (error && error.message) || 'Unknown error',
    ERROR_CODES.UNKNOWN,
    false,
    null
  )
}

function createApiRouter(options = {}) {
  const handlers = options.handlers || {}
  const assertSpaceMember = options.assertSpaceMember || defaultAssertSpaceMember
  const requiresMembership =
    options.requiresMembership || ((event) => Boolean(event && event.spaceId))

  async function dispatch(event = {}, context = {}, repository = {}) {
    const action = event.action
    if (!action) {
      return buildErrorResponse('Missing action', ERROR_CODES.INVALID_INPUT)
    }

    const handler = handlers[action]
    if (!handler) {
      return buildErrorResponse('Unsupported action', ERROR_CODES.NOT_FOUND)
    }

    try {
      if (requiresMembership(event)) {
        const membershipResult = await assertSpaceMember({
          spaceId: event.spaceId,
          openid: context.openid,
          repository
        })
        if (!membershipResult) {
          throw createForbiddenError()
        }
        context.membership = membershipResult
      }

      const output = await handler({
        event,
        context,
        repository
      })

      if (
        output &&
        typeof output === 'object' &&
        typeof output.code === 'number' &&
        Object.prototype.hasOwnProperty.call(output, 'message') &&
        Object.prototype.hasOwnProperty.call(output, 'retryable')
      ) {
        return output
      }

      return buildOkResponse(output)
    } catch (error) {
      return normalizeError(error)
    }
  }

  return {
    dispatch
  }
}

module.exports = {
  createApiRouter
}
