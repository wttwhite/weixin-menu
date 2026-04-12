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

function normalizeMealPlanWrite(input = {}) {
  const recipeId = normalizeText(input.recipeId) || normalizeText(input.recipe && input.recipe._id)
  return {
    date: normalizeDate(input.date),
    mealType: normalizeMealType(input.mealType),
    servings: normalizeText(input.servings),
    notes: normalizeText(input.notes),
    recipeId,
    recipe: normalizeRecipeSnapshot(input.recipe || { _id: recipeId })
  }
}

function compareMealPlanSchedule(left = {}, right = {}) {
  const leftDate = normalizeDate(left.date)
  const rightDate = normalizeDate(right.date)
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
  return leftOrder - rightOrder
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
  normalizeMealPlanWrite,
  sortMealPlansBySchedule
}
