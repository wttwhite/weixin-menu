const { ERROR_CODES } = require('../shared/constants/error-codes')
const {
  buildShoppingItemsFromMealPlans,
  buildShoppingProgress,
  normalizeShoppingItemWrite,
  normalizeShoppingListWrite
} = require('../shared/domain/shopping')

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

async function listShoppingLists(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const lists = await repository.listShoppingLists(event.spaceId, {
    deletedAt: ''
  })

  const items = await Promise.all(
    (lists || []).map(async (list) => {
      const shoppingItems = await repository.listShoppingItems(event.spaceId, list._id, { deletedAt: '' })
      return {
        ...list,
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
    title: write.title,
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
  const listPatch = {
    updatedAt: now,
    updatedBy: context.openid || ''
  }

  if (Object.prototype.hasOwnProperty.call(input, 'title')) {
    const normalized = normalizeShoppingListWrite(input)
    listPatch.title = normalized.title
    listPatch.notes = normalized.notes
  }

  const itemDraft = input.itemDraft
  if (itemDraft && typeof itemDraft === 'object') {
    const normalizedItem = validateShoppingItemDraft(itemDraft)
    const shoppingItemId = normalizeId(itemDraft.shoppingItemId)
    if (shoppingItemId) {
      const existingItem = await repository.getShoppingItem(event.spaceId, event.shoppingListId, shoppingItemId)
      if (!existingItem || existingItem.deletedAt) {
        throw toAppError('Shopping item not found', ERROR_CODES.NOT_FOUND)
      }
      assertExpectedUpdatedAt(existingItem.updatedAt, itemDraft.expectedUpdatedAt)

      shoppingItem = await repository.updateShoppingItem(event.spaceId, event.shoppingListId, shoppingItemId, {
        ...normalizedItem,
        updatedAt: now,
        updatedBy: context.openid || ''
      })
    } else {
      shoppingItem = await repository.createShoppingItem({
        spaceId: event.spaceId,
        shoppingListId: event.shoppingListId,
        ...normalizedItem,
        checked: false,
        createdAt: now,
        updatedAt: now,
        deletedAt: '',
        createdBy: context.openid || '',
        updatedBy: context.openid || '',
        deletedBy: ''
      })
    }
  }

  const item = await repository.updateShoppingList(event.spaceId, event.shoppingListId, listPatch)
  if (!item) {
    throw toAppError('Shopping list not found', ERROR_CODES.NOT_FOUND)
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
  })

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
    })
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
  })

  return {
    items: createdItems
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
    typeof event.checked === 'boolean' ? event.checked : !Boolean(existing.checked)
  const now = resolveServerInstant(options)

  const item = await repository.updateShoppingItem(event.spaceId, event.shoppingListId, event.shoppingItemId, {
    checked,
    checkedAt: checked ? now : '',
    updatedAt: now,
    updatedBy: context.openid || ''
  })
  if (!item) {
    throw toAppError('Shopping item not found', ERROR_CODES.NOT_FOUND)
  }

  await repository.updateShoppingList(event.spaceId, event.shoppingListId, {
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  return {
    item
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
