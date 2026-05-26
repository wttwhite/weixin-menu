const { ERROR_CODES } = require('../shared/constants/error-codes')
const {
  buildShoppingItemsFromMealPlans,
  buildShoppingProgress,
  normalizeShoppingItemWrite,
  normalizeShoppingListWrite
} = require('../shared/domain/shopping')

const AUTO_ARCHIVE_COMPLETED_AFTER_MS = 30 * 24 * 60 * 60 * 1000

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
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

function shouldAutoArchiveCompletedList(list = {}, now = new Date()) {
  if (!list || list.status !== 'completed') {
    return false
  }

  const updatedAt = Date.parse(list.updatedAt || '')
  if (!Number.isFinite(updatedAt)) {
    return false
  }

  return now.getTime() - updatedAt >= AUTO_ARCHIVE_COMPLETED_AFTER_MS
}

function deriveShoppingListStatusFromItems(items = []) {
  const activeItems = items || []
  if (activeItems.length && activeItems.every((item) => Boolean(item && item.isChecked))) {
    return 'completed'
  }
  return 'open'
}

function mergeShoppingItemsForStatus(items = [], updatedItem = null) {
  const updatedId = updatedItem && updatedItem._id ? updatedItem._id : ''
  if (!updatedId) {
    return items || []
  }

  let matched = false
  const merged = (items || []).map((item) => {
    if (item && item._id === updatedId) {
      matched = true
      return {
        ...item,
        ...updatedItem
      }
    }
    return item
  })

  if (!matched) {
    merged.push(updatedItem)
  }

  return merged
}

function groupShoppingItemsByListId(items = []) {
  const grouped = new Map()
  ;(items || []).forEach((item) => {
    const shoppingListId = normalizeId(item && item.shoppingListId)
    if (!shoppingListId) {
      return
    }
    if (!grouped.has(shoppingListId)) {
      grouped.set(shoppingListId, [])
    }
    grouped.get(shoppingListId).push(item)
  })
  return grouped
}

async function listShoppingItemsByListId(spaceId, lists = [], repository = {}) {
  const listIds = (lists || [])
    .map((list) => normalizeId(list && list._id))
    .filter(Boolean)
  if (!listIds.length) {
    return new Map()
  }

  if (typeof repository.listShoppingItemsByListIds === 'function') {
    return groupShoppingItemsByListId(
      await repository.listShoppingItemsByListIds(spaceId, listIds, { deletedAt: '' })
    )
  }

  const entries = await Promise.all(
    listIds.map(async (shoppingListId) => [
      shoppingListId,
      await repository.listShoppingItems(spaceId, shoppingListId, { deletedAt: '' })
    ])
  )
  return new Map(entries)
}

function validateSpaceId(spaceId) {
  if (!normalizeId(spaceId)) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateShoppingListId(shoppingListId) {
  if (!normalizeId(shoppingListId)) {
    throw toAppError('shoppingListId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateShoppingItemId(shoppingItemId) {
  if (!normalizeId(shoppingItemId)) {
    throw toAppError('shoppingItemId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function assertExpectedUpdatedAt(actualUpdatedAt, expectedUpdatedAt) {
  const expected = normalizeId(expectedUpdatedAt)
  if (!expected) {
    return
  }
  if (normalizeId(actualUpdatedAt) !== expected) {
    throw toAppError('DATA_CONFLICT', ERROR_CODES.CONFLICT)
  }
}

function validateShoppingItemDraft(itemDraft) {
  if (!itemDraft || typeof itemDraft !== 'object') {
    throw toAppError('shopping item draft is required', ERROR_CODES.INVALID_INPUT)
  }
  const normalized = normalizeShoppingItemWrite(itemDraft)
  if (!normalized.name) {
    throw toAppError('name is required', ERROR_CODES.INVALID_INPUT)
  }
  return normalized
}

async function hydrateMealPlansWithRecipeIngredients(spaceId, plans = [], repository = {}) {
  const hydratedPlans = []

  for (const plan of plans || []) {
    const recipes = []
    for (const recipeEntry of Array.isArray(plan && plan.recipes) ? plan.recipes : []) {
      const recipeId = normalizeId(recipeEntry && recipeEntry.recipeId)
      if (!recipeId || typeof repository.getRecipe !== 'function') {
        continue
      }

      const recipe = await repository.getRecipe(spaceId, recipeId)
      if (!recipe || recipe.deletedAt) {
        continue
      }

      recipes.push({
        ...recipeEntry,
        ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : []
      })
    }

    hydratedPlans.push({
      ...plan,
      recipes
    })
  }

  return hydratedPlans
}

async function assertShoppingListExists(spaceId, shoppingListId, repository = {}) {
  const existing = await repository.getShoppingList(spaceId, shoppingListId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Shopping list not found', ERROR_CODES.NOT_FOUND)
  }
  return existing
}

async function listShoppingLists(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const nowDate = resolveClock(options).now()
  const now = nowDate.toISOString()
  const lists = await repository.listShoppingLists(event.spaceId, {
    deletedAt: ''
  })
  const shoppingItemsByListId = await listShoppingItemsByListId(event.spaceId, lists || [], repository)

  const items = await Promise.all(
    (lists || []).map(async (list) => {
      let currentList = list
      const shoppingItems = shoppingItemsByListId.get(list._id) || []
      const derivedStatus = deriveShoppingListStatusFromItems(shoppingItems)
      if (currentList.status !== 'archived' && currentList.status !== derivedStatus) {
        currentList = await repository.updateShoppingList(event.spaceId, currentList._id, {
          status: derivedStatus,
          updatedAt: now,
          updatedBy: context.openid || ''
        }, { existing: currentList }) || currentList
      }
      if (shouldAutoArchiveCompletedList(currentList, nowDate)) {
        currentList = await repository.updateShoppingList(event.spaceId, currentList._id, {
          status: 'archived',
          updatedAt: now,
          updatedBy: context.openid || ''
        }, { existing: currentList }) || currentList
      }
      return {
        ...currentList,
        items: shoppingItems,
        progress: buildShoppingProgress(shoppingItems)
      }
    })
  )

  return {
    items
  }
}

async function createShoppingList(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const now = resolveServerInstant(options)
  const write = normalizeShoppingListWrite(event.shoppingList || {})

  const item = await repository.createShoppingList({
    spaceId: event.spaceId,
    name: write.name,
    listDate: write.listDate,
    status: write.status,
    notes: write.notes,
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    createdBy: context.openid || '',
    updatedBy: context.openid || '',
    deletedBy: ''
  })

  return {
    item
  }
}

async function updateShoppingList(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateShoppingListId(event.shoppingListId)
  const existingList = await assertShoppingListExists(event.spaceId, event.shoppingListId, repository)
  assertExpectedUpdatedAt(existingList.updatedAt, event.expectedUpdatedAt || (event.shoppingList || {}).expectedUpdatedAt)

  const now = resolveServerInstant(options)
  const input = event.shoppingList || {}
  let shoppingItem = null
  let shouldRecalculateStatus = false
  const listPatch = {
    updatedAt: now,
    updatedBy: context.openid || ''
  }

  if (Object.prototype.hasOwnProperty.call(input, 'name')) {
    listPatch.name = normalizeShoppingListWrite({
      name: input.name
    }).name || existingList.name || '采购清单'
  }

  if (Object.prototype.hasOwnProperty.call(input, 'listDate')) {
    listPatch.listDate = normalizeShoppingListWrite({
      listDate: input.listDate
    }).listDate
  }

  if (Object.prototype.hasOwnProperty.call(input, 'status')) {
    listPatch.status = normalizeShoppingListWrite({
      status: input.status
    }).status
    shouldRecalculateStatus = listPatch.status !== 'archived'
  }

  if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
    listPatch.notes = normalizeShoppingListWrite({
      notes: input.notes
    }).notes
  }

  const itemDraft = input.itemDraft
  if (itemDraft && typeof itemDraft === 'object') {
    const normalizedItem = validateShoppingItemDraft(itemDraft)
    shouldRecalculateStatus = true
    const shoppingItemId = normalizeId(itemDraft.shoppingItemId)
    if (shoppingItemId) {
      const existingItem = await repository.getShoppingItem(event.spaceId, event.shoppingListId, shoppingItemId)
      if (!existingItem || existingItem.deletedAt) {
        throw toAppError('Shopping item not found', ERROR_CODES.NOT_FOUND)
      }
      assertExpectedUpdatedAt(existingItem.updatedAt, itemDraft.expectedUpdatedAt)

      const itemPatch = {
        ...normalizedItem,
        isChecked: Object.prototype.hasOwnProperty.call(itemDraft, 'isChecked')
          ? normalizedItem.isChecked
          : Boolean(existingItem.isChecked)
      }
      shoppingItem = await repository.updateShoppingItem(event.spaceId, event.shoppingListId, shoppingItemId, {
        ...itemPatch,
        updatedAt: now,
        updatedBy: context.openid || ''
      }, { existing: existingItem })
    } else {
      shoppingItem = await repository.createShoppingItem({
        spaceId: event.spaceId,
        shoppingListId: event.shoppingListId,
        ...normalizedItem,
        isChecked: normalizedItem.isChecked,
        createdAt: now,
        updatedAt: now,
        deletedAt: '',
        createdBy: context.openid || '',
        updatedBy: context.openid || '',
        deletedBy: ''
      })
    }
  }

  let item = await repository.updateShoppingList(event.spaceId, event.shoppingListId, listPatch, { existing: existingList })
  if (!item) {
    throw toAppError('Shopping list not found', ERROR_CODES.NOT_FOUND)
  }

  if (shouldRecalculateStatus && item.status !== 'archived') {
    const shoppingItems = mergeShoppingItemsForStatus(
      await repository.listShoppingItems(event.spaceId, event.shoppingListId, { deletedAt: '' }),
      shoppingItem
    )
    const nextStatus = deriveShoppingListStatusFromItems(shoppingItems)
    if (item.status !== nextStatus) {
      item = await repository.updateShoppingList(event.spaceId, event.shoppingListId, {
        status: nextStatus,
        updatedAt: now,
        updatedBy: context.openid || ''
      }, { existing: item }) || item
    }
  }

  return {
    item,
    shoppingItem
  }
}

async function deleteShoppingList(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateShoppingListId(event.shoppingListId)
  const existingList = await assertShoppingListExists(event.spaceId, event.shoppingListId, repository)
  assertExpectedUpdatedAt(existingList.updatedAt, event.expectedUpdatedAt)

  const now = resolveServerInstant(options)
  const deleted = await repository.updateShoppingList(event.spaceId, event.shoppingListId, {
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  }, { existing: existingList })

  if (!deleted) {
    throw toAppError('Shopping list not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    shoppingListId: event.shoppingListId,
    deleted: true
  }
}

async function generateShoppingItemsFromPlan(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateShoppingListId(event.shoppingListId)
  const existingList = await assertShoppingListExists(event.spaceId, event.shoppingListId, repository)
  assertExpectedUpdatedAt(existingList.updatedAt, event.expectedUpdatedAt)
  const now = resolveServerInstant(options)

  const plans = await repository.listMealPlans(event.spaceId, {
    deletedAt: ''
  })
  const hydratedPlans = await hydrateMealPlansWithRecipeIngredients(event.spaceId, plans || [], repository)
  const generated = buildShoppingItemsFromMealPlans(hydratedPlans)

  const existingItems = await repository.listShoppingItems(event.spaceId, event.shoppingListId, { deletedAt: '' })
  for (const existingItem of existingItems) {
    if (existingItem.sourceType !== 'generated') {
      continue
    }
    await repository.updateShoppingItem(event.spaceId, event.shoppingListId, existingItem._id, {
      deletedAt: now,
      deletedBy: context.openid || '',
      updatedAt: now,
      updatedBy: context.openid || ''
    }, { existing: existingItem })
  }

  const createdItems = []
  for (const item of generated) {
    const created = await repository.createShoppingItem({
      spaceId: event.spaceId,
      shoppingListId: event.shoppingListId,
      ...item,
      createdAt: now,
      updatedAt: now,
      deletedAt: '',
      createdBy: context.openid || '',
      updatedBy: context.openid || '',
      deletedBy: ''
    })
    createdItems.push(created)
  }

  await repository.updateShoppingList(event.spaceId, event.shoppingListId, {
    updatedAt: now,
    updatedBy: context.openid || ''
  }, { existing: existingList })

  return {
    items: createdItems,
    shoppingListUpdatedAt: now
  }
}

async function toggleShoppingItemChecked(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateShoppingListId(event.shoppingListId)
  validateShoppingItemId(event.shoppingItemId)
  const existingList = await assertShoppingListExists(event.spaceId, event.shoppingListId, repository)
  assertExpectedUpdatedAt(existingList.updatedAt, event.shoppingListExpectedUpdatedAt)
  const existing = await repository.getShoppingItem(event.spaceId, event.shoppingListId, event.shoppingItemId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Shopping item not found', ERROR_CODES.NOT_FOUND)
  }
  assertExpectedUpdatedAt(existing.updatedAt, event.expectedUpdatedAt)

  const checked =
    typeof event.checked === 'boolean' ? event.checked : !Boolean(existing.isChecked)
  const now = resolveServerInstant(options)

  const item = await repository.updateShoppingItem(event.spaceId, event.shoppingListId, event.shoppingItemId, {
    isChecked: checked,
    updatedAt: now,
    updatedBy: context.openid || ''
  }, { existing })
  if (!item) {
    throw toAppError('Shopping item not found', ERROR_CODES.NOT_FOUND)
  }

  const shoppingItems = mergeShoppingItemsForStatus(
    await repository.listShoppingItems(event.spaceId, event.shoppingListId, { deletedAt: '' }),
    item
  )
  const nextStatus = deriveShoppingListStatusFromItems(shoppingItems)
  const shoppingList = await repository.updateShoppingList(event.spaceId, event.shoppingListId, {
    status: nextStatus,
    updatedAt: now,
    updatedBy: context.openid || ''
  }, { existing: existingList })

  return {
    item,
    shoppingList,
    shoppingListUpdatedAt: now
  }
}

module.exports = {
  createShoppingList,
  deleteShoppingList,
  generateShoppingItemsFromPlan,
  listShoppingLists,
  toggleShoppingItemChecked,
  updateShoppingList
}
