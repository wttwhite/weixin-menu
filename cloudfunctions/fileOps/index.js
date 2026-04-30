const { buildErrorResponse, buildOkResponse } = require('./shared/utils/response')
const { ERROR_CODES } = require('./shared/constants/error-codes')
const { COLLECTIONS } = require('./shared/constants/collections')
const { createContext } = require('./lib/context')
const {
  confirmRecipeImageUpload,
  deleteRecipeImage,
  discardRecipeImage,
  prepareRecipeImageUpload
} = require('./services/recipe-image-service')
const {
  exportSpaceBackup,
  importSpaceBackup,
  listBackupRecords
} = require('./services/backup-service')
const { createStorageService } = require('./services/storage-service')

let hasInitialized = false
const RESTORE_TRANSACTION_WRITE_LIMIT = 10
const RESTORE_REQUEST_LIMIT_RETRY_COUNT = 2
const RESTORE_REQUEST_LIMIT_RETRY_DELAY_MS = 500

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

function normalizeError(error) {
  if (error && typeof error.code === 'number') {
    return buildErrorResponse(error.message || 'Request failed', error.code, false, error.data || null)
  }

  return buildErrorResponse((error && error.message) || 'Unknown error', ERROR_CODES.UNKNOWN, false, null)
}

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}

function isRequestLimitError(error = {}) {
  const candidates = [
    error.code,
    error.errCode,
    error.message,
    error.errMsg
  ].map((value) => String(value || ''))

  return candidates.some((value) =>
    value.includes('-501003') ||
    value.includes('LimitExceeded') ||
    value.includes('EXCEED_REQUEST_LIMIT') ||
    /exceed request limit/i.test(value)
  )
}

function createRepository(options = {}) {
  const cloudSdk = getCloudSdk(options.cloudSdk)
  ensureCloudInit(cloudSdk)
  const db = options.db || cloudSdk.database()
  const RECIPE_IMAGES = COLLECTIONS.RECIPE_IMAGES || 'recipe_images'
  const BACKUP_RECORDS = COLLECTIONS.BACKUP_RECORDS || 'backup_records'
  const PAGE_SIZE = 100
  const sleepFn = options.sleep || sleep
  const restoreRetryDelayMs =
    typeof options.restoreRetryDelayMs === 'number'
      ? options.restoreRetryDelayMs
      : RESTORE_REQUEST_LIMIT_RETRY_DELAY_MS

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
    if (!result.data || !result.data.length) {
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
    if (!result.data || !result.data.length) {
      return null
    }
    return result.data[0]
  }

  async function getSpaceSettings(spaceId) {
    const space = await getSpace(spaceId)
    return (space && typeof space.settings === 'object' && space.settings) || {}
  }

  async function updateSpaceSettings(spaceId, settings = {}) {
    const existing = await getSpace(spaceId)
    if (!existing) {
      return null
    }

    await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
      data: {
        settings
      }
    })

    return {
      ...(existing.settings || {}),
      ...(settings || {})
    }
  }

  async function createRecipeImage(data) {
    const created = await db.collection(RECIPE_IMAGES).add({
      data
    })
    return {
      _id: created._id || data._id,
      ...data
    }
  }

  async function getRecipeImage(spaceId, imageId) {
    const result = await db
      .collection(RECIPE_IMAGES)
      .where({
        _id: imageId,
        spaceId
      })
      .get()
    if (!result.data || !result.data.length) {
      return null
    }
    return result.data[0]
  }

  async function updateRecipeImage(spaceId, imageId, patch) {
    const existing = await getRecipeImage(spaceId, imageId)
    if (!existing) {
      return null
    }

    await db.collection(RECIPE_IMAGES).doc(imageId).update({
      data: patch
    })

    return {
      ...existing,
      ...patch
    }
  }

  async function listRecipes(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(COLLECTIONS.RECIPES, where)
  }

  async function listRecipeTags(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(COLLECTIONS.RECIPE_TAGS, where)
  }

  async function listRecipeImages(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(RECIPE_IMAGES, where)
  }

  async function listPantryItems(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(COLLECTIONS.PANTRY_ITEMS, where)
  }

  async function listMealPlans(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(COLLECTIONS.MEAL_PLANS, where)
  }

  async function listShoppingLists(spaceId, query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    return listAllRecords(COLLECTIONS.SHOPPING_LISTS, where)
  }

  async function listShoppingItems(spaceId, shoppingListId = '', query = {}) {
    const where = {
      spaceId,
      deletedAt: typeof query.deletedAt === 'string' ? query.deletedAt : ''
    }
    if (shoppingListId) {
      where.shoppingListId = shoppingListId
    }
    return listAllRecords(COLLECTIONS.SHOPPING_ITEMS, where)
  }

  async function createBackupRecord(data) {
    const created = await db.collection(BACKUP_RECORDS).add({
      data
    })
    return {
      _id: created._id,
      ...data
    }
  }

  async function listBackupRecords(spaceId) {
    const items = await listAllRecords(BACKUP_RECORDS, { spaceId })
    return items.sort((left, right) =>
      String(right.updatedAt || right.createdAt || '').localeCompare(
        String(left.updatedAt || left.createdAt || '')
      )
    )
  }

  async function clearSpaceCollection(connection, collectionName, spaceId) {
    await connection.collection(collectionName).where({ spaceId }).remove()
  }

  async function addRecord(connection, collectionName, data) {
    const created = await connection.collection(collectionName).add({
      data
    })
    return {
      _id: created._id,
      ...data
    }
  }

  async function runInTransaction(work) {
    if (typeof db.startTransaction !== 'function') {
      throw new Error('Backup restore requires transaction support')
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

  async function runRestoreTransaction(work) {
    let attempt = 0
    while (true) {
      try {
        return await runInTransaction(work)
      } catch (error) {
        if (!isRequestLimitError(error) || attempt >= RESTORE_REQUEST_LIMIT_RETRY_COUNT) {
          if (isRequestLimitError(error)) {
            error.data = {
              ...((error && error.data) || {}),
              requestLimitRetryAttempts: attempt
            }
          }
          throw error
        }
        attempt += 1
        const delay = restoreRetryDelayMs * attempt
        await sleepFn(delay)
      }
    }
  }

  async function runRestoreOperation(work) {
    let attempt = 0
    while (true) {
      try {
        return await work()
      } catch (error) {
        if (!isRequestLimitError(error) || attempt >= RESTORE_REQUEST_LIMIT_RETRY_COUNT) {
          if (isRequestLimitError(error)) {
            error.data = {
              ...((error && error.data) || {}),
              requestLimitRetryAttempts: attempt
            }
          }
          throw error
        }
        attempt += 1
        const delay = restoreRetryDelayMs * attempt
        await sleepFn(delay)
      }
    }
  }

  async function addRecordsForRestore(collectionName, items = []) {
    const records = items || []
    for (let index = 0; index < records.length; index += RESTORE_TRANSACTION_WRITE_LIMIT) {
      const chunk = records.slice(index, index + RESTORE_TRANSACTION_WRITE_LIMIT)
      for (let offset = 0; offset < chunk.length; offset += 1) {
        const item = chunk[offset]
        try {
          await runRestoreOperation(() => addRecord(db, collectionName, item))
        } catch (error) {
          error.data = {
            ...((error && error.data) || {}),
            stage: 'addRecord',
            collectionName,
            itemIndex: index + offset,
            recordId: item && item._id
          }
          throw error
        }
      }
      if (index + RESTORE_TRANSACTION_WRITE_LIMIT < records.length) {
        await sleepFn(restoreRetryDelayMs)
      }
    }
  }

  async function replaceSpaceData(spaceId, payload = {}) {
    const collectionsToClear = [
      COLLECTIONS.RECIPES,
      COLLECTIONS.RECIPE_TAGS,
      RECIPE_IMAGES,
      COLLECTIONS.PANTRY_ITEMS,
      COLLECTIONS.MEAL_PLANS,
      COLLECTIONS.SHOPPING_LISTS,
      COLLECTIONS.SHOPPING_ITEMS
    ]

    for (const collectionName of collectionsToClear) {
      try {
        await runRestoreOperation(() => clearSpaceCollection(db, collectionName, spaceId))
      } catch (error) {
        error.data = {
          ...((error && error.data) || {}),
          stage: 'clearCollection',
          collectionName
        }
        throw error
      }
    }
    await sleepFn(restoreRetryDelayMs)

    const withSpaceId = (items = []) => items.map((item) => ({ ...item, spaceId }))

    await addRecordsForRestore(COLLECTIONS.RECIPES, withSpaceId(payload.recipes))
    await addRecordsForRestore(COLLECTIONS.RECIPE_TAGS, withSpaceId(payload.recipeTags))
    await addRecordsForRestore(RECIPE_IMAGES, withSpaceId(payload.recipeImages))
    await addRecordsForRestore(COLLECTIONS.PANTRY_ITEMS, withSpaceId(payload.pantryItems))
    await addRecordsForRestore(COLLECTIONS.MEAL_PLANS, withSpaceId(payload.mealPlans))
    await addRecordsForRestore(COLLECTIONS.SHOPPING_LISTS, withSpaceId(payload.shoppingLists))
    await addRecordsForRestore(COLLECTIONS.SHOPPING_ITEMS, withSpaceId(payload.shoppingItems))

    if (payload.settings && typeof payload.settings === 'object') {
      try {
        await runRestoreOperation(() =>
          db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
            data: {
              settings: payload.settings
            }
          })
        )
      } catch (error) {
        error.data = {
          ...((error && error.data) || {}),
          stage: 'updateSettings',
          collectionName: COLLECTIONS.SPACES,
          recordId: spaceId
        }
        throw error
      }
    }

    return payload
  }

  return {
    createRecipeImage,
    createBackupRecord,
    findMembership,
    getSpaceSettings,
    getRecipeImage,
    listRecipeImages,
    listRecipeTags,
    listBackupRecords,
    listMealPlans,
    listPantryItems,
    listRecipes,
    listShoppingItems,
    listShoppingLists,
    replaceSpaceData,
    updateSpaceSettings,
    updateRecipeImage
  }
}

function createFileOpsHandler(options = {}) {
  const createContextFn = options.createContext || createContext
  const createRepositoryFn = options.createRepository || createRepository
  const createStorageServiceFn = options.createStorageService || createStorageService
  const prepareFn = options.prepareRecipeImageUpload || prepareRecipeImageUpload
  const confirmFn = options.confirmRecipeImageUpload || confirmRecipeImageUpload
  const discardFn = options.discardRecipeImage || discardRecipeImage
  const deleteFn = options.deleteRecipeImage || deleteRecipeImage
  const exportBackupFn = options.exportSpaceBackup || exportSpaceBackup
  const importBackupFn = options.importSpaceBackup || importSpaceBackup
  const listBackupRecordsFn = options.listBackupRecords || listBackupRecords

  return async function main(event = {}) {
    const action = event.action
    const supportedActions = new Set([
      'prepareRecipeImageUpload',
      'confirmRecipeImageUpload',
      'discardRecipeImage',
      'deleteRecipeImage',
      'exportSpaceBackup',
      'importSpaceBackup',
      'listBackupRecords'
    ])

    try {
      if (!supportedActions.has(action)) {
        return buildErrorResponse('Unsupported action', ERROR_CODES.NOT_FOUND)
      }

      const context = await createContextFn(event)
      if (!context.openid) {
        throw toAppError('Missing current user', ERROR_CODES.UNAUTHORIZED)
      }

      const repository = await createRepositoryFn(context)
      const storageService = createStorageServiceFn(context)
      const membership = await repository.findMembership(event.spaceId, context.openid)
      if (!membership) {
        throw toAppError('SPACE_FORBIDDEN', ERROR_CODES.SPACE_FORBIDDEN)
      }
      if (action === 'importSpaceBackup' && membership.role !== 'owner') {
        throw toAppError('SPACE_FORBIDDEN', ERROR_CODES.SPACE_FORBIDDEN)
      }

      switch (action) {
        case 'prepareRecipeImageUpload':
          return buildOkResponse(await prepareFn(event, context, repository))
        case 'confirmRecipeImageUpload':
          return buildOkResponse(await confirmFn(event, context, repository))
        case 'discardRecipeImage':
          return buildOkResponse(await discardFn(event, context, repository, storageService))
        case 'deleteRecipeImage':
          return buildOkResponse(await deleteFn(event, context, repository, storageService))
        case 'exportSpaceBackup':
          return buildOkResponse(await exportBackupFn(event, context, repository, storageService))
        case 'importSpaceBackup':
          return buildOkResponse(await importBackupFn(event, context, repository, storageService))
        case 'listBackupRecords':
          return buildOkResponse(await listBackupRecordsFn(event, context, repository))
      }
    } catch (error) {
      return normalizeError(error)
    }
  }
}

const defaultHandler = createFileOpsHandler()

module.exports = {
  main: defaultHandler,
  createFileOpsHandler,
  createRepository
}
