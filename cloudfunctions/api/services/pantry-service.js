const { ERROR_CODES } = require('../shared/constants/error-codes')
const { isValidIsoDate } = require('../shared/utils/time')
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

const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_LIST_LIMIT = 100

function toBusinessDate(input, timeZone = DEFAULT_BUSINESS_TIMEZONE) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    throw toAppError('Invalid server clock date', ERROR_CODES.UNKNOWN)
  }

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
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
  return toBusinessDate(resolveClock(options).now(), options.businessTimezone)
}

function resolveServerTime(options = {}) {
  const now = resolveClock(options).now()
  return {
    businessDate: toBusinessDate(now, options.businessTimezone),
    instant: now.toISOString()
  }
}

function normalizeListFilters(filters = {}) {
  const category = typeof filters.category === 'string' ? filters.category.trim() : ''
  const location = typeof filters.location === 'string' ? filters.location.trim() : ''
  return {
    category,
    location,
    status: typeof filters.status === 'string' ? filters.status.trim() : ''
  }
}

function normalizeListLimit(limit) {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT
  }
  return Math.min(Math.floor(parsed), DEFAULT_LIST_LIMIT)
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
  const filters = normalizeListFilters(event.filters || {})
  const limit = normalizeListLimit(event.limit)
  const items = await repository.listPantryItems(event.spaceId, {
    category: filters.category,
    location: filters.location,
    deletedAt: '',
    limit
  })
  const metadata = repository.getPantryListMetadata
    ? await repository.getPantryListMetadata(event.spaceId, {
        category: filters.category,
        location: filters.location
      })
    : null
  const total = metadata && typeof metadata.total === 'number' ? metadata.total : (items || []).length
  const hasMore = total > limit
  const filterOptions = metadata
    ? {
        categories: metadata.categories || [],
        locations: metadata.locations || []
      }
    : {
        categories: [],
        locations: []
      }

  return {
    items: (items || [])
      .filter((item) => !item.deletedAt)
      .map((item) => normalizeStoredItem(item, now))
      .filter((item) => matchesPantryFilters(item, filters)),
    total,
    hasMore,
    limit,
    filterOptions
  }
}

async function createPantryItem(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)

  const serverTime = resolveServerTime(options)
  const now = serverTime.businessDate
  const serverInstant = serverTime.instant
  const normalizedItem = normalizePantryItemWrite({
    ...(event.item || {}),
    now
  })
  validateWritePayload(normalizedItem, event.item || {})

  const created = await repository.createPantryItem({
    spaceId: event.spaceId,
    ...normalizedItem,
    createdAt: serverInstant,
    updatedAt: serverInstant,
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

  const serverTime = resolveServerTime(options)
  const now = serverTime.businessDate
  const serverInstant = serverTime.instant
  const normalizedItem = normalizePantryItemWrite({
    ...(event.item || {}),
    now
  })
  validateWritePayload(normalizedItem, event.item || {})

  const updated = await repository.updatePantryItem(event.spaceId, event.pantryItemId, {
    ...normalizedItem,
    updatedAt: serverInstant,
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

  const serverTime = resolveServerTime(options)
  const now = serverTime.businessDate
  const serverInstant = serverTime.instant
  const deleted = await repository.updatePantryItem(event.spaceId, event.pantryItemId, {
    deletedAt: serverInstant,
    deletedBy: context.openid || '',
    updatedAt: serverInstant,
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
