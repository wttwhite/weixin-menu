const { isValidIsoDate } = require('../utils/time')

const MEAL_TYPE_ORDER = Object.freeze({
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4
})

const MEAL_PLAN_STATUS = Object.freeze({
  PLANNED: 'planned',
  DONE: 'done',
  CANCELLED: 'cancelled'
})

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDate(value) {
  const text = normalizeText(value)
  return isValidIsoDate(text) ? text : ''
}

function normalizeMealType(value) {
  const mealType = normalizeText(value).toLowerCase()
  return MEAL_TYPE_ORDER[mealType] ? mealType : ''
}

function normalizeMealPlanStatus(value) {
  const status = normalizeText(value).toLowerCase()
  if (status === MEAL_PLAN_STATUS.DONE) {
    return MEAL_PLAN_STATUS.DONE
  }
  if (status === MEAL_PLAN_STATUS.CANCELLED) {
    return MEAL_PLAN_STATUS.CANCELLED
  }
  return MEAL_PLAN_STATUS.PLANNED
}

function normalizeRecipeSnapshot(recipe = {}) {
  const recipeId = normalizeText(recipe._id)
  if (!recipeId) {
    return null
  }

  return {
    _id: recipeId,
    name: normalizeText(recipe.name),
    summary: normalizeText(recipe.summary),
    coverImageId: normalizeText(recipe.coverImageId),
    servings: normalizeText(recipe.servings)
  }
}

function normalizeMealPlanRecipe(recipeInput = {}, fallbackSortOrder = 1) {
  const recipeSnapshot = normalizeRecipeSnapshot(recipeInput.recipe || recipeInput)
  const recipeId =
    normalizeText(recipeInput.recipeId) || (recipeSnapshot ? recipeSnapshot._id : '')
  if (!recipeId) {
    return null
  }

  return {
    recipeId,
    recipeNameSnapshot: normalizeText(recipeInput.recipeNameSnapshot) || (recipeSnapshot ? recipeSnapshot.name : ''),
    servingsOverride: normalizeText(recipeInput.servingsOverride || recipeInput.servings),
    sortOrder: fallbackSortOrder,
    notes: normalizeText(recipeInput.recipeNotes || recipeInput.notes),
    recipe: recipeSnapshot || { _id: recipeId, name: normalizeText(recipeInput.recipeNameSnapshot) }
  }
}

function normalizeMealPlanWrite(input = {}) {
  const normalizedRecipes = (Array.isArray(input.recipes) ? input.recipes : [])
    .map((recipe, index) => normalizeMealPlanRecipe(recipe, index + 1))
    .filter(Boolean)

  return {
    planDate: normalizeDate(input.planDate || input.date),
    mealType: normalizeMealType(input.mealType),
    status: normalizeMealPlanStatus(input.status),
    notes: normalizeText(input.notes),
    recipes: normalizedRecipes
  }
}

function toIsoDate(value = '') {
  const text = normalizeText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return ''
  }

  const [year, month, day] = text.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return ''
  }

  return text
}

function shiftIsoDate(isoDate = '', days = 0) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function buildRecentRecipePlanUsageCounts(plans = [], today = new Date().toISOString().slice(0, 10), windowDays = 30) {
  const normalizedToday = toIsoDate(today)
  const safeWindowDays = Math.max(1, Math.trunc(windowDays))
  if (!normalizedToday) {
    return {}
  }

  const startDate = shiftIsoDate(normalizedToday, -(safeWindowDays - 1))
  const counts = {}

  for (const plan of plans || []) {
    const planDate = toIsoDate(plan && plan.planDate)
    if (
      !planDate ||
      planDate < startDate ||
      planDate > normalizedToday ||
      normalizeMealPlanStatus(plan && plan.status) !== MEAL_PLAN_STATUS.DONE ||
      normalizeText(plan && plan.deletedAt)
    ) {
      continue
    }

    for (const recipe of Array.isArray(plan.recipes) ? plan.recipes : []) {
      const recipeId = normalizeText(recipe && recipe.recipeId)
      if (!recipeId) {
        continue
      }
      counts[recipeId] = (counts[recipeId] || 0) + 1
    }
  }

  return counts
}

function compareMealPlanSchedule(left = {}, right = {}) {
  const leftDate = normalizeDate(left.planDate || left.date)
  const rightDate = normalizeDate(right.planDate || right.date)
  if (leftDate !== rightDate) {
    if (!leftDate) {
      return 1
    }
    if (!rightDate) {
      return -1
    }
    return leftDate.localeCompare(rightDate)
  }

  const leftMealType = normalizeMealType(left.mealType)
  const rightMealType = normalizeMealType(right.mealType)
  const leftOrder = MEAL_TYPE_ORDER[leftMealType] || Number.MAX_SAFE_INTEGER
  const rightOrder = MEAL_TYPE_ORDER[rightMealType] || Number.MAX_SAFE_INTEGER
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  const leftCreatedAt = normalizeText(left.createdAt)
  const rightCreatedAt = normalizeText(right.createdAt)
  if (leftCreatedAt !== rightCreatedAt) {
    if (!leftCreatedAt) {
      return 1
    }
    if (!rightCreatedAt) {
      return -1
    }
    return leftCreatedAt.localeCompare(rightCreatedAt)
  }

  return normalizeText(left._id).localeCompare(normalizeText(right._id))
}

function sortMealPlansBySchedule(items = []) {
  return (items || [])
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const compareResult = compareMealPlanSchedule(left.item, right.item)
      if (compareResult !== 0) {
        return compareResult
      }
      return left.index - right.index
    })
    .map((entry) => entry.item)
}

module.exports = {
  buildRecentRecipePlanUsageCounts,
  MEAL_TYPE_ORDER,
  MEAL_PLAN_STATUS,
  normalizeMealPlanRecipe,
  normalizeMealPlanStatus,
  normalizeMealPlanWrite,
  sortMealPlansBySchedule
}
