const { COLLECTIONS } = require('./shared/constants/collections')
const { buildErrorResponse } = require('./shared/utils/response')
const { ERROR_CODES } = require('./shared/constants/error-codes')
const { createContext } = require('./lib/context')
const { createApiRouter } = require('./lib/router')

let hasInitialized = false

function getCloudSdk(cloudSdk) {
  return cloudSdk || require('wx-server-sdk')
}

function ensureCloudInit(cloudSdk) {
  if (hasInitialized) {
    return
  }

  cloudSdk.init({
    env: cloudSdk.DYNAMIC_CURRENT_ENV
  })
  hasInitialized = true
}

function createRepository(options = {}) {
  const cloudSdk = getCloudSdk(options.cloudSdk)
  ensureCloudInit(cloudSdk)
  const db = options.db || cloudSdk.database()

  async function findMembership(spaceId, openid) {
    const result = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        spaceId,
        openid,
        status: 'active'
      })
      .get()

    if (!result.data || result.data.length === 0) {
      return null
    }

    return result.data[0]
  }

  return {
    findMembership
  }
}

function createDefaultHandlers() {
  return {}
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

function createApiHandler(options = {}) {
  const createContextFn = options.createContext || createContext
  const createRepositoryFn = options.createRepository || createRepository
  const router =
    options.router ||
    createApiRouter({
      handlers: createDefaultHandlers()
    })

  return async function main(event = {}) {
    try {
      const context = await createContextFn(event)
      const repository = await createRepositoryFn(context)
      return await router.dispatch(event, context, repository)
    } catch (error) {
      return normalizeError(error)
    }
  }
}

const defaultHandler = createApiHandler()

module.exports = {
  main: defaultHandler,
  createApiHandler,
  createRepository
}
