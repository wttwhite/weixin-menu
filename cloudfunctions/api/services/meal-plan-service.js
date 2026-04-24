const { ERROR_CODES } = require('../shared/constants/error-codes')
const {
  MEAL_TYPE_ORDER,
  normalizeMealPlanRecipe,
  normalizeMealPlanWrite,
  sortMealPlansBySchedule
} = require('../shared/domain/meal-plan')
const DEFAULT_LIST_LIMIT = 100

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
  if (!plan.planDate) {
    throw toAppError('planDate is required', ERROR_CODES.INVALID_INPUT)
  }
  if (!plan.mealType) {
    throw toAppError('mealType is required', ERROR_CODES.INVALID_INPUT)
  }
  if (!Array.isArray(plan.recipes) || !plan.recipes.length || !plan.recipes[0].recipeId) {
    throw toAppError('recipeId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function validateRawRecipes(input = {}) {
  const rawRecipes = Array.isArray(input.recipes) ? input.recipes : []
  const hasInvalidRecipe = rawRecipes.some((recipe) => !normalizeId(recipe && recipe.recipeId))
  if (hasInvalidRecipe) {
    throw toAppError('recipeId is required', ERROR_CODES.INVALID_INPUT)
  }
}

function normalizeListLimit(limit) {
  const parsed = Number(limit)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIST_LIMIT
  }
  return Math.min(Math.floor(parsed), DEFAULT_LIST_LIMIT)
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

async function buildEmbeddedRecipes(spaceId, rawRecipes = [], repository = {}) {
  const results = []
  for (let index = 0; index < rawRecipes.length; index += 1) {
    const entry = rawRecipes[index]
    const recipe = await resolveRecipeSnapshot(spaceId, entry.recipeId, repository)
    results.push(
      normalizeMealPlanRecipe(
        {
          recipeId: recipe._id,
          recipeNameSnapshot: recipe.name,
          servingsOverride: entry.servingsOverride,
          recipeNotes: entry.notes,
          recipe
        },
        index + 1
      )
    )
  }
  return results
}

async function listMealPlans(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  const limit = normalizeListLimit(event.limit)
  const [items, metadata] = await Promise.all([
    repository.listMealPlans(event.spaceId, {
      deletedAt: '',
      limit
    }),
    repository.getMealPlanListMetadata
      ? repository.getMealPlanListMetadata(event.spaceId, {
          deletedAt: ''
        })
      : null
  ])
  const sortedItems = sortMealPlansBySchedule((items || []).filter((item) => !item.deletedAt))
  const total = metadata && typeof metadata.total === 'number' ? metadata.total : sortedItems.length
  return {
    items: sortedItems,
    total,
    limit,
    hasMore: total > limit
  }
}

async function getMealPlan(event = {}, context = {}, repository = {}) {
  validateSpaceId(event.spaceId)
  validateMealPlanId(event.mealPlanId)

  const item = await repository.getMealPlan(event.spaceId, event.mealPlanId)
  if (!item || item.deletedAt) {
    throw toAppError('Meal plan not found', ERROR_CODES.NOT_FOUND)
  }

  return {
    item
  }
}

async function createMealPlan(event = {}, context = {}, repository = {}, options = {}) {
  validateSpaceId(event.spaceId)
  const now = resolveServerInstant(options)
  validateRawRecipes(event.plan || {})
  const rawPlan = normalizeMealPlanWrite(event.plan || {})
  validateMealPlanWrite(rawPlan)
  const normalized = {
    planDate: rawPlan.planDate,
    mealType: rawPlan.mealType,
    status: rawPlan.status,
    notes: rawPlan.notes,
    recipes: await buildEmbeddedRecipes(event.spaceId, rawPlan.recipes, repository)
  }

  const created = await repository.createMealPlan({
    spaceId: event.spaceId,
    ...normalized,
    mealTypeOrder: MEAL_TYPE_ORDER[normalized.mealType] || Number.MAX_SAFE_INTEGER,
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
  validateRawRecipes(event.plan || {})
  const rawPlan = normalizeMealPlanWrite(event.plan || {})
  validateMealPlanWrite(rawPlan)
  const normalized = {
    planDate: rawPlan.planDate,
    mealType: rawPlan.mealType,
    status: rawPlan.status,
    notes: rawPlan.notes,
    recipes: await buildEmbeddedRecipes(event.spaceId, rawPlan.recipes, repository)
  }

  const updated = await repository.updateMealPlan(event.spaceId, event.mealPlanId, {
    ...normalized,
    mealTypeOrder: MEAL_TYPE_ORDER[normalized.mealType] || Number.MAX_SAFE_INTEGER,
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
  getMealPlan,
  listMealPlans,
  updateMealPlan
}
