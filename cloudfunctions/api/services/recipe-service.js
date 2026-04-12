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

async function listRecipes(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)

  const [recipes, tags] = await Promise.all([
    repository.listRecipes(event.spaceId),
    repository.listRecipeTags(event.spaceId)
  ])
  const tagMap = mapTagsById(tags)
  return {
    items: (recipes || [])
      .filter((recipe) => !recipe.deletedAt)
      .map((recipe) => enrichRecipeWithTags(recipe, tagMap))
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
  await assertRecipeTagIdsValid(event.spaceId, recipe.tagIds, repository)
  const { tags: ignoredTags, ...recipeWrite } = recipe
  void ignoredTags

  const created = await repository.createRecipe({
    spaceId: event.spaceId,
    ...recipeWrite,
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

async function updateRecipe(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateRecipeId(event.recipeId)

  const existing = await repository.getRecipe(event.spaceId, event.recipeId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveServerInstant(options)
  const recipe = normalizeRecipeDraft(event.recipe || {})
  validateRecipeWrite(recipe)
  await assertRecipeTagIdsValid(event.spaceId, recipe.tagIds, repository)
  const { tags: ignoredTags, ...recipeWrite } = recipe
  void ignoredTags

  const updated = await repository.updateRecipe(event.spaceId, event.recipeId, {
    ...recipeWrite,
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  if (!updated) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }

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
  const deleted = await repository.updateRecipe(event.spaceId, event.recipeId, {
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  })
  if (!deleted) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
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

  const now = resolveServerInstant(options)
  const deleted = await repository.updateRecipeTag(event.spaceId, event.tagId, {
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  })
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
  createRecipeTag,
  deleteRecipe,
  deleteRecipeTag,
  getRecipeDetail,
  listRecipeTags,
  listRecipes,
  updateRecipe
}
