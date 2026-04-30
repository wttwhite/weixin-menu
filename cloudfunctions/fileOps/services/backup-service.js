const JSZip = require('jszip')
const { BACKUP_VERSION, validateBackupPayload } = require('../shared/domain/backup')
const { ERROR_CODES } = require('../shared/constants/error-codes')

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function normalizeErrorDetail(value) {
  if (value === undefined || value === null) {
    return ''
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch (error) {
    return String(value)
  }
}

function buildRestoreFailureData(error = {}) {
  const sourceData =
    error && error.data && typeof error.data === 'object' && !Array.isArray(error.data)
      ? error.data
      : {}
  const details = {
    ...sourceData,
    causeMessage: normalizeErrorDetail(error && error.message),
    causeCode: normalizeErrorDetail(error && error.code)
  }

  const segments = []
  if (details.stage) {
    segments.push(`阶段=${details.stage}`)
  }
  if (details.collectionName) {
    segments.push(`集合=${details.collectionName}`)
  }
  if (details.itemIndex !== undefined && details.itemIndex !== null) {
    segments.push(`序号=${details.itemIndex}`)
  }
  if (details.causeCode) {
    segments.push(`代码=${details.causeCode}`)
  }
  if (details.causeMessage) {
    segments.push(`原因=${details.causeMessage}`)
  }

  details.restoreMessage = segments.length
    ? `恢复失败: ${segments.join('; ')}`
    : '恢复失败: 未返回具体错误'
  return details
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeFilePath(value) {
  return normalizeId(value).replace(/\\/g, '/')
}

function normalizeStringList(value = []) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(
    new Set(
      value
        .map((item) => normalizeId(item))
        .filter(Boolean)
    )
  )
}

function normalizeDateOnly(value) {
  const text = normalizeId(value)
  if (!text) {
    return ''
  }

  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/)
  return match ? match[1] : ''
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
  const path = normalizeId(image.cloudPath || image.backupFilePath || image.filePath)
  const extMatch = path.match(/(\.[a-z0-9]+)$/i)
  const ext = extMatch ? extMatch[1].toLowerCase() : '.bin'
  const recipeId = normalizeId(image.recipeId) || 'imported'
  const role = normalizeId(image.imageRole) || 'gallery'
  return `spaces/${spaceId}/recipes/${recipeId}/images/${role}/${image._id}${ext}`
}

function getRecordId(item = {}) {
  return normalizeId(item._id || item.id)
}

function withActiveDeleteMarker(item = {}) {
  return Object.prototype.hasOwnProperty.call(item, 'deletedAt')
    ? item
    : {
        ...item,
        deletedAt: ''
      }
}

function dedupeItemsById(items = []) {
  const map = new Map()
  for (const item of items || []) {
    const id = getRecordId(item)
    if (!id) {
      continue
    }
    map.set(id, {
      ...withActiveDeleteMarker(item),
      _id: id
    })
  }
  return Array.from(map.values())
}

function normalizeRecipeTagShape(tag = {}) {
  const _id = getRecordId(tag)
  return _id
    ? {
        ...withActiveDeleteMarker(tag),
        _id
      }
    : null
}

function normalizeRecipeImageShape(image = {}, fallbackRecipeId = '') {
  const _id = getRecordId(image)
  return _id
    ? {
        ...withActiveDeleteMarker(image),
        _id,
        recipeId: normalizeId(image.recipeId) || fallbackRecipeId,
        cloudPath: normalizeId(image.cloudPath || image.filePath),
        backupFilePath: normalizeFilePath(image.backupFilePath || image.filePath),
        uploadStatus: normalizeId(image.uploadStatus) || 'confirmed'
      }
    : null
}

function normalizeRecipeShape(recipe = {}) {
  const _id = getRecordId(recipe)
  if (!_id) {
    return null
  }

  const tags = (Array.isArray(recipe.tags) ? recipe.tags : [])
    .map((item) => normalizeRecipeTagShape(item))
    .filter(Boolean)
  const images = (Array.isArray(recipe.images) ? recipe.images : [])
    .map((item) => normalizeRecipeImageShape(item, _id))
    .filter(Boolean)

  return {
    ...withActiveDeleteMarker(recipe),
    _id,
    coverImageId: normalizeId(recipe.coverImageId),
    tagIds: Array.isArray(recipe.tagIds) && recipe.tagIds.length
      ? recipe.tagIds.map((tagId) => normalizeId(tagId)).filter(Boolean)
      : tags.map((tag) => tag._id),
    tags,
    images
  }
}

function normalizePantryShape(item = {}) {
  const _id = getRecordId(item)
  return _id
    ? {
        ...withActiveDeleteMarker(item),
        _id,
        productionDate: normalizeDateOnly(item.productionDate),
        expirationDate: normalizeDateOnly(item.expirationDate),
        openedDate: normalizeDateOnly(item.openedDate)
      }
    : null
}

function normalizeMealPlanShape(plan = {}) {
  const _id = getRecordId(plan)
  if (!_id) {
    return null
  }

  return {
    ...withActiveDeleteMarker(plan),
    _id,
    recipes: (Array.isArray(plan.recipes) ? plan.recipes : []).map((entry) => ({
      ...entry,
      _id: getRecordId(entry)
    }))
  }
}

function normalizeShoppingItemShape(item = {}, fallbackShoppingListId = '') {
  const _id = getRecordId(item)
  return _id
    ? {
        ...withActiveDeleteMarker(item),
        _id,
        shoppingListId: normalizeId(item.shoppingListId) || fallbackShoppingListId,
        isChecked: item.isChecked === true || item.checked === true
      }
    : null
}

function normalizeShoppingListShape(list = {}) {
  const _id = getRecordId(list)
  if (!_id) {
    return null
  }

  const items = (Array.isArray(list.items) ? list.items : [])
    .map((item) => normalizeShoppingItemShape(item, _id))
    .filter(Boolean)

  return {
    ...withActiveDeleteMarker(list),
    _id,
    items
  }
}

function normalizeImportedSettings(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {}
  }

  const next = { ...settings }
  delete next.customCategories

  const legacyRecipeCategories = normalizeStringList(settings.customCategories)
  const currentRecipeCategories = normalizeStringList(settings.recipeCategories)
  if (legacyRecipeCategories.length || currentRecipeCategories.length) {
    next.recipeCategories = legacyRecipeCategories.length
      ? legacyRecipeCategories
      : currentRecipeCategories
  }

  if (Object.prototype.hasOwnProperty.call(settings, 'pantryCategories')) {
    next.pantryCategories = normalizeStringList(settings.pantryCategories)
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'pantryLocations')) {
    next.pantryLocations = normalizeStringList(settings.pantryLocations)
  }

  return next
}

function normalizeImportedBackupPayload(payload = {}) {
  const recipes = (Array.isArray(payload.recipes) ? payload.recipes : [])
    .map((recipe) => normalizeRecipeShape(recipe))
    .filter(Boolean)
  const recipeTags = dedupeItemsById(
    recipes
      .flatMap((recipe) => recipe.tags || [])
      .concat(
        (Array.isArray(payload.recipeTags) ? payload.recipeTags : [])
          .map((item) => normalizeRecipeTagShape(item))
          .filter(Boolean)
      )
  )
  const recipeImages = dedupeItemsById(
    recipes
      .flatMap((recipe) => recipe.images || [])
      .concat(
        (Array.isArray(payload.recipeImages) ? payload.recipeImages : [])
          .map((item) => normalizeRecipeImageShape(item))
          .filter(Boolean)
      )
  )
  const pantryItems = (Array.isArray(payload.pantryItems) ? payload.pantryItems : [])
    .map((item) => normalizePantryShape(item))
    .filter(Boolean)
  const mealPlans = (Array.isArray(payload.mealPlans) ? payload.mealPlans : [])
    .map((plan) => normalizeMealPlanShape(plan))
    .filter(Boolean)
  const shoppingListsWithItems = (Array.isArray(payload.shoppingLists) ? payload.shoppingLists : [])
    .map((list) => normalizeShoppingListShape(list))
    .filter(Boolean)
  const shoppingLists = shoppingListsWithItems.map((list) => {
    const next = { ...list }
    delete next.items
    return next
  })
  const shoppingItems = dedupeItemsById(
    shoppingListsWithItems
      .flatMap((list) => list.items || [])
      .concat(
        (Array.isArray(payload.shoppingItems) ? payload.shoppingItems : [])
          .map((item) => normalizeShoppingItemShape(item))
          .filter(Boolean)
      )
  )

  return {
    ...payload,
    recipes,
    recipeTags,
    recipeImages,
    pantryItems,
    mealPlans,
    shoppingLists,
    shoppingItems,
    settings: normalizeImportedSettings(payload.settings || {})
  }
}

function getBackupZipPathForImage(image = {}) {
  const backupFilePath = normalizeFilePath(image.backupFilePath || image.filePath)
  if (backupFilePath) {
    return `files/${backupFilePath.replace(/^files\//, '')}`
  }
  return normalizeImageFileName(image)
}

function shouldImportRecipeImageFile(image = {}) {
  if (!image || image.deletedAt || image.isDeleted === true) {
    return false
  }

  const uploadStatus = normalizeId(image.uploadStatus)
  return uploadStatus === 'confirmed' || uploadStatus === 'ready'
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

function stripBackupOnlyImageFields(image = {}) {
  const next = { ...image }
  delete next.backupFilePath
  delete next.filePath
  return next
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
    payload = normalizeImportedBackupPayload(payload)

    const remappedPayload = remapImportedPayload(payload, options)
    const importedRecipeImages = []
    for (let index = 0; index < (payload.recipeImages || []).length; index += 1) {
      const sourceImage = payload.recipeImages[index]
      const remappedImage = remappedPayload.recipeImages[index]
      if (!shouldImportRecipeImageFile(sourceImage)) {
        importedRecipeImages.push(remappedImage)
        continue
      }
      const backupFile = zip.file(getBackupZipPathForImage(sourceImage))
      if (!backupFile) {
        throw toAppError('Backup image file is missing', ERROR_CODES.BACKUP_FILE_MISSING)
      }
      importedRecipeImages.push(remappedImage)
    }

    for (let index = 0; index < importedRecipeImages.length; index += 1) {
      const sourceImage = (payload.recipeImages || [])[index]
      const image = importedRecipeImages[index]
      if (!shouldImportRecipeImageFile(sourceImage)) {
        continue
      }
      const backupFile = zip.file(getBackupZipPathForImage(sourceImage))
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
        ...stripBackupOnlyImageFields(image),
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
      throw toAppError(
        'Backup restore failed',
        ERROR_CODES.BACKUP_RESTORE_FAILED,
        buildRestoreFailureData(error)
      )
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
