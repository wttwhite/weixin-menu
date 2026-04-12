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
const { createStorageService } = require('./services/storage-service')

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

function createRepository(options = {}) {
  const cloudSdk = getCloudSdk(options.cloudSdk)
  ensureCloudInit(cloudSdk)
  const db = options.db || cloudSdk.database()
  const RECIPE_IMAGES = COLLECTIONS.RECIPE_IMAGES || 'recipe_images'

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

  return {
    createRecipeImage,
    findMembership,
    getRecipeImage,
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

  return async function main(event = {}) {
    const action = event.action
    const supportedActions = new Set([
      'prepareRecipeImageUpload',
      'confirmRecipeImageUpload',
      'discardRecipeImage',
      'deleteRecipeImage'
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

      switch (action) {
        case 'prepareRecipeImageUpload':
          return buildOkResponse(await prepareFn(event, context, repository))
        case 'confirmRecipeImageUpload':
          return buildOkResponse(await confirmFn(event, context, repository))
        case 'discardRecipeImage':
          return buildOkResponse(await discardFn(event, context, repository, storageService))
        case 'deleteRecipeImage':
          return buildOkResponse(await deleteFn(event, context, repository, storageService))
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
