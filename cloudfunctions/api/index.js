const { COLLECTIONS } = require('./shared/constants/collections')
const { buildErrorResponse } = require('./shared/utils/response')
const { ERROR_CODES } = require('./shared/constants/error-codes')
const { createContext } = require('./lib/context')
const { createApiRouter } = require('./lib/router')
const pantryHandlers = require('./handlers/pantry')

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

  async function listPantryItems(spaceId) {
    const result = await db
      .collection(COLLECTIONS.PANTRY_ITEMS)
      .where({
        spaceId
      })
      .get()

    return result.data || []
  }

  async function createPantryItem(data) {
    const created = await db.collection(COLLECTIONS.PANTRY_ITEMS).add({
      data
    })

    return {
      _id: created._id,
      ...data
    }
  }

  async function getPantryItem(spaceId, pantryItemId) {
    const result = await db
      .collection(COLLECTIONS.PANTRY_ITEMS)
      .where({
        _id: pantryItemId,
        spaceId
      })
      .get()

    if (!result.data || result.data.length === 0) {
      return null
    }

    return result.data[0]
  }

  async function updatePantryItem(spaceId, pantryItemId, data) {
    const existing = await getPantryItem(spaceId, pantryItemId)
    if (!existing) {
      return null
    }

    await db.collection(COLLECTIONS.PANTRY_ITEMS).doc(pantryItemId).update({
      data
    })

    return {
      ...existing,
      ...data
    }
  }

  return {
    createPantryItem,
    findMembership,
    getPantryItem,
    listPantryItems,
    updatePantryItem
  }
}

function createDefaultHandlers() {
  return {
    listPantry: pantryHandlers.listPantry,
    createPantryItem: pantryHandlers.createPantryItem,
    updatePantryItem: pantryHandlers.updatePantryItem,
    deletePantryItem: pantryHandlers.deletePantryItem
  }
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

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
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
      if (!context.openid) {
        throw toAppError('Missing current user', ERROR_CODES.UNAUTHORIZED)
      }
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
