const { callCloud } = require('./cloud')

function unwrapResponse(response) {
  const result = response && response.result ? response.result : response
  if (!result || typeof result.code !== 'number') {
    return result || {}
  }

  if (result.code !== 0) {
    const error = new Error(result.message || 'Request failed')
    error.code = result.code
    error.data = result.data || null
    throw error
  }

  return result.data || {}
}

function createMealPlanService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async listMealPlans(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listMealPlans',
          spaceId
        })
      )
    },

    async getMealPlan(spaceId, mealPlanId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'getMealPlan',
          spaceId,
          mealPlanId
        })
      )
    },

    async createMealPlan(spaceId, plan) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createMealPlan',
          spaceId,
          plan
        })
      )
    },

    async updateMealPlan(spaceId, mealPlanId, plan) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updateMealPlan',
          spaceId,
          mealPlanId,
          plan
        })
      )
    },

    async deleteMealPlan(spaceId, mealPlanId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deleteMealPlan',
          spaceId,
          mealPlanId
        })
      )
    }
  }
}

async function listMealPlans(spaceId, dependencies = {}) {
  return createMealPlanService(dependencies).listMealPlans(spaceId)
}

async function createMealPlan(spaceId, plan, dependencies = {}) {
  return createMealPlanService(dependencies).createMealPlan(spaceId, plan)
}

async function getMealPlan(spaceId, mealPlanId, dependencies = {}) {
  return createMealPlanService(dependencies).getMealPlan(spaceId, mealPlanId)
}

async function updateMealPlan(spaceId, mealPlanId, plan, dependencies = {}) {
  return createMealPlanService(dependencies).updateMealPlan(spaceId, mealPlanId, plan)
}

async function deleteMealPlan(spaceId, mealPlanId, dependencies = {}) {
  return createMealPlanService(dependencies).deleteMealPlan(spaceId, mealPlanId)
}

module.exports = {
  createMealPlan,
  createMealPlanService,
  deleteMealPlan,
  getMealPlan,
  listMealPlans,
  updateMealPlan
}
