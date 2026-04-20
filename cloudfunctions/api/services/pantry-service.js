const { ERROR_CODES } = require('../shared/constants/error-codes')
const { isValidIsoDate } = require('../shared/utils/time')
const {
  derivePantryStatus,
  matchesPantryFilters,
  normalizePantryItemWrite,
  normalizePantryStatus
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

function normalizeManagerName(value) {
  return typeof value === 'string' ? value.trim() : ''
}

const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Shanghai'
const DEFAULT_LIST_LIMIT = 100
const PANTRY_CATEGORY_SETTINGS_KEY = 'pantryCategories'
const PANTRY_LOCATION_SETTINGS_KEY = 'pantryLocations'

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

function resolveServerInstant(options = {}) {
  return resolveClock(options).now().toISOString()
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

function validateManagerName(name, label) {
  if (!name) {
    throw toAppError(`${label} is required`, ERROR_CODES.INVALID_INPUT)
  }
}

function normalizeManagerNameList(values = []) {
  if (!Array.isArray(values)) {
    return []
  }

  return values
    .map((item) => normalizeManagerName(item))
    .filter(Boolean)
}

function getStoredManagerValues(space = {}, settingsKey = '') {
  const settings = space && typeof space.settings === 'object' ? space.settings : {}
  const values = Array.isArray(settings[settingsKey]) ? settings[settingsKey] : []
  return Array.from(
    new Set(
      values
        .map((item) => normalizeManagerName(item))
        .filter(Boolean)
    )
  )
}

function getStoredPantryCategories(space = {}) {
  return getStoredManagerValues(space, PANTRY_CATEGORY_SETTINGS_KEY)
}

function getStoredPantryLocations(space = {}) {
  return getStoredManagerValues(space, PANTRY_LOCATION_SETTINGS_KEY)
}

function buildManagedNameList(primary = [], secondary = []) {
  const values = []
  ;(primary || []).forEach((item) => {
    const name = normalizeManagerName(item)
    if (name && !values.includes(name)) {
      values.push(name)
    }
  })
  ;(secondary || []).forEach((item) => {
    const name = normalizeManagerName(item)
    if (name && !values.includes(name)) {
      values.push(name)
    }
  })
  return values
}

function buildPantryManagerItems(space = {}, pantryItems = [], config = {}) {
  const counts = new Map()
  for (const pantryItem of pantryItems || []) {
    const name = normalizeManagerName(pantryItem[config.fieldKey])
    if (!name) {
      continue
    }
    counts.set(name, (counts.get(name) || 0) + 1)
  }

  const storedNames = config.getStoredValues(space)
  for (const name of counts.keys()) {
    if (!storedNames.includes(name)) {
      storedNames.push(name)
    }
  }

  return storedNames.map((name) => ({
    name,
    pantryItemCount: counts.get(name) || 0,
    deletable: (counts.get(name) || 0) === 0
  }))
}

async function listActivePantryItems(spaceId, repository = {}) {
  if (typeof repository.listAllPantryItems === 'function') {
    return repository.listAllPantryItems(spaceId, {
      deletedAt: ''
    })
  }

  return repository.listPantryItems(spaceId, {
    deletedAt: ''
  })
}

async function listPantryManagedItems(event = {}, repository = {}, config = {}) {
  const [space, pantryItems] = await Promise.all([
    repository.getSpace ? repository.getSpace(event.spaceId) : null,
    listActivePantryItems(event.spaceId, repository)
  ])

  return {
    space: space || {},
    pantryItems: pantryItems || [],
    items: buildPantryManagerItems(space || {}, pantryItems || [], config)
  }
}

async function createPantryManagedItem(event = {}, context = {}, repository = {}, options = {}, config = {}) {
  validateSpaceId(event.spaceId)
  const name = normalizeManagerName(event.name)
  validateManagerName(name, config.label)

  const { space, items } = await listPantryManagedItems(event, repository, config)
  if (items.some((item) => item.name === name)) {
    throw toAppError(`${config.label} already exists`, ERROR_CODES.CONFLICT)
  }

  const now = resolveServerInstant(options)
  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  const nextValues = config.getStoredValues(space).concat(name)
  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      [config.settingsKey]: Array.from(new Set(nextValues))
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    item: {
      name,
      pantryItemCount: 0,
      deletable: true
    }
  }
}

async function updatePantryManagedItem(event = {}, context = {}, repository = {}, options = {}, config = {}) {
  validateSpaceId(event.spaceId)
  const previousName = normalizeManagerName(event.previousName)
  const name = normalizeManagerName(event.name)
  validateManagerName(previousName, config.label)
  validateManagerName(name, config.label)

  const { space, pantryItems, items } = await listPantryManagedItems(event, repository, config)
  const currentItem = items.find((item) => item.name === previousName)
  if (!currentItem) {
    throw toAppError(`${config.label} not found`, ERROR_CODES.NOT_FOUND)
  }
  if (previousName !== name && items.some((item) => item.name === name)) {
    throw toAppError(`${config.label} already exists`, ERROR_CODES.CONFLICT)
  }

  const now = resolveServerInstant(options)
  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  const storedValues = config.getStoredValues(space)
  const nextValues = storedValues.includes(previousName)
    ? storedValues.map((item) => (item === previousName ? name : item))
    : storedValues.concat(name)

  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      [config.settingsKey]: Array.from(new Set(nextValues))
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  if (previousName !== name) {
    if (typeof repository[config.renameRepositoryMethod] === 'function') {
      await repository[config.renameRepositoryMethod](event.spaceId, previousName, name, {
        updatedAt: now,
        updatedBy: context.openid || ''
      })
    } else {
      for (const pantryItem of (pantryItems || []).filter((item) => normalizeManagerName(item[config.fieldKey]) === previousName)) {
        await repository.updatePantryItem(event.spaceId, pantryItem._id, {
          [config.fieldKey]: name,
          updatedAt: now,
          updatedBy: context.openid || ''
        })
      }
    }
  }

  return {
    item: {
      name,
      pantryItemCount: currentItem.pantryItemCount,
      deletable: currentItem.pantryItemCount === 0
    }
  }
}

async function deletePantryManagedItem(event = {}, context = {}, repository = {}, options = {}, config = {}) {
  validateSpaceId(event.spaceId)
  const name = normalizeManagerName(event.name)
  validateManagerName(name, config.label)

  const { space, items } = await listPantryManagedItems(event, repository, config)
  const currentItem = items.find((item) => item.name === name)
  if (!currentItem) {
    throw toAppError(`${config.label} not found`, ERROR_CODES.NOT_FOUND)
  }
  if (currentItem.pantryItemCount > 0) {
    throw toAppError(`${config.label} is still referenced by pantry items`, ERROR_CODES.CONFLICT)
  }

  const now = resolveServerInstant(options)
  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  const nextValues = config.getStoredValues(space).filter((item) => item !== name)
  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      [config.settingsKey]: nextValues
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    deleted: true,
    name
  }
}

async function reorderPantryManagedItems(event = {}, context = {}, repository = {}, options = {}, config = {}) {
  validateSpaceId(event.spaceId)

  const nextNames = normalizeManagerNameList(event.names)
  if (!nextNames.length) {
    throw toAppError(`${config.label} order is required`, ERROR_CODES.INVALID_INPUT)
  }

  const { space, items } = await listPantryManagedItems(event, repository, config)
  const currentNames = (items || []).map((item) => item.name)
  const uniqueNextNames = Array.from(new Set(nextNames))
  const hasSameMembers =
    uniqueNextNames.length === currentNames.length &&
    currentNames.every((name) => uniqueNextNames.includes(name))

  if (!hasSameMembers) {
    throw toAppError(`Invalid ${config.label} order`, ERROR_CODES.INVALID_INPUT)
  }

  const itemMap = new Map((items || []).map((item) => [item.name, item]))
  const now = resolveServerInstant(options)
  const previousSettings = space && typeof space.settings === 'object' ? space.settings : {}
  await repository.updateSpace(event.spaceId, {
    settings: {
      ...previousSettings,
      [config.settingsKey]: uniqueNextNames
    },
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    items: uniqueNextNames.map((name) => itemMap.get(name))
  }
}

function normalizeStoredItem(item, now) {
  const storedStatus = normalizePantryStatus(item.status, 'active')
  return {
    ...item,
    storedStatus,
    handledType: normalizeManagerName(item.handledType) || null,
    handledAt: normalizeManagerName(item.handledAt) || null,
    status: derivePantryStatus({
      status: storedStatus,
      expirationDate: item.expirationDate,
      now
    })
  }
}

function applyHandledState(normalizedItem = {}, serverInstant = '') {
  const nextStatus = normalizePantryStatus(normalizedItem.status, 'active')
  if (nextStatus === 'empty' || nextStatus === 'discarded') {
    return {
      ...normalizedItem,
      handledType: normalizedItem.handledType || nextStatus,
      handledAt: normalizedItem.handledAt || serverInstant
    }
  }

  return {
    ...normalizedItem,
    handledType: null,
    handledAt: null
  }
}

async function listPantry(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)

  const now = resolveReadNow(event.now, options)
  const filters = normalizeListFilters(event.filters || {})
  const limit = normalizeListLimit(event.limit)
  const [items, metadata, space] = await Promise.all([
    repository.listPantryItems(event.spaceId, {
      category: filters.category,
      location: filters.location,
      deletedAt: '',
      limit
    }),
    repository.getPantryListMetadata
      ? repository.getPantryListMetadata(event.spaceId, {
          category: filters.category,
          location: filters.location
        })
      : null,
    repository.getSpace ? repository.getSpace(event.spaceId) : null
  ])
  const total = metadata && typeof metadata.total === 'number' ? metadata.total : (items || []).length
  const hasMore = total > limit
  const filterOptions = metadata
    ? {
        categories: buildManagedNameList(getStoredPantryCategories(space || {}), metadata.categories || []),
        locations: buildManagedNameList(getStoredPantryLocations(space || {}), metadata.locations || [])
      }
    : {
        categories: getStoredPantryCategories(space || {}),
        locations: getStoredPantryLocations(space || {})
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
  const nextItem = applyHandledState(normalizedItem, serverInstant)

  const created = await repository.createPantryItem({
    spaceId: event.spaceId,
    ...nextItem,
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
  const rawUpdate = event.item || {}
  const normalizedItem = normalizePantryItemWrite({
    ...existing,
    ...rawUpdate,
    now
  })
  validateWritePayload(normalizedItem, rawUpdate)
  const nextItem = applyHandledState(normalizedItem, serverInstant)

  const updated = await repository.updatePantryItem(event.spaceId, event.pantryItemId, {
    ...nextItem,
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

const CATEGORY_MANAGER_CONFIG = {
  label: 'Pantry category',
  fieldKey: 'category',
  settingsKey: PANTRY_CATEGORY_SETTINGS_KEY,
  renameRepositoryMethod: 'renamePantryCategory',
  getStoredValues: getStoredPantryCategories
}

const LOCATION_MANAGER_CONFIG = {
  label: 'Pantry location',
  fieldKey: 'location',
  settingsKey: PANTRY_LOCATION_SETTINGS_KEY,
  renameRepositoryMethod: 'renamePantryLocation',
  getStoredValues: getStoredPantryLocations
}

async function listPantryCategories(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const result = await listPantryManagedItems(event, repository, CATEGORY_MANAGER_CONFIG)
  return {
    items: result.items
  }
}

async function createPantryCategory(event = {}, context = {}, repository = {}, options = {}) {
  return createPantryManagedItem(event, context, repository, options, CATEGORY_MANAGER_CONFIG)
}

async function updatePantryCategory(event = {}, context = {}, repository = {}, options = {}) {
  return updatePantryManagedItem(event, context, repository, options, CATEGORY_MANAGER_CONFIG)
}

async function deletePantryCategory(event = {}, context = {}, repository = {}, options = {}) {
  return deletePantryManagedItem(event, context, repository, options, CATEGORY_MANAGER_CONFIG)
}

async function reorderPantryCategories(event = {}, context = {}, repository = {}, options = {}) {
  return reorderPantryManagedItems(event, context, repository, options, CATEGORY_MANAGER_CONFIG)
}

async function listPantryLocations(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const result = await listPantryManagedItems(event, repository, LOCATION_MANAGER_CONFIG)
  return {
    items: result.items
  }
}

async function createPantryLocation(event = {}, context = {}, repository = {}, options = {}) {
  return createPantryManagedItem(event, context, repository, options, LOCATION_MANAGER_CONFIG)
}

async function updatePantryLocation(event = {}, context = {}, repository = {}, options = {}) {
  return updatePantryManagedItem(event, context, repository, options, LOCATION_MANAGER_CONFIG)
}

async function deletePantryLocation(event = {}, context = {}, repository = {}, options = {}) {
  return deletePantryManagedItem(event, context, repository, options, LOCATION_MANAGER_CONFIG)
}

async function reorderPantryLocations(event = {}, context = {}, repository = {}, options = {}) {
  return reorderPantryManagedItems(event, context, repository, options, LOCATION_MANAGER_CONFIG)
}

module.exports = {
  createPantryItem,
  createPantryCategory,
  createPantryLocation,
  deletePantryItem,
  deletePantryCategory,
  deletePantryLocation,
  getPantryItem,
  listPantry,
  listPantryCategories,
  listPantryLocations,
  reorderPantryCategories,
  reorderPantryLocations,
  updatePantryCategory,
  updatePantryLocation,
  updatePantryItem
}
