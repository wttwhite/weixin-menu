const { COLLECTIONS } = require('./shared/constants/collections')
const { buildErrorResponse } = require('./shared/utils/response')
const { ERROR_CODES } = require('./shared/constants/error-codes')
const { createContext } = require('./lib/context')
const { createApiRouter } = require('./lib/router')
const pantryHandlers = require('./handlers/pantry')
const recipeHandlers = require('./handlers/recipes')

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

  async function listPantryItems(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    if (query.category) {
      where.category = query.category
    }
    if (query.location) {
      where.location = query.location
    }

    const limit = typeof query.limit === 'number' && query.limit > 0 ? query.limit : 100
    const result = await db
      .collection(COLLECTIONS.PANTRY_ITEMS)
      .where(where)
      .limit(limit)
      .get()

    return result.data || []
  }

  async function getPantryListMetadata(spaceId, query = {}) {
    const result = await db
      .collection(COLLECTIONS.PANTRY_ITEMS)
      .where({
        spaceId,
        deletedAt: ''
      })
      .get()

    const data = result.data || []
    const categories = []
    const locations = []

    data.forEach((item) => {
      if (item.category && categories.indexOf(item.category) === -1) {
        categories.push(item.category)
      }
      if (item.location && locations.indexOf(item.location) === -1) {
        locations.push(item.location)
      }
    })

    const filteredTotal = data.filter((item) => {
      if (query.category && item.category !== query.category) {
        return false
      }
      if (query.location && item.location !== query.location) {
        return false
      }
      return true
    }).length

    return {
      total: filteredTotal,
      categories,
      locations
    }
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

  async function listRecipes(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    const limit = typeof query.limit === 'number' && query.limit > 0 ? query.limit : 100
    const result = await db
      .collection(COLLECTIONS.RECIPES)
      .where(where)
      .limit(limit)
      .get()

    return result.data || []
  }

  async function getRecipeListMetadata(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    const result = await db
      .collection(COLLECTIONS.RECIPES)
      .where(where)
      .count()

    return {
      total: typeof result.total === 'number' ? result.total : 0
    }
  }

  async function isRecipeTagInUse(spaceId, tagId) {
    const normalizedTagId = typeof tagId === 'string' ? tagId.trim() : ''
    if (!normalizedTagId) {
      return false
    }

    const _ = db.command
    const result = await db
      .collection(COLLECTIONS.RECIPES)
      .where({
        spaceId,
        deletedAt: '',
        tagIds: _.all([normalizedTagId])
      })
      .limit(1)
      .get()

    return Boolean(result.data && result.data.length)
  }

  async function getRecipe(spaceId, recipeId) {
    const result = await db
      .collection(COLLECTIONS.RECIPES)
      .where({
        _id: recipeId,
        spaceId
      })
      .get()

    if (!result.data || result.data.length === 0) {
      return null
    }

    return result.data[0]
  }

  async function createRecipe(data) {
    const created = await db.collection(COLLECTIONS.RECIPES).add({
      data
    })

    return {
      _id: created._id,
      ...data
    }
  }

  async function updateRecipe(spaceId, recipeId, data) {
    const existing = await getRecipe(spaceId, recipeId)
    if (!existing) {
      return null
    }

    await db.collection(COLLECTIONS.RECIPES).doc(recipeId).update({
      data
    })

    return {
      ...existing,
      ...data
    }
  }

  async function listRecipeTags(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    const result = await db
      .collection(COLLECTIONS.RECIPE_TAGS)
      .where(where)
      .get()
    return result.data || []
  }

  async function getRecipeTag(spaceId, tagId) {
    const result = await db
      .collection(COLLECTIONS.RECIPE_TAGS)
      .where({
        _id: tagId,
        spaceId
      })
      .get()

    if (!result.data || result.data.length === 0) {
      return null
    }

    return result.data[0]
  }

  async function createRecipeTag(data) {
    const created = await db.collection(COLLECTIONS.RECIPE_TAGS).add({
      data
    })

    return {
      _id: created._id,
      ...data
    }
  }

  async function updateRecipeTag(spaceId, tagId, data) {
    const existing = await getRecipeTag(spaceId, tagId)
    if (!existing) {
      return null
    }

    await db.collection(COLLECTIONS.RECIPE_TAGS).doc(tagId).update({
      data
    })

    return {
      ...existing,
      ...data
    }
  }

  return {
    createPantryItem,
    createRecipe,
    createRecipeTag,
    findMembership,
    getPantryItem,
    getPantryListMetadata,
    getRecipe,
    getRecipeListMetadata,
    getRecipeTag,
    listPantryItems,
    listRecipeTags,
    listRecipes,
    isRecipeTagInUse,
    updatePantryItem,
    updateRecipe,
    updateRecipeTag
  }
}

function createDefaultHandlers() {
  return {
    listPantry: pantryHandlers.listPantry,
    getPantryItem: pantryHandlers.getPantryItem,
    createPantryItem: pantryHandlers.createPantryItem,
    updatePantryItem: pantryHandlers.updatePantryItem,
    deletePantryItem: pantryHandlers.deletePantryItem,
    listRecipes: recipeHandlers.listRecipes,
    getRecipeDetail: recipeHandlers.getRecipeDetail,
    createRecipe: recipeHandlers.createRecipe,
    updateRecipe: recipeHandlers.updateRecipe,
    deleteRecipe: recipeHandlers.deleteRecipe,
    listRecipeTags: recipeHandlers.listRecipeTags,
    createRecipeTag: recipeHandlers.createRecipeTag,
    deleteRecipeTag: recipeHandlers.deleteRecipeTag
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
