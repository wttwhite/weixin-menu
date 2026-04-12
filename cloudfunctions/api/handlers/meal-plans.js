const mealPlanService = require('../services/meal-plan-service')

async function listMealPlans({ event, context, repository }) {
  return mealPlanService.listMealPlans(event, context, repository)
}

async function createMealPlan({ event, context, repository }) {
  return mealPlanService.createMealPlan(event, context, repository)
}

async function updateMealPlan({ event, context, repository }) {
  return mealPlanService.updateMealPlan(event, context, repository)
}

async function deleteMealPlan({ event, context, repository }) {
  return mealPlanService.deleteMealPlan(event, context, repository)
}

module.exports = {
  createMealPlan,
  deleteMealPlan,
  listMealPlans,
  updateMealPlan
}
