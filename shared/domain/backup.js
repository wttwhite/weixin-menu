const BACKUP_VERSION = '1.0.0'

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isIsoInstant(value) {
  return typeof value === 'string' && /\d{4}-\d{2}-\d{2}T/.test(value)
}

function validateBackupPayload(payload) {
  if (!isPlainObject(payload)) {
    return false
  }

  if (payload.version !== BACKUP_VERSION) {
    return false
  }

  if (!isIsoInstant(payload.exportTime)) {
    return false
  }

  if (!Array.isArray(payload.recipes)) {
    return false
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'recipeTags') &&
    !Array.isArray(payload.recipeTags)
  ) {
    return false
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'recipeImages') &&
    !Array.isArray(payload.recipeImages)
  ) {
    return false
  }

  if (!Array.isArray(payload.pantryItems)) {
    return false
  }

  if (!Array.isArray(payload.mealPlans)) {
    return false
  }

  if (!Array.isArray(payload.shoppingLists)) {
    return false
  }

  if (
    Object.prototype.hasOwnProperty.call(payload, 'shoppingItems') &&
    !Array.isArray(payload.shoppingItems)
  ) {
    return false
  }

  if (!isPlainObject(payload.settings || {})) {
    return false
  }

  return true
}

module.exports = {
  BACKUP_VERSION,
  validateBackupPayload
}
