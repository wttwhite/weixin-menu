const { isValidIsoDate } = require('../utils/time')

const MEAL_TYPE_ORDER = Object.freeze({
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4
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
    notes: normalizeText(input.notes),
    recipes: normalizedRecipes
  }
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
  MEAL_TYPE_ORDER,
  normalizeMealPlanRecipe,
  normalizeMealPlanWrite,
  sortMealPlansBySchedule
}
