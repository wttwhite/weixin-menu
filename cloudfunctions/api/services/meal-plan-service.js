const { ERROR_CODES } = require('../shared/constants/error-codes')
const { normalizeMealPlanWrite, sortMealPlansBySchedule } = require('../shared/domain/meal-plan')

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

function validateMealPlanId(mealPlanId) {
  if (!normalizeId(mealPlanId)) {
    throw toAppError('mealPlanId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateMealPlanWrite(plan) {
  if (!plan.date) {
    throw toAppError('date is required', ERROR_CODES.INVALID_INPUT)
  }
  if (!plan.mealType) {
    throw toAppError('mealType is required', ERROR_CODES.INVALID_INPUT)
  }
  if (!plan.recipeId) {
    throw toAppError('recipeId is required', ERROR_CODES.INVALID_INPUT)
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

async function resolveRecipeSnapshot(spaceId, recipeId, repository = {}) {
  const recipe = await repository.getRecipe(spaceId, recipeId)
  if (!recipe || recipe.deletedAt) {
    throw toAppError('Recipe not found', ERROR_CODES.NOT_FOUND)
  }
  return recipe
}

async function listMealPlans(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const items = await repository.listMealPlans(event.spaceId, {
    deletedAt: ''
  })
  return {
    items: sortMealPlansBySchedule((items || []).filter((item) => !item.deletedAt))
  }
}

async function createMealPlan(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const now = resolveServerInstant(options)
  const rawPlan = normalizeMealPlanWrite(event.plan || {})
  validateMealPlanWrite(rawPlan)
  const recipe = await resolveRecipeSnapshot(event.spaceId, rawPlan.recipeId, repository)
  const normalized = normalizeMealPlanWrite({
    ...rawPlan,
    recipe
  })

  const created = await repository.createMealPlan({
    spaceId: event.spaceId,
    ...normalized,
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

async function updateMealPlan(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateMealPlanId(event.mealPlanId)

  const existing = await repository.getMealPlan(event.spaceId, event.mealPlanId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Meal plan not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveServerInstant(options)
  const rawPlan = normalizeMealPlanWrite(event.plan || {})
  validateMealPlanWrite(rawPlan)
  const recipe = await resolveRecipeSnapshot(event.spaceId, rawPlan.recipeId, repository)
  const normalized = normalizeMealPlanWrite({
    ...rawPlan,
    recipe
  })

  const updated = await repository.updateMealPlan(event.spaceId, event.mealPlanId, {
    ...normalized,
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  if (!updated) {
    throw toAppError('Meal plan not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    item: updated
  }
}

async function deleteMealPlan(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  validateMealPlanId(event.mealPlanId)

  const existing = await repository.getMealPlan(event.spaceId, event.mealPlanId)
  if (!existing || existing.deletedAt) {
    throw toAppError('Meal plan not found', ERROR_CODES.NOT_FOUND)
  }

  const now = resolveServerInstant(options)
  const deleted = await repository.updateMealPlan(event.spaceId, event.mealPlanId, {
    deletedAt: now,
    deletedBy: context.openid || '',
    updatedAt: now,
    updatedBy: context.openid || ''
  })

  if (!deleted) {
    throw toAppError('Meal plan not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    mealPlanId: event.mealPlanId,
    deleted: true
  }
}

module.exports = {
  createMealPlan,
  deleteMealPlan,
  listMealPlans,
  updateMealPlan
}
