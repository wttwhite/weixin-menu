const { ERROR_CODES } = require('../shared/constants/error-codes')
const { normalizeRecipeDraft, normalizeRecipeTagDraft } = require('../shared/domain/recipe')

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const DEFAULT_LIST_LIMIT = 100

function normalizeListLimit(limit) {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT
  }
  return Math.min(Math.floor(parsed), DEFAULT_LIST_LIMIT)
}

function validateSpaceId(spaceId) {
  if (!normalizeId(spaceId)) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateRecipeId(recipeId) {
  if (!normalizeId(recipeId)) {
    throw toAppError('recipeId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateTagId(tagId) {
  if (!normalizeId(tagId)) {
    throw toAppError('tagId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateCategoryName(name, fieldName = 'name') {
  if (!normalizeId(name)) {
    throw toAppError(`${fieldName} is required`, ERROR_CODES.INVALID_INPUT)
  }
}

function validateRecipeWrite(recipe) {
  if (!recipe.name) {
    throw toAppError('Recipe name is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateTagWrite(tag) {
  if (!tag.name) {
    throw toAppError('Tag name is required', ERROR_CODES.INVALID_INPUT)
  }
}

function normalizeCategoryName(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getStoredRecipeCategories(space = {}) {
  const settings = space && typeof space.settings === 'object' ? space.settings : {}
  const categories = Array.isArray(settings.recipeCategories) ? settings.recipeCategories : []
  return Array.from(
    new Set(
      categories
        .map((item) => normalizeCategoryName(item))
        .filter(Boolean)
    )
  )
}

function buildRecipeCategoryItems(space = {}, recipes = []) {
  const counts = new Map()
  for (const recipe of recipes || []) {
    const category = normalizeCategoryName(recipe.category)
    if (!category) {
      continue
    }
    counts.set(category, (counts.get(category) || 0) + 1)
  }

  const orderedNames = getStoredRecipeCategories(space)
  for (const categoryName of counts.keys()) {
    if (!orderedNames.includes(categoryName)) {
      orderedNames.push(categoryName)
    }
  }

  return orderedNames.map((name) => ({
    name,
    recipeCount: counts.get(name) || 0,
    deletable: (counts.get(name) || 0) === 0
  }))
}

async function assertRecipeTagIdsValid(spaceId, tagIds = [], repository = {}) {
  const normalizedTagIds = Array.isArray(tagIds) ? tagIds.filter(Boolean) : []
  if (!normalizedTagIds.length) {
    return
  }

  const tags = await repository.listRecipeTags(spaceId, {
    deletedAt: ''
  })
  const activeTagIdSet = new Set((tags || []).map((tag) => tag._id))
  const hasInvalidTagId = normalizedTagIds.some((tagId) => !activeTagIdSet.has(tagId))
  if (hasInvalidTagId) {
    throw toAppError('Invalid recipe tagIds', ERROR_CODES.INVALID_INPUT)
  }
}

function resolveClock(options = {}) {
  if (options.clock && typeof options.clock.now === 'function') {
    return options.clock
  }

  return {
    now: () => new Date()
  }
}

function resolveServerInstant(options = {}) {
  return resolveClock(options).now().toISOString()
}

function mapTagsById(tags = []) {
  return (tags || []).reduce((result, tag) => {
    result[tag._id] = tag
    return result
  }, {})
}

function enrichRecipeWithTags(recipe, tagMap) {
  const tagIds = Array.isArray(recipe.tagIds) ? recipe.tagIds : []
  return {
    ...recipe,
    tags: tagIds.map((tagId) => tagMap[tagId]).filter(Boolean)
  }
}

function normalizeImageRefIds(images = []) {
  return Array.from(
    new Set(
      (Array.isArray(images) ? images : [])
        .map((item) => normalizeId(item && item._id))
        .filter(Boolean)
    )
  )
}

function toCanonicalRecipeImage(image = {}, sortOrder = 0) {
  return {
    _id: image._id,
    imageRole: image.imageRole || 'gallery',
    fileId: image.fileId || '',
    cloudPath: image.cloudPath || '',
    mimeType: image.mimeType || '',
    fileSize: typeof image.fileSize === 'number' ? image.fileSize : 0,
    uploadStatus: 'confirmed',
    sortOrder
  }
}

async function resolveCanonicalRecipeImages(spaceId, targetRecipeId = '', recipe = {}, repository = {}) {
  const requestedImageIds = normalizeImageRefIds(recipe.images || [])
  if (!requestedImageIds.length) {
    return []
  }

  if (typeof repository.listRecipeImagesByIds !== 'function') {
    throw toAppError('Recipe image verification is unavailable', ERROR_CODES.INVALID_INPUT)
  }

  const fetched = await repository.listRecipeImagesByIds(spaceId, requestedImageIds)
  const fetchedMap = new Map((fetched || []).map((item) => [item._id, item]))
  const canonical = requestedImageIds.map((imageId, index) => {
    const matched = fetchedMap.get(imageId)
    if (!matched) {
      return null
    }
    if (matched.deletedAt || matched.uploadStatus !== 'confirmed') {
      return null
    }
    const boundRecipeId = normalizeId(matched.recipeId)
    if (boundRecipeId && boundRecipeId !== targetRecipeId) {
      return null
    }
    return toCanonicalRecipeImage(matched, index + 1)
  })

  if (canonical.some((item) => item === null)) {
    throw toAppError('Invalid recipe images', ERROR_CODES.INVALID_INPUT)
  }

  return canonical
}

async function bindCanonicalImagesToRecipe(
  spaceId,
  recipeId,
  canonicalImages = [],
  context = {},
  repository = {},
  now = ''
) {
  if (!Array.isArray(canonicalImages) || !canonicalImages.length) {
    return
  }
  if (typeof repository.updateRecipeImage !== 'function') {
    return
  }

  for (const image of canonicalImages) {
    await repository.updateRecipeImage(spaceId, image._id, {
      recipeId,
      imageRole: image.imageRole,
      sortOrder: image.sortOrder,
      updatedAt: now,
      updatedBy: context.openid || ''
    })
  }
}

async function cleanupRecipeImagesOnDelete(spaceId, recipeId, context = {}, repository = {}, now = '') {
  let images = []
  if (typeof repository.listRecipeImagesByRecipeId === 'function') {
    images = await repository.listRecipeImagesByRecipeId(spaceId, recipeId)
  }
  const activeImages = (images || []).filter((item) => !item.deletedAt)

  if (typeof repository.updateRecipeImage !== 'function') {
    return activeImages
  }
  for (const image of activeImages) {
    await repository.updateRecipeImage(spaceId, image._id, {
      deletedAt: now,
      deletedBy: context.openid || '',
      updatedAt: now,
      updatedBy: context.openid || ''
    })
  }
  return activeImages
}

async function listRecipes(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const limit = normalizeListLimit(event.limit)

  const [recipes, tags, metadata] = await Promise.all([
    repository.listRecipes(event.spaceId, {
      deletedAt: '',
      limit
    }),
    repository.listRecipeTags(event.spaceId, {
      deletedAt: ''
    }),
    repository.getRecipeListMetadata
      ? repository.getRecipeListMetadata(event.spaceId, {
          deletedAt: ''
        })
      : null
  ])
  const tagMap = mapTagsById(tags)
  const items = (recipes || [])
    .filter((recipe) => !recipe.deletedAt)
    .map((recipe) => enrichRecipeWithTags(recipe, tagMap))
  const total = metadata && typeof metadata.total === 'number' ? metadata.total : items.length
  const hasMore = total > limit
  return {
    items,
    total,
    hasMore,
    limit
  }
}

async function getRecipeDetail(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  validateRecipeId(event.recipeId)

  const recipe = await repository.getRecipe(event.spaceId, event.recipeId)
  if (!recipe || recipe.deletedAt) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }

  const tags = await repository.listRecipeTags(event.spaceId)
  const tagMap = mapTagsById(tags)
  return {
    item: enrichRecipeWithTags(recipe, tagMap)
  }
}

async function createRecipe(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const now = resolveServerInstant(options)
  const recipe = normalizeRecipeDraft(event.recipe || {})
  validateRecipeWrite(recipe)
  const canonicalImages = await resolveCanonicalRecipeImages(event.spaceId, '', recipe, repository)
  const coverImageId = normalizeId(recipe.coverImageId)
  if (coverImageId && !canonicalImages.some((item) => item._id === coverImageId)) {
    throw toAppError('coverImageId is invalid', ERROR_CODES.INVALID_INPUT)
  }
  const { tags: ignoredTags, ...recipeWrite } = recipe
  void ignoredTags
  const recipeCreateData = {
    spaceId: event.spaceId,
    ...recipeWrite,
    images: canonicalImages,
    coverImageId: coverImageId || (canonicalImages[0] ? canonicalImages[0]._id : null),
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    createdBy: context.openid || '',
    updatedBy: context.openid || '',
    deletedBy: ''
  }

  if (typeof repository.createRecipeAtomic === 'function') {
    const created = await repository.createRecipeAtomic(recipeCreateData)
    await bindCanonicalImagesToRecipe(
      event.spaceId,
      created._id,
      canonicalImages,
      context,
      repository,
      now
    )
    return {
      item: created
    }
  }

  await assertRecipeTagIdsValid(event.spaceId, recipe.tagIds, repository)

  const created = await repository.createRecipe(recipeCreateData)
  await bindCanonicalImagesToRecipe(
    event.spaceId,
    created._id,
    canonicalImages,
    context,
    repository,
    now
  )
  return {
    item: created
  }
}

async function updateRecipe(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateRecipeId(event.recipeId)

  const now = resolveServerInstant(options)
  const recipe = normalizeRecipeDraft(event.recipe || {})
  validateRecipeWrite(recipe)
  const canonicalImages = await resolveCanonicalRecipeImages(
    event.spaceId,
    normalizeId(event.recipeId),
    recipe,
    repository
  )
  const coverImageId = normalizeId(recipe.coverImageId)
  if (coverImageId && !canonicalImages.some((item) => item._id === coverImageId)) {
    throw toAppError('coverImageId is invalid', ERROR_CODES.INVALID_INPUT)
  }
  const { tags: ignoredTags, ...recipeWrite } = recipe
  void ignoredTags
  const recipePatch = {
    ...recipeWrite,
    images: canonicalImages,
    coverImageId: coverImageId || (canonicalImages[0] ? canonicalImages[0]._id : null),
    updatedAt: now,
    updatedBy: context.openid || ''
  }

  if (typeof repository.updateRecipeAtomic === 'function') {
    const updated = await repository.updateRecipeAtomic(event.spaceId, event.recipeId, recipePatch)
    if (!updated) {
      throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
    }
    await bindCanonicalImagesToRecipe(
      event.spaceId,
      event.recipeId,
      canonicalImages,
      context,
      repository,
      now
    )
    return {
      item: updated
    }
  }

  const existing = await repository.getRecipe(event.spaceId, event.recipeId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }

  await assertRecipeTagIdsValid(event.spaceId, recipe.tagIds, repository)

  const updated = await repository.updateRecipe(event.spaceId, event.recipeId, recipePatch)

  if (!updated) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }
  await bindCanonicalImagesToRecipe(
    event.spaceId,
    event.recipeId,
    canonicalImages,
    context,
    repository,
    now
  )

  return {
    item: updated
  }
}

async function deleteRecipe(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateRecipeId(event.recipeId)

  const existing = await repository.getRecipe(event.spaceId, event.recipeId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveServerInstant(options)
  const cleanedImages = await cleanupRecipeImagesOnDelete(
    event.spaceId,
    event.recipeId,
    context,
    repository,
    now
  )
  const deleted = await repository.updateRecipe(event.spaceId, event.recipeId, {
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  })
  if (!deleted) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }
  const cloudFiles = (cleanedImages || [])
    .filter((item) => item.uploadStatus === 'confirmed' && item.fileId)
    .map((item) => item.fileId)
  if (cloudFiles.length && typeof repository.deleteCloudFiles === 'function') {
    await repository.deleteCloudFiles(cloudFiles)
  }

  return {
    recipeId: event.recipeId,
    deleted: true
  }
}

async function listRecipeTags(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const tags = await repository.listRecipeTags(event.spaceId)
  return {
    items: (tags || []).filter((tag) => !tag.deletedAt)
  }
}

async function listRecipeCategories(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const [space, recipes] = await Promise.all([
    repository.getSpace ? repository.getSpace(event.spaceId) : null,
    repository.listAllRecipes
      ? repository.listAllRecipes(event.spaceId, { deletedAt: '' })
      : repository.listRecipes(event.spaceId, { deletedAt: '' })
  ])

  return {
    items: buildRecipeCategoryItems(space || {}, recipes || [])
  }
}

async function createRecipeCategory(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const name = normalizeCategoryName(event.name)
  validateCategoryName(name)

  const now = resolveServerInstant(options)
  const [space, recipes] = await Promise.all([
    repository.getSpace ? repository.getSpace(event.spaceId) : null,
    repository.listAllRecipes
      ? repository.listAllRecipes(event.spaceId, { deletedAt: '' })
      : repository.listRecipes(event.spaceId, { deletedAt: '' })
  ])
  const existingItems = buildRecipeCategoryItems(space || {}, recipes || [])
  if (existingItems.some((item) => item.name === name)) {
    throw toAppError('Recipe category already exists', ERROR_CODES.CONFLICT)
  }

  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  const recipeCategories = getStoredRecipeCategories(space || {}).concat(name)
  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      recipeCategories
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    item: {
      name,
      recipeCount: 0,
      deletable: true
    }
  }
}

async function updateRecipeCategory(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const previousName = normalizeCategoryName(event.previousName)
  const name = normalizeCategoryName(event.name)
  validateCategoryName(previousName, 'previousName')
  validateCategoryName(name)

  const now = resolveServerInstant(options)
  const [space, recipes] = await Promise.all([
    repository.getSpace ? repository.getSpace(event.spaceId) : null,
    repository.listAllRecipes
      ? repository.listAllRecipes(event.spaceId, { deletedAt: '' })
      : repository.listRecipes(event.spaceId, { deletedAt: '' })
  ])
  const existingItems = buildRecipeCategoryItems(space || {}, recipes || [])
  const currentItem = existingItems.find((item) => item.name === previousName)
  if (!currentItem) {
    throw toAppError('Recipe category not found', ERROR_CODES.NOT_FOUND)
  }
  if (previousName !== name && existingItems.some((item) => item.name === name)) {
    throw toAppError('Recipe category already exists', ERROR_CODES.CONFLICT)
  }

  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  const storedCategories = getStoredRecipeCategories(space || {})
  const nextCategories = storedCategories.includes(previousName)
    ? storedCategories.map((item) => (item === previousName ? name : item))
    : storedCategories.concat(name)

  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      recipeCategories: Array.from(new Set(nextCategories))
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  if (previousName !== name) {
    if (typeof repository.renameRecipeCategory === 'function') {
      await repository.renameRecipeCategory(event.spaceId, previousName, name, {
        updatedAt: now,
        updatedBy: context.openid || ''
      })
    } else {
      for (const recipe of (recipes || []).filter((item) => normalizeCategoryName(item.category) === previousName)) {
        await repository.updateRecipe(event.spaceId, recipe._id, {
          category: name,
          updatedAt: now,
          updatedBy: context.openid || ''
        })
      }
    }
  }

  return {
    item: {
      name,
      recipeCount: currentItem.recipeCount,
      deletable: currentItem.recipeCount === 0
    }
  }
}

async function deleteRecipeCategory(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const name = normalizeCategoryName(event.name)
  validateCategoryName(name)

  const now = resolveServerInstant(options)
  const [space, recipes] = await Promise.all([
    repository.getSpace ? repository.getSpace(event.spaceId) : null,
    repository.listAllRecipes
      ? repository.listAllRecipes(event.spaceId, { deletedAt: '' })
      : repository.listRecipes(event.spaceId, { deletedAt: '' })
  ])
  const existingItems = buildRecipeCategoryItems(space || {}, recipes || [])
  const currentItem = existingItems.find((item) => item.name === name)
  if (!currentItem) {
    throw toAppError('Recipe category not found', ERROR_CODES.NOT_FOUND)
  }
  if (currentItem.recipeCount > 0) {
    throw toAppError('Recipe category is still referenced by recipes', ERROR_CODES.CONFLICT)
  }

  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  const nextCategories = getStoredRecipeCategories(space || {}).filter((item) => item !== name)
  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      recipeCategories: nextCategories
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    deleted: true,
    name
  }
}

async function createRecipeTag(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const now = resolveServerInstant(options)
  const tag = normalizeRecipeTagDraft(event.tag || {})
  validateTagWrite(tag)

  const created = await repository.createRecipeTag({
    spaceId: event.spaceId,
    ...tag,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    createdBy: context.openid || '',
    updatedBy: context.openid || '',
    deletedBy: ''
  })

  return {
    item: created
  }
}

async function deleteRecipeTag(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateTagId(event.tagId)

  const now = resolveServerInstant(options)
  const recipeTagDeletePatch = {
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  }

  if (typeof repository.deleteRecipeTagAtomic === 'function') {
    const deleted = await repository.deleteRecipeTagAtomic(
      event.spaceId,
      event.tagId,
      recipeTagDeletePatch
    )
    if (!deleted) {
      throw toAppError('Recipe tag not found', ERROR_CODES.NOT_FOUND)
    }

    return {
      tagId: event.tagId,
      deleted: true
    }
  }

  const existing = await repository.getRecipeTag(event.spaceId, event.tagId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Recipe tag not found', ERROR_CODES.NOT_FOUND)
  }
  let hasReferencedRecipe = false
  if (typeof repository.isRecipeTagInUse === 'function') {
    hasReferencedRecipe = await repository.isRecipeTagInUse(event.spaceId, event.tagId)
  }
  if (hasReferencedRecipe) {
    throw toAppError('Recipe tag is still referenced by recipes', ERROR_CODES.CONFLICT)
  }

  const deleted = await repository.updateRecipeTag(event.spaceId, event.tagId, recipeTagDeletePatch)
  if (!deleted) {
    throw toAppError('Recipe tag not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    tagId: event.tagId,
    deleted: true
  }
}

module.exports = {
  createRecipe,
  createRecipeCategory,
  createRecipeTag,
  deleteRecipe,
  deleteRecipeCategory,
  deleteRecipeTag,
  getRecipeDetail,
  listRecipeCategories,
  listRecipeTags,
  listRecipes,
  updateRecipeCategory,
  updateRecipe
}
