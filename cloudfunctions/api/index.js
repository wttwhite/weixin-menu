const { COLLECTIONS } = require('./shared/constants/collections')
const { buildErrorResponse } = require('./shared/utils/response')
const { ERROR_CODES } = require('./shared/constants/error-codes')
const { createContext } = require('./lib/context')
const { createApiRouter } = require('./lib/router')
const pantryHandlers = require('./handlers/pantry')
const mealPlanHandlers = require('./handlers/meal-plans')
const recipeHandlers = require('./handlers/recipes')
const shoppingHandlers = require('./handlers/shopping')
const statisticsHandlers = require('./handlers/statistics')

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
  const PAGE_SIZE = 100

  async function listAllRecords(collectionName, where = {}) {
    const items = []
    let skip = 0

    while (true) {
      let request = db.collection(collectionName).where(where)
      if (typeof request.orderBy === 'function') {
        request = request.orderBy('_id', 'asc')
      }
      const result = await request
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
      const page = result.data || []
      items.push(...page)
      if (page.length < PAGE_SIZE) {
        break
      }
      skip += PAGE_SIZE
    }

    return items
  }

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

  async function listAllPantryItems(spaceId, query = {}) {
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

    return listAllRecords(COLLECTIONS.PANTRY_ITEMS, where)
  }

  async function getPantryListMetadata(spaceId, query = {}) {
    const data = await listAllPantryItems(spaceId, {
      deletedAt: ''
    })
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

  async function renamePantryCategory(spaceId, previousName, nextName, metadata = {}) {
    const pantryItems = await listAllPantryItems(spaceId, {
      deletedAt: ''
    })
    const matched = (pantryItems || []).filter((item) => item.category === previousName)

    for (const pantryItem of matched) {
      await db.collection(COLLECTIONS.PANTRY_ITEMS).doc(pantryItem._id).update({
        data: {
          category: nextName,
          updatedAt: metadata.updatedAt || pantryItem.updatedAt || '',
          updatedBy: metadata.updatedBy || pantryItem.updatedBy || ''
        }
      })
    }

    return matched.length
  }

  async function renamePantryLocation(spaceId, previousName, nextName, metadata = {}) {
    const pantryItems = await listAllPantryItems(spaceId, {
      deletedAt: ''
    })
    const matched = (pantryItems || []).filter((item) => item.location === previousName)

    for (const pantryItem of matched) {
      await db.collection(COLLECTIONS.PANTRY_ITEMS).doc(pantryItem._id).update({
        data: {
          location: nextName,
          updatedAt: metadata.updatedAt || pantryItem.updatedAt || '',
          updatedBy: metadata.updatedBy || pantryItem.updatedBy || ''
        }
      })
    }

    return matched.length
  }

  async function listMealPlans(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    const limit = typeof query.limit === 'number' && query.limit > 0 ? query.limit : 100
    let request = db
      .collection(COLLECTIONS.MEAL_PLANS)
      .where(where)

    if (typeof request.orderBy === 'function') {
      request = request
        .orderBy('planDate', 'asc')
        .orderBy('createdAt', 'asc')
        .orderBy('_id', 'asc')
    }

    const result = await request
      .limit(limit)
      .get()
    return result.data || []
  }

  async function getMealPlanListMetadata(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    const result = await db
      .collection(COLLECTIONS.MEAL_PLANS)
      .where(where)
      .count()
    return {
      total: typeof result.total === 'number' ? result.total : 0
    }
  }

  async function createMealPlan(data) {
    const created = await db.collection(COLLECTIONS.MEAL_PLANS).add({
      data
    })

    return {
      _id: created._id,
      ...data
    }
  }

  async function getMealPlan(spaceId, mealPlanId) {
    const result = await db
      .collection(COLLECTIONS.MEAL_PLANS)
      .where({
        _id: mealPlanId,
        spaceId
      })
      .get()
    if (!result.data || result.data.length === 0) {
      return null
    }
    return result.data[0]
  }

  async function updateMealPlan(spaceId, mealPlanId, data) {
    const existing = await getMealPlan(spaceId, mealPlanId)
    if (!existing) {
      return null
    }

    await db.collection(COLLECTIONS.MEAL_PLANS).doc(mealPlanId).update({
      data
    })

    return {
      ...existing,
      ...data
    }
  }

  async function listShoppingLists(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    const result = await db
      .collection(COLLECTIONS.SHOPPING_LISTS)
      .where(where)
      .get()
    return result.data || []
  }

  async function getShoppingList(spaceId, shoppingListId) {
    const result = await db
      .collection(COLLECTIONS.SHOPPING_LISTS)
      .where({
        _id: shoppingListId,
        spaceId
      })
      .get()
    if (!result.data || result.data.length === 0) {
      return null
    }
    return result.data[0]
  }

  async function createShoppingList(data) {
    const created = await db.collection(COLLECTIONS.SHOPPING_LISTS).add({
      data
    })
    return {
      _id: created._id,
      ...data
    }
  }

  async function updateShoppingList(spaceId, shoppingListId, data) {
    const existing = await getShoppingList(spaceId, shoppingListId)
    if (!existing) {
      return null
    }
    await db.collection(COLLECTIONS.SHOPPING_LISTS).doc(shoppingListId).update({
      data
    })
    return {
      ...existing,
      ...data
    }
  }

  async function listShoppingItems(spaceId, shoppingListId, query = {}) {
    const where = {
      spaceId,
      shoppingListId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    let request = db
      .collection(COLLECTIONS.SHOPPING_ITEMS)
      .where(where)

    if (typeof request.orderBy === 'function') {
      request = request.orderBy('sortOrder', 'asc').orderBy('createdAt', 'asc')
    }

    const result = await request.get()
    return result.data || []
  }

  async function getShoppingItem(spaceId, shoppingListId, shoppingItemId) {
    const result = await db
      .collection(COLLECTIONS.SHOPPING_ITEMS)
      .where({
        _id: shoppingItemId,
        spaceId,
        shoppingListId
      })
      .get()
    if (!result.data || result.data.length === 0) {
      return null
    }
    return result.data[0]
  }

  async function createShoppingItem(data) {
    const created = await db.collection(COLLECTIONS.SHOPPING_ITEMS).add({
      data
    })
    return {
      _id: created._id,
      ...data
    }
  }

  async function updateShoppingItem(spaceId, shoppingListId, shoppingItemId, data) {
    const existing = await getShoppingItem(spaceId, shoppingListId, shoppingItemId)
    if (!existing) {
      return null
    }
    await db.collection(COLLECTIONS.SHOPPING_ITEMS).doc(shoppingItemId).update({
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

  async function listAllRecipes(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(COLLECTIONS.RECIPES, where)
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

  async function getSpace(spaceId) {
    const result = await db
      .collection(COLLECTIONS.SPACES)
      .where({
        _id: spaceId
      })
      .get()

    if (!result.data || result.data.length === 0) {
      return null
    }

    return result.data[0]
  }

  async function updateSpace(spaceId, data) {
    const existing = await getSpace(spaceId)
    if (!existing) {
      return null
    }

    await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
      data
    })

    return {
      ...existing,
      ...data,
      settings: {
        ...(existing.settings || {}),
        ...((data && data.settings) || {})
      }
    }
  }

  async function renameRecipeCategory(spaceId, previousName, nextName, metadata = {}) {
    const recipes = await listAllRecipes(spaceId, {
      deletedAt: ''
    })
    const matched = (recipes || []).filter((item) => item.category === previousName)

    for (const recipe of matched) {
      await db.collection(COLLECTIONS.RECIPES).doc(recipe._id).update({
        data: {
          category: nextName,
          updatedAt: metadata.updatedAt || recipe.updatedAt || '',
          updatedBy: metadata.updatedBy || recipe.updatedBy || ''
        }
      })
    }

    return matched.length
  }

  async function listRecipeImagesByIds(spaceId, imageIds = []) {
    const normalizedIds = Array.from(
      new Set((Array.isArray(imageIds) ? imageIds : []).filter((id) => typeof id === 'string' && id))
    )
    if (!normalizedIds.length) {
      return []
    }

    const where = {
      spaceId
    }
    if (normalizedIds.length === 1) {
      where._id = normalizedIds[0]
    } else {
      where._id = db.command.in(normalizedIds)
    }

    const result = await db
      .collection(COLLECTIONS.RECIPE_IMAGES)
      .where(where)
      .get()
    return result.data || []
  }

  async function listRecipeImagesByRecipeId(spaceId, recipeId) {
    const result = await db
      .collection(COLLECTIONS.RECIPE_IMAGES)
      .where({
        spaceId,
        recipeId
      })
      .get()
    return result.data || []
  }

  async function updateRecipeImage(spaceId, imageId, data) {
    const existingList = await listRecipeImagesByIds(spaceId, [imageId])
    if (!existingList.length) {
      return null
    }
    const existing = existingList[0]

    await db.collection(COLLECTIONS.RECIPE_IMAGES).doc(imageId).update({
      data
    })

    return {
      ...existing,
      ...data
    }
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

  async function runInTransaction(work) {
    if (typeof db.startTransaction !== 'function') {
      return work(db)
    }

    const transaction = await db.startTransaction()
    try {
      const result = await work(transaction)
      await transaction.commit()
      return result
    } catch (error) {
      if (typeof transaction.rollback === 'function') {
        await transaction.rollback()
      }
      throw error
    }
  }

  async function getRecipeByConnection(connection, spaceId, recipeId) {
    const result = await connection
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

  async function getActiveRecipeTagByConnection(connection, spaceId, tagId) {
    const result = await connection
      .collection(COLLECTIONS.RECIPE_TAGS)
      .where({
        _id: tagId,
        spaceId,
        deletedAt: ''
      })
      .get()
    if (!result.data || result.data.length === 0) {
      return null
    }
    return result.data[0]
  }

  async function assertRecipeTagsActiveAndTouch(connection, spaceId, tagIds = [], touchedAt = '') {
    const normalizedTagIds = Array.from(
      new Set((Array.isArray(tagIds) ? tagIds : []).filter((tagId) => typeof tagId === 'string' && tagId))
    )
    if (!normalizedTagIds.length) {
      return
    }

    for (const tagId of normalizedTagIds) {
      const activeTag = await getActiveRecipeTagByConnection(connection, spaceId, tagId)
      if (!activeTag) {
        throw toAppError('Invalid recipe tagIds', ERROR_CODES.INVALID_INPUT)
      }
    }

    for (const tagId of normalizedTagIds) {
      await connection.collection(COLLECTIONS.RECIPE_TAGS).doc(tagId).update({
        data: {
          integrityTouchedAt: touchedAt
        }
      })
    }
  }

  async function createRecipeAtomic(data) {
    return runInTransaction(async (connection) => {
      const spaceId = data.spaceId
      await assertRecipeTagsActiveAndTouch(
        connection,
        spaceId,
        data.tagIds,
        data.updatedAt || data.createdAt || ''
      )
      const created = await connection.collection(COLLECTIONS.RECIPES).add({
        data
      })
      return {
        _id: created._id,
        ...data
      }
    })
  }

  async function updateRecipeAtomic(spaceId, recipeId, data) {
    return runInTransaction(async (connection) => {
      const existing = await getRecipeByConnection(connection, spaceId, recipeId)
      if (!existing || existing.deletedAt) {
        return null
      }

      await assertRecipeTagsActiveAndTouch(connection, spaceId, data.tagIds, data.updatedAt || '')
      await connection.collection(COLLECTIONS.RECIPES).doc(recipeId).update({
        data
      })

      return {
        ...existing,
        ...data
      }
    })
  }

  async function deleteRecipeTagAtomic(spaceId, tagId, data) {
    return runInTransaction(async (connection) => {
      const result = await connection
        .collection(COLLECTIONS.RECIPE_TAGS)
        .where({
          _id: tagId,
          spaceId
        })
        .get()
      const existing =
        result.data && result.data.length
          ? result.data[0]
          : null
      if (!existing || existing.deletedAt) {
        return null
      }

      const _ = db.command
      const referencedRecipeResult = await connection
        .collection(COLLECTIONS.RECIPES)
        .where({
          spaceId,
          deletedAt: '',
          tagIds: _.all([tagId])
        })
        .limit(1)
        .get()
      const hasReferencedRecipe = Boolean(
        referencedRecipeResult.data && referencedRecipeResult.data.length
      )
      if (hasReferencedRecipe) {
        throw toAppError('Recipe tag is still referenced by recipes', ERROR_CODES.CONFLICT)
      }

      await connection.collection(COLLECTIONS.RECIPE_TAGS).doc(tagId).update({
        data
      })

      return {
        ...existing,
        ...data
      }
    })
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

  async function listSpaceMembers(spaceId) {
    const result = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        spaceId,
        status: 'active'
      })
      .get()
    return result.data || []
  }

  async function getRecentBackupRecord(spaceId) {
    let request = db
      .collection(COLLECTIONS.BACKUP_RECORDS)
      .where({
        spaceId
      })
    if (typeof request.orderBy === 'function') {
      request = request.orderBy('updatedAt', 'desc').orderBy('createdAt', 'desc')
    }

    const result = await request.limit(1).get()
    if (!result.data || result.data.length === 0) {
      return null
    }
    return result.data[0]
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

  async function deleteCloudFiles(fileIds = []) {
    const normalized = Array.from(
      new Set((Array.isArray(fileIds) ? fileIds : []).filter((fileId) => typeof fileId === 'string' && fileId))
    )
    if (!normalized.length) {
      return
    }

    await cloudSdk.deleteFile({
      fileList: normalized
    })
  }

  return {
    createPantryItem,
    createMealPlan,
    createRecipe,
    createRecipeAtomic,
    createRecipeTag,
    deleteRecipeTagAtomic,
    findMembership,
    getPantryItem,
    getMealPlan,
    getSpace,
    getPantryListMetadata,
    getMealPlanListMetadata,
    getRecipe,
    listRecipeImagesByIds,
    listRecipeImagesByRecipeId,
    getRecipeListMetadata,
    getRecipeTag,
    listAllPantryItems,
    listPantryItems,
    listAllRecipes,
    listMealPlans,
    listShoppingLists,
    listShoppingItems,
    listSpaceMembers,
    listRecipeTags,
    listRecipes,
    getRecentBackupRecord,
    getShoppingItem,
    getShoppingList,
    isRecipeTagInUse,
    updatePantryItem,
    updateMealPlan,
    updateSpace,
    updateShoppingItem,
    updateShoppingList,
    updateRecipe,
    updateRecipeImage,
    updateRecipeAtomic,
    updateRecipeTag,
    renamePantryCategory,
    renamePantryLocation,
    renameRecipeCategory,
    deleteCloudFiles,
    createShoppingItem,
    createShoppingList
  }
}

function createDefaultHandlers() {
  return {
    listPantry: pantryHandlers.listPantry,
    getPantryItem: pantryHandlers.getPantryItem,
    createPantryItem: pantryHandlers.createPantryItem,
    updatePantryItem: pantryHandlers.updatePantryItem,
    deletePantryItem: pantryHandlers.deletePantryItem,
    listPantryCategories: pantryHandlers.listPantryCategories,
    createPantryCategory: pantryHandlers.createPantryCategory,
    updatePantryCategory: pantryHandlers.updatePantryCategory,
    deletePantryCategory: pantryHandlers.deletePantryCategory,
    reorderPantryCategories: pantryHandlers.reorderPantryCategories,
    listPantryLocations: pantryHandlers.listPantryLocations,
    createPantryLocation: pantryHandlers.createPantryLocation,
    updatePantryLocation: pantryHandlers.updatePantryLocation,
    deletePantryLocation: pantryHandlers.deletePantryLocation,
    reorderPantryLocations: pantryHandlers.reorderPantryLocations,
    listMealPlans: mealPlanHandlers.listMealPlans,
    getMealPlan: mealPlanHandlers.getMealPlan,
    createMealPlan: mealPlanHandlers.createMealPlan,
    updateMealPlan: mealPlanHandlers.updateMealPlan,
    deleteMealPlan: mealPlanHandlers.deleteMealPlan,
    listRecipes: recipeHandlers.listRecipes,
    getRecipeDetail: recipeHandlers.getRecipeDetail,
    createRecipe: recipeHandlers.createRecipe,
    updateRecipe: recipeHandlers.updateRecipe,
    deleteRecipe: recipeHandlers.deleteRecipe,
    listRecipeTags: recipeHandlers.listRecipeTags,
    listRecipeCategories: recipeHandlers.listRecipeCategories,
    createRecipeTag: recipeHandlers.createRecipeTag,
    createRecipeCategory: recipeHandlers.createRecipeCategory,
    updateRecipeCategory: recipeHandlers.updateRecipeCategory,
    deleteRecipeCategory: recipeHandlers.deleteRecipeCategory,
    deleteRecipeTag: recipeHandlers.deleteRecipeTag,
    listShoppingLists: shoppingHandlers.listShoppingLists,
    createShoppingList: shoppingHandlers.createShoppingList,
    updateShoppingList: shoppingHandlers.updateShoppingList,
    deleteShoppingList: shoppingHandlers.deleteShoppingList,
    generateShoppingItemsFromPlan: shoppingHandlers.generateShoppingItemsFromPlan,
    toggleShoppingItemChecked: shoppingHandlers.toggleShoppingItemChecked,
    getStatisticsDashboard: statisticsHandlers.getStatisticsDashboard
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
