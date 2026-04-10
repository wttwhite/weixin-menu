const { ERROR_CODES } = require('../shared/constants/error-codes')
const { toIsoDate, isValidIsoDate } = require('../shared/utils/time')
const {
  derivePantryStatus,
  matchesPantryFilters,
  normalizePantryItemWrite
} = require('../shared/domain/pantry')

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeNow(now) {
  return typeof now === 'string' && now.trim() ? now.trim() : new Date().toISOString().slice(0, 10)
}

function createTimestamp(now) {
  return `${normalizeNow(now)}T00:00:00.000Z`
}

function resolveClock(options = {}) {
  if (options.clock && typeof options.clock.now === 'function') {
    return options.clock
  }

  return {
    now: () => new Date()
  }
}

function resolveServerNow(options = {}) {
  return toIsoDate(resolveClock(options).now())
}

function resolveReadNow(eventNow, options = {}) {
  if (typeof eventNow === 'string' && isValidIsoDate(eventNow.trim())) {
    return eventNow.trim()
  }
  return resolveServerNow(options)
}

function validateSpaceId(spaceId) {
  if (!normalizeId(spaceId)) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validatePantryItemId(pantryItemId) {
  if (!normalizeId(pantryItemId)) {
    throw toAppError('pantryItemId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateWritePayload(item, rawItem = {}) {
  if (!item.name) {
    throw toAppError('Item name is required', ERROR_CODES.INVALID_INPUT)
  }

  const rawExpirationDate = typeof rawItem.expirationDate === 'string' ? rawItem.expirationDate.trim() : ''
  if (rawExpirationDate && !item.expirationDate) {
    throw toAppError('Invalid expirationDate', ERROR_CODES.INVALID_INPUT)
  }
}

function normalizeStoredItem(item, now) {
  return {
    ...item,
    status: derivePantryStatus({
      expirationDate: item.expirationDate,
      now
    })
  }
}

async function listPantry(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)

  const now = resolveReadNow(event.now, options)
  const filters = event.filters || {}
  const items = await repository.listPantryItems(event.spaceId)

  return {
    items: (items || [])
      .filter((item) => !item.deletedAt)
      .map((item) => normalizeStoredItem(item, now))
      .filter((item) => matchesPantryFilters(item, filters))
  }
}

async function createPantryItem(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)

  const now = resolveServerNow(options)
  const normalizedItem = normalizePantryItemWrite({
    ...(event.item || {}),
    now
  })
  validateWritePayload(normalizedItem, event.item || {})

  const created = await repository.createPantryItem({
    spaceId: event.spaceId,
    ...normalizedItem,
    createdAt: createTimestamp(now),
    updatedAt: createTimestamp(now),
    deletedAt: '',
    createdBy: context.openid || '',
    updatedBy: context.openid || '',
    deletedBy: ''
  })

  return {
    item: normalizeStoredItem(created, now)
  }
}

async function updatePantryItem(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validatePantryItemId(event.pantryItemId)

  const existing = await repository.getPantryItem(event.spaceId, event.pantryItemId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Pantry item not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveServerNow(options)
  const normalizedItem = normalizePantryItemWrite({
    ...(event.item || {}),
    now
  })
  validateWritePayload(normalizedItem, event.item || {})

  const updated = await repository.updatePantryItem(event.spaceId, event.pantryItemId, {
    ...normalizedItem,
    updatedAt: createTimestamp(now),
    updatedBy: context.openid || ''
  })

  if (!updated) {
    throw toAppError('Pantry item not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    item: normalizeStoredItem(updated, now)
  }
}

async function deletePantryItem(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validatePantryItemId(event.pantryItemId)

  const existing = await repository.getPantryItem(event.spaceId, event.pantryItemId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Pantry item not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveServerNow(options)
  const deleted = await repository.updatePantryItem(event.spaceId, event.pantryItemId, {
    deletedAt: createTimestamp(now),
    deletedBy: context.openid || '',
    updatedAt: createTimestamp(now),
    updatedBy: context.openid || ''
  })

  if (!deleted) {
    throw toAppError('Pantry item not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    pantryItemId: event.pantryItemId,
    deleted: true
  }
}

async function getPantryItem(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validatePantryItemId(event.pantryItemId)

  const item = await repository.getPantryItem(event.spaceId, event.pantryItemId)
  if (!item || item.deletedAt) {
    throw toAppError('Pantry item not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveReadNow(event.now, options)
  return {
    item: normalizeStoredItem(item, now)
  }
}

module.exports = {
  createPantryItem,
  deletePantryItem,
  getPantryItem,
  listPantry,
  updatePantryItem
}
