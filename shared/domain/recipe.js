const DEFAULT_TAG_COLOR = '#E6A23C'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeBoolean(value) {
  return Boolean(value)
}

function normalizeInteger(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(0, Math.floor(parsed))
}

function normalizeOptionalNumber(value) {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string' && !value.trim()) {
    return ''
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return ''
  }

  return Math.max(0, parsed)
}

function normalizeSortOrder(value, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.floor(parsed)
}

function sortBySortOrder(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (left.item.sortOrder !== right.item.sortOrder) {
        return left.item.sortOrder - right.item.sortOrder
      }
      return left.index - right.index
    })
    .map((entry) => entry.item)
}

function normalizeRecipeIngredients(ingredients = []) {
  const normalized = (ingredients || [])
    .map((item, index) => ({
      name: normalizeText(item && item.name),
      quantity: normalizeText(item && item.quantity),
      unit: normalizeText(item && item.unit),
      preparation: normalizeText(item && item.preparation),
      notes: normalizeText(item && item.notes),
      sortOrder: normalizeSortOrder(item && item.sortOrder, index + 1)
    }))
    .filter((item) => item.name)

  return sortBySortOrder(normalized).map((item, index) => ({
    ...item,
    sortOrder: index + 1
  }))
}

function normalizeRecipeSteps(steps = []) {
  const normalized = (steps || [])
    .map((item, index) => ({
      title: normalizeText(item && item.title),
      content: normalizeText(item && item.content),
      durationMinutes: normalizeText(item && item.durationMinutes),
      tips: normalizeText(item && item.tips),
      stepNo: normalizeSortOrder(item && item.stepNo, index + 1),
      sortOrder: normalizeSortOrder(item && item.sortOrder, index + 1)
    }))
    .filter((item) => item.content)

  return sortBySortOrder(normalized).map((item, index) => ({
    ...item,
    stepNo: index + 1,
    sortOrder: index + 1
  }))
}

function normalizeRecipeTagRef(tag = {}) {
  return {
    id: normalizeText(tag.id),
    name: normalizeText(tag.name),
    color: normalizeText(tag.color)
  }
}

function normalizeRecipeTags(tags = []) {
  return (tags || [])
    .map((tag) => normalizeRecipeTagRef(tag))
    .filter((tag) => tag.id || tag.name)
}

function mergeTagIds(tagIds = [], tags = []) {
  const merged = []
  const pushUnique = (value) => {
    const id = normalizeText(value)
    if (!id || merged.indexOf(id) !== -1) {
      return
    }
    merged.push(id)
  }

  ;(tagIds || []).forEach((value) => pushUnique(value))
  ;(tags || []).forEach((tag) => pushUnique(tag.id))
  return merged
}

function normalizeRecipeDraft(input = {}) {
  const tags = normalizeRecipeTags(input.tags || [])
  return {
    name: normalizeText(input.name),
    summary: normalizeText(input.summary),
    category: normalizeText(input.category),
    cuisine: normalizeText(input.cuisine),
    difficulty: normalizeText(input.difficulty),
    servings: normalizeText(input.servings),
    prepTimeMinutes: normalizeText(input.prepTimeMinutes),
    cookTimeMinutes: normalizeText(input.cookTimeMinutes),
    recommendationScore: normalizeOptionalNumber(input.recommendationScore),
    notes: normalizeText(input.notes),
    sourceName: normalizeText(input.sourceName),
    sourceUrl: normalizeText(input.sourceUrl),
    isFavorite: normalizeBoolean(input.isFavorite),
    coverImageId: normalizeText(input.coverImageId) || null,
    ingredients: normalizeRecipeIngredients(input.ingredients || []),
    steps: normalizeRecipeSteps(input.steps || []),
    tags,
    tagIds: mergeTagIds(input.tagIds || [], tags)
  }
}

function normalizeRecipeTagDraft(input = {}) {
  return {
    name: normalizeText(input.name),
    color: normalizeText(input.color) || DEFAULT_TAG_COLOR
  }
}

module.exports = {
  normalizeRecipeDraft,
  normalizeRecipeTagDraft
}
