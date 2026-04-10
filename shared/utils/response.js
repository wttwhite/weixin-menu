const { ERROR_CODES } = require('../constants/error-codes')

function buildOkResponse(data, message = '') {
  return { code: ERROR_CODES.OK, message, data, retryable: false }
}

function buildErrorResponse(
  message,
  code = ERROR_CODES.UNKNOWN,
  retryable = false,
  data = null
) {
  return { code, message, data, retryable }
}

module.exports = {
  buildOkResponse,
  buildErrorResponse
}
