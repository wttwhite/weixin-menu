const JSZip = require('jszip')
const { BACKUP_VERSION, validateBackupPayload } = require('../shared/domain/backup')
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

function resolveNowIso(options = {}) {
  if (typeof options.nowIso === 'function') {
    return options.nowIso()
  }
  return new Date().toISOString()
}

function buildBackupFileName(nowIso) {
  const safe = nowIso.replace(/[:.]/g, '-')
  return `space-backup-${safe}.zip`
}

function normalizeImageFileName(image = {}) {
  const path = normalizeId(image.cloudPath)
  const extMatch = path.match(/(\.[a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : '.bin'
  return `files/recipe-images/${image._id}${ext}`
}

function resolveRandomId(options = {}) {
  if (typeof options.randomId === 'function') {
    return options.randomId()
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

function buildImportedImageCloudPath(spaceId, image = {}) {
  const path = normalizeId(image.cloudPath)
  const extMatch = path.match(/(\.[a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : '.bin'
  const recipeId = normalizeId(image.recipeId) || 'imported'
  const role = normalizeId(image.imageRole) || 'gallery'
  return `spaces/${spaceId}/recipes/${recipeId}/images/${role}/${image._id}${ext}`
}

function buildIdMap(items = [], options = {}) {
  const map = new Map()
  for (const item of items || []) {
    if (!item || !item._id) {
      continue
    }
    map.set(item._id, resolveRandomId(options))
  }
  return map
}

function remapImportedPayload(payload = {}, options = {}) {
  const recipeIdMap = buildIdMap(payload.recipes || [], options)
  const recipeTagIdMap = buildIdMap(payload.recipeTags || [], options)
  const recipeImageIdMap = buildIdMap(payload.recipeImages || [], options)
  const mealPlanIdMap = buildIdMap(payload.mealPlans || [], options)
  const shoppingListIdMap = buildIdMap(payload.shoppingLists || [], options)
  const shoppingItemIdMap = buildIdMap(payload.shoppingItems || [], options)

  const recipeTags = (payload.recipeTags || []).map((item) => ({
    ...item,
    _id: recipeTagIdMap.get(item._id) || item._id
  }))

  const recipeImages = (payload.recipeImages || []).map((item) => ({
    ...item,
    _id: recipeImageIdMap.get(item._id) || item._id,
    recipeId: recipeIdMap.get(item.recipeId) || item.recipeId
  }))

  const recipes = (payload.recipes || []).map((item) => ({
    ...item,
    _id: recipeIdMap.get(item._id) || item._id,
    coverImageId: recipeImageIdMap.get(item.coverImageId) || item.coverImageId || null,
    tagIds: (item.tagIds || []).map((tagId) => recipeTagIdMap.get(tagId) || tagId),
    images: (item.images || [])
      .map((image) => {
        const mappedId = recipeImageIdMap.get(image._id) || image._id
        return recipeImages.find((candidate) => candidate._id === mappedId) || {
          ...image,
          _id: mappedId
        }
      })
  }))

  const mealPlans = (payload.mealPlans || []).map((item) => ({
    ...item,
    _id: mealPlanIdMap.get(item._id) || item._id,
    recipes: (item.recipes || []).map((entry) => ({
      ...entry,
      recipeId: recipeIdMap.get(entry.recipeId) || entry.recipeId,
      recipe: entry.recipe
        ? {
            ...entry.recipe,
            _id: recipeIdMap.get(entry.recipe._id) || entry.recipe._id
          }
        : entry.recipe
    }))
  }))

  const shoppingLists = (payload.shoppingLists || []).map((item) => ({
    ...item,
    _id: shoppingListIdMap.get(item._id) || item._id
  }))

  const shoppingItems = (payload.shoppingItems || []).map((item) => ({
    ...item,
    _id: shoppingItemIdMap.get(item._id) || item._id,
    shoppingListId: shoppingListIdMap.get(item.shoppingListId) || item.shoppingListId,
    recipeId: recipeIdMap.get(item.recipeId) || item.recipeId,
    mealPlanId: mealPlanIdMap.get(item.mealPlanId) || item.mealPlanId
  }))

  return {
    recipes,
    recipeTags,
    recipeImages,
    pantryItems: payload.pantryItems || [],
    mealPlans,
    shoppingLists,
    shoppingItems
  }
}

async function buildBackupPayload(spaceId, repository, nowIso) {
  const [recipes, recipeTags, recipeImages, pantryItems, mealPlans, shoppingLists, settings] = await Promise.all([
    repository.listRecipes(spaceId, { deletedAt: '' }),
    repository.listRecipeTags(spaceId, { deletedAt: '' }),
    repository.listRecipeImages(spaceId, { deletedAt: '' }),
    repository.listPantryItems(spaceId, { deletedAt: '' }),
    repository.listMealPlans(spaceId, { deletedAt: '' }),
    repository.listShoppingLists(spaceId, { deletedAt: '' }),
    typeof repository.getSpaceSettings === 'function'
      ? repository.getSpaceSettings(spaceId)
      : {}
  ])

  const shoppingItems = []
  for (const list of shoppingLists || []) {
    const items = await repository.listShoppingItems(spaceId, list._id, { deletedAt: '' })
    shoppingItems.push(...(items || []))
  }

  return {
    version: BACKUP_VERSION,
    exportTime: nowIso,
    recipes: recipes || [],
    recipeTags: recipeTags || [],
    recipeImages: (recipeImages || []).filter((image) => !image.deletedAt && image.uploadStatus === 'confirmed'),
    pantryItems: pantryItems || [],
    mealPlans: mealPlans || [],
    shoppingLists: shoppingLists || [],
    shoppingItems,
    settings: settings || {}
  }
}

async function exportSpaceBackup(event = {}, context = {}, repository = {}, storageService = {}, options = {}) {
  const spaceId = normalizeId(event.spaceId)
  if (!spaceId) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }

  const nowIso = resolveNowIso(options)
  let payload
  try {
    payload = await buildBackupPayload(spaceId, repository, nowIso)
  } catch (error) {
    throw toAppError('Backup export failed', ERROR_CODES.BACKUP_EXPORT_FAILED)
  }
  const zip = new JSZip()
  zip.file('backup.json', JSON.stringify(payload))

  for (const image of payload.recipeImages || []) {
    if (!image || image.deletedAt || image.uploadStatus !== 'confirmed' || !image.fileId) {
      continue
    }
    try {
      const buffer = await storageService.downloadFile(image.fileId)
      zip.file(normalizeImageFileName(image), buffer)
    } catch (error) {
      throw toAppError('Backup export failed', ERROR_CODES.BACKUP_EXPORT_FAILED)
    }
  }

  const fileName = buildBackupFileName(nowIso)
  let buffer
  try {
    buffer = await zip.generateAsync({ type: 'nodebuffer' })
  } catch (error) {
    throw toAppError('Backup export failed', ERROR_CODES.BACKUP_EXPORT_FAILED)
  }
  let upload
  try {
    upload = await storageService.uploadBuffer({
      cloudPath: `spaces/${spaceId}/backup/${fileName}`,
      buffer
    })
  } catch (error) {
    throw toAppError('Backup export failed', ERROR_CODES.BACKUP_EXPORT_FAILED)
  }

  let record
  try {
    record = await repository.createBackupRecord({
      spaceId,
      type: 'export',
      status: 'completed',
      fileId: upload.fileId,
      cloudPath: upload.cloudPath,
      fileName,
      updatedAt: nowIso,
      createdAt: nowIso,
      createdBy: context.openid || '',
      summary: {
        recipes: payload.recipes.length,
        recipeTags: payload.recipeTags.length,
        recipeImages: payload.recipeImages.length,
        pantryItems: payload.pantryItems.length,
        mealPlans: payload.mealPlans.length,
        shoppingLists: payload.shoppingLists.length,
        shoppingItems: payload.shoppingItems.length
      }
    })
  } catch (error) {
    if (storageService && typeof storageService.deleteFile === 'function') {
      try {
        await storageService.deleteFile(upload.fileId)
      } catch (cleanupError) {
        void cleanupError
      }
    }
    throw toAppError('Backup export failed', ERROR_CODES.BACKUP_EXPORT_FAILED)
  }

  return {
    fileId: upload.fileId,
    cloudPath: upload.cloudPath,
    fileName,
    recordId: record._id,
    summary: record.summary
  }
}

async function importSpaceBackup(event = {}, context = {}, repository = {}, storageService = {}, options = {}) {
  const spaceId = normalizeId(event.spaceId)
  const tempFileId = normalizeId(event.tempFileId)
  if (!spaceId || !tempFileId) {
    throw toAppError('spaceId and tempFileId are required', ERROR_CODES.INVALID_INPUT)
  }

  const uploadedImportedFileIds = []
  let summary = null
  let restoreCompleted = false

  try {
    let zip
    try {
      zip = await JSZip.loadAsync(await storageService.downloadFile(tempFileId))
    } catch (error) {
      throw toAppError('Invalid backup zip', ERROR_CODES.BACKUP_IMPORT_INVALID)
    }

    const backupJsonFile = zip.file('backup.json')
    if (!backupJsonFile) {
      throw toAppError('backup.json is required', ERROR_CODES.BACKUP_IMPORT_INVALID)
    }

    let payload
    try {
      payload = JSON.parse(await backupJsonFile.async('string'))
    } catch (error) {
      throw toAppError('Invalid backup payload', ERROR_CODES.BACKUP_IMPORT_INVALID)
    }
    if (payload && payload.version && payload.version !== BACKUP_VERSION) {
      throw toAppError('Unsupported backup version', ERROR_CODES.BACKUP_VERSION_UNSUPPORTED)
    }
    if (!validateBackupPayload(payload)) {
      throw toAppError('Invalid backup payload', ERROR_CODES.BACKUP_IMPORT_INVALID)
    }

    const remappedPayload = remapImportedPayload(payload, options)
    const importedRecipeImages = []
    for (let index = 0; index < (payload.recipeImages || []).length; index += 1) {
      const sourceImage = payload.recipeImages[index]
      const remappedImage = remappedPayload.recipeImages[index]
      if (!sourceImage || sourceImage.deletedAt || sourceImage.uploadStatus !== 'confirmed') {
        importedRecipeImages.push(remappedImage)
        continue
      }
      const backupFile = zip.file(normalizeImageFileName(sourceImage))
      if (!backupFile) {
        throw toAppError('Backup image file is missing', ERROR_CODES.BACKUP_FILE_MISSING)
      }
      importedRecipeImages.push(remappedImage)
    }

    for (let index = 0; index < importedRecipeImages.length; index += 1) {
      const sourceImage = (payload.recipeImages || [])[index]
      const image = importedRecipeImages[index]
      if (!sourceImage || sourceImage.deletedAt || sourceImage.uploadStatus !== 'confirmed') {
        continue
      }
      const backupFile = zip.file(normalizeImageFileName(sourceImage))
      const buffer = await backupFile.async('nodebuffer')
      let upload
      try {
        upload = await storageService.uploadBuffer({
          cloudPath: buildImportedImageCloudPath(spaceId, image),
          buffer
        })
      } catch (error) {
        throw toAppError('Backup restore failed', ERROR_CODES.BACKUP_RESTORE_FAILED)
      }
      uploadedImportedFileIds.push(upload.fileId)
      importedRecipeImages[index] = {
        ...image,
        fileId: upload.fileId,
        cloudPath: upload.cloudPath,
        uploadStatus: 'confirmed'
      }
    }

    const importedRecipes = (remappedPayload.recipes || []).map((recipe) => {
      const images = (Array.isArray(recipe.images) ? recipe.images : [])
        .map((imageRef) => importedRecipeImages.find((image) => image && image._id === imageRef._id))
        .filter(Boolean)
      const coverImageId =
        images.some((image) => image._id === recipe.coverImageId)
          ? recipe.coverImageId
          : (images[0] && images[0]._id) || null
      return {
        ...recipe,
        images,
        coverImageId
      }
    })

    try {
      await repository.replaceSpaceData(spaceId, {
        recipes: importedRecipes,
        recipeTags: remappedPayload.recipeTags || [],
        recipeImages: importedRecipeImages,
        pantryItems: remappedPayload.pantryItems || [],
        mealPlans: remappedPayload.mealPlans || [],
        shoppingLists: remappedPayload.shoppingLists || [],
        shoppingItems: remappedPayload.shoppingItems || [],
        settings: payload.settings || {}
      })
    } catch (error) {
      throw toAppError(error.message || 'Backup restore failed', ERROR_CODES.BACKUP_RESTORE_FAILED)
    }

    restoreCompleted = true
    const nowIso = resolveNowIso(options)
      summary = {
        recipes: importedRecipes.length,
        recipeTags: (remappedPayload.recipeTags || []).length,
        recipeImages: importedRecipeImages.length,
        pantryItems: (remappedPayload.pantryItems || []).length,
        mealPlans: (remappedPayload.mealPlans || []).length,
        shoppingLists: (remappedPayload.shoppingLists || []).length,
        shoppingItems: (remappedPayload.shoppingItems || []).length
      }

    try {
      await repository.createBackupRecord({
        spaceId,
        type: 'import',
        status: 'completed',
        fileId: '',
        cloudPath: '',
        fileName: '',
        updatedAt: nowIso,
        createdAt: nowIso,
        createdBy: context.openid || '',
        summary
      })
    } catch (error) {
      void error
    }

    return {
      summary
    }
  } finally {
    if (!restoreCompleted && storageService && typeof storageService.deleteFile === 'function') {
      for (const fileId of uploadedImportedFileIds) {
        try {
          await storageService.deleteFile(fileId)
        } catch (error) {
          void error
        }
      }
    }
    if (storageService && typeof storageService.deleteFile === 'function') {
      try {
        await storageService.deleteFile(tempFileId)
      } catch (error) {
        void error
      }
    }
  }
}

async function listBackupRecords(event = {}, context = {}, repository = {}) {
  const spaceId = normalizeId(event.spaceId)
  if (!spaceId) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }

  const items = await repository.listBackupRecords(spaceId)
  return {
    items: (items || []).sort((left, right) =>
      String(right.updatedAt || right.createdAt || '').localeCompare(
        String(left.updatedAt || left.createdAt || '')
      )
    )
  }
}

module.exports = {
  exportSpaceBackup,
  importSpaceBackup,
  listBackupRecords
}
