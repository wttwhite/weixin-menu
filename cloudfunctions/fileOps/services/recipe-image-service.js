const { ERROR_CODES } = require('../shared/constants/error-codes')

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveNowIso(options = {}) {
  if (typeof options.nowIso === 'function') {
    return options.nowIso()
  }
  return new Date().toISOString()
}

function resolveRandomId(options = {}) {
  if (typeof options.randomId === 'function') {
    return options.randomId()
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function normalizeExt(fileName = '') {
  const matched = /(\.[a-zA-Z0-9]+)$/.exec(fileName || '')
  return matched ? matched[1].toLowerCase() : ''
}

function normalizeRole(imageRole) {
  const role = normalizeId(imageRole).toLowerCase()
  if (!role) {
    return 'gallery'
  }
  return role.replace(/[^a-z0-9_-]/g, '')
}

function normalizeRecipePathKey(recipeId) {
  const normalized = normalizeId(recipeId)
  return normalized || 'draft'
}

function assertSpaceId(spaceId) {
  if (!normalizeId(spaceId)) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }
}

async function prepareRecipeImageUpload(event = {}, context = {}, repository = {}, options = {}) {
  assertSpaceId(event.spaceId)

  const imageId = resolveRandomId(options)
  const uploadSessionId = resolveRandomId(options)
  const imageRole = normalizeRole(event.imageRole)
  const recipeKey = normalizeRecipePathKey(event.recipeId)
  const ext = normalizeExt(event.fileName) || '.jpg'
  const now = resolveNowIso(options)
  const cloudPath = `spaces/${event.spaceId}/recipes/${recipeKey}/images/${imageRole}/${imageId}-${uploadSessionId}${ext}`

  await repository.createRecipeImage({
    _id: imageId,
    spaceId: normalizeId(event.spaceId),
    recipeId: normalizeId(event.recipeId),
    stepId: normalizeId(event.stepId),
    imageRole,
    cloudPath,
    fileId: '',
    mimeType: '',
    fileSize: 0,
    sortOrder: normalizeNumber(event.sortOrder, 0),
    uploadStatus: 'prepared',
    uploadSessionId,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    createdBy: context.openid || '',
    updatedBy: context.openid || '',
    deletedBy: ''
  })

  return {
    imageId,
    uploadSessionId,
    cloudPath
  }
}

async function confirmRecipeImageUpload(event = {}, context = {}, repository = {}, options = {}) {
  assertSpaceId(event.spaceId)
  const imageId = normalizeId(event.imageId)
  const uploadSessionId = normalizeId(event.uploadSessionId)
  const fileId = normalizeId(event.fileId)
  if (!imageId || !uploadSessionId || !fileId) {
    throw toAppError('imageId, uploadSessionId and fileId are required', ERROR_CODES.INVALID_INPUT)
  }

  const existing = await repository.getRecipeImage(event.spaceId, imageId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Recipe image not found', ERROR_CODES.NOT_FOUND)
  }
  if (existing.uploadSessionId !== uploadSessionId) {
    throw toAppError('Upload session mismatch', ERROR_CODES.CONFLICT)
  }

  const now = resolveNowIso(options)
  const updated = await repository.updateRecipeImage(event.spaceId, imageId, {
    recipeId: normalizeId(event.recipeId) || existing.recipeId || '',
    stepId: normalizeId(event.stepId) || existing.stepId || '',
    fileId,
    fileSize: normalizeNumber(event.fileSize, 0),
    mimeType: normalizeId(event.mimeType),
    uploadStatus: 'confirmed',
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    item: updated
  }
}

async function markRecipeImageRemoved(
  event = {},
  context = {},
  repository = {},
  storageService = {},
  options = {},
  mode = 'discarded'
) {
  assertSpaceId(event.spaceId)
  const imageId = normalizeId(event.imageId)
  if (!imageId) {
    throw toAppError('imageId is required', ERROR_CODES.INVALID_INPUT)
  }

  const existing = await repository.getRecipeImage(event.spaceId, imageId)
  if (!existing || existing.deletedAt) {
    if (mode === 'discarded') {
      return {
        imageId,
        discarded: false
      }
    }
    throw toAppError('Recipe image not found', ERROR_CODES.NOT_FOUND)
  }

  if (existing.fileId && storageService && typeof storageService.deleteFile === 'function') {
    await storageService.deleteFile(existing.fileId)
  }

  const now = resolveNowIso(options)
  await repository.updateRecipeImage(event.spaceId, imageId, {
    uploadStatus: mode,
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  if (mode === 'discarded') {
    return {
      imageId,
      discarded: true
    }
  }

  return {
    imageId,
    deleted: true
  }
}

async function discardRecipeImage(event = {}, context = {}, repository = {}, storageService = {}, options = {}) {
  return markRecipeImageRemoved(event, context, repository, storageService, options, 'discarded')
}

async function deleteRecipeImage(event = {}, context = {}, repository = {}, storageService = {}, options = {}) {
  return markRecipeImageRemoved(event, context, repository, storageService, options, 'deleted')
}

module.exports = {
  confirmRecipeImageUpload,
  deleteRecipeImage,
  discardRecipeImage,
  prepareRecipeImageUpload
}
