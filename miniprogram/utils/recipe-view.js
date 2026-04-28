const COOK_DURATION_LABELS_BY_VALUE = Object.freeze({
  15: '15分钟内',
  30: '15-30分钟',
  45: '30-45分钟',
  60: '45-60分钟',
  61: '1小时以上'
})

function getRecipeImageSrc(image = {}) {
  if (!image || typeof image !== 'object') {
    return ''
  }

  return image.displayUrl || image.tempFileURL || image.localPath || image.fileId || ''
}

function getRecipeCoverImage(recipe = {}) {
  const images = Array.isArray(recipe.images) ? recipe.images : []
  const coverImageId = typeof recipe.coverImageId === 'string' ? recipe.coverImageId : ''
  if (coverImageId) {
    const matched = images.find((item) => item && item._id === coverImageId)
    if (matched) {
      return matched
    }
  }

  return images[0] || null
}

function getRecipeCoverImageSrc(recipe = {}) {
  const coverImage = getRecipeCoverImage(recipe)
  return getRecipeImageSrc(coverImage)
}

function formatRecommendationStars(score) {
  const parsed = Number(score)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ''
  }

  const normalized = Math.max(0, Math.min(5, parsed))
  const fullStars = Math.floor(normalized)
  const hasHalfStar = normalized - fullStars >= 0.5
  const stars = '★'.repeat(fullStars) + (hasHalfStar ? '½' : '')
  return stars || ''
}

function formatCookDurationText(duration) {
  if (duration === null || duration === undefined || duration === '') {
    return ''
  }

  const normalized = String(duration).trim()
  if (!normalized) {
    return ''
  }

  return COOK_DURATION_LABELS_BY_VALUE[normalized] || `${normalized} 分钟`
}

function buildRecipeSectionOptions(items = []) {
  const seen = new Set()
  const options = [{ key: 'all', label: '全部' }]

  for (const item of items || []) {
    const category = typeof item.category === 'string' ? item.category.trim() : ''
    if (!category || seen.has(category)) {
      continue
    }
    seen.add(category)
    options.push({
      key: category,
      label: category
    })
  }

  return options
}

function filterRecipesBySection(items = [], activeSectionKey = 'all') {
  if (!activeSectionKey || activeSectionKey === 'all') {
    return items
  }

  return (items || []).filter((item) => item.category === activeSectionKey)
}

module.exports = {
  buildRecipeSectionOptions,
  filterRecipesBySection,
  formatCookDurationText,
  formatRecommendationStars,
  getRecipeCoverImage,
  getRecipeCoverImageSrc,
  getRecipeImageSrc
}
