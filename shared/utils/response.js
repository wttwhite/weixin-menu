function buildOkResponse(data, message = '') {
  return { code: 0, message, data, retryable: false }
}

function buildErrorResponse(message, code = 1, retryable = false, data = null) {
  return { code, message, data, retryable }
}

module.exports = {
  buildOkResponse,
  buildErrorResponse
}
