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

function createRecipeService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async listRecipes(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listRecipes',
          spaceId
        })
      )
    },

    async getRecipeDetail(spaceId, recipeId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'getRecipeDetail',
          spaceId,
          recipeId
        })
      )
    },

    async createRecipe(spaceId, recipe) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createRecipe',
          spaceId,
          recipe
        })
      )
    },

    async updateRecipe(spaceId, recipeId, recipe) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updateRecipe',
          spaceId,
          recipeId,
          recipe
        })
      )
    },

    async deleteRecipe(spaceId, recipeId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deleteRecipe',
          spaceId,
          recipeId
        })
      )
    },

    async listRecipeTags(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listRecipeTags',
          spaceId
        })
      )
    },

    async listRecipeCategories(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listRecipeCategories',
          spaceId
        })
      )
    },

    async createRecipeCategory(spaceId, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createRecipeCategory',
          spaceId,
          name
        })
      )
    },

    async updateRecipeCategory(spaceId, previousName, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updateRecipeCategory',
          spaceId,
          previousName,
          name
        })
      )
    },

    async deleteRecipeCategory(spaceId, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deleteRecipeCategory',
          spaceId,
          name
        })
      )
    },

    async createRecipeTag(spaceId, tag) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createRecipeTag',
          spaceId,
          tag
        })
      )
    },

    async deleteRecipeTag(spaceId, tagId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deleteRecipeTag',
          spaceId,
          tagId
        })
      )
    }
  }
}

async function listRecipes(spaceId, dependencies = {}) {
  return createRecipeService(dependencies).listRecipes(spaceId)
}

async function getRecipeDetail(spaceId, recipeId, dependencies = {}) {
  return createRecipeService(dependencies).getRecipeDetail(spaceId, recipeId)
}

async function createRecipe(spaceId, recipe, dependencies = {}) {
  return createRecipeService(dependencies).createRecipe(spaceId, recipe)
}

async function updateRecipe(spaceId, recipeId, recipe, dependencies = {}) {
  return createRecipeService(dependencies).updateRecipe(spaceId, recipeId, recipe)
}

async function deleteRecipe(spaceId, recipeId, dependencies = {}) {
  return createRecipeService(dependencies).deleteRecipe(spaceId, recipeId)
}

async function listRecipeTags(spaceId, dependencies = {}) {
  return createRecipeService(dependencies).listRecipeTags(spaceId)
}

async function listRecipeCategories(spaceId, dependencies = {}) {
  return createRecipeService(dependencies).listRecipeCategories(spaceId)
}

async function createRecipeCategory(spaceId, name, dependencies = {}) {
  return createRecipeService(dependencies).createRecipeCategory(spaceId, name)
}

async function updateRecipeCategory(spaceId, previousName, name, dependencies = {}) {
  return createRecipeService(dependencies).updateRecipeCategory(spaceId, previousName, name)
}

async function deleteRecipeCategory(spaceId, name, dependencies = {}) {
  return createRecipeService(dependencies).deleteRecipeCategory(spaceId, name)
}

async function createRecipeTag(spaceId, tag, dependencies = {}) {
  return createRecipeService(dependencies).createRecipeTag(spaceId, tag)
}

async function deleteRecipeTag(spaceId, tagId, dependencies = {}) {
  return createRecipeService(dependencies).deleteRecipeTag(spaceId, tagId)
}

module.exports = {
  createRecipe,
  createRecipeCategory,
  createRecipeService,
  createRecipeTag,
  deleteRecipe,
  deleteRecipeCategory,
  deleteRecipeTag,
  getRecipeDetail,
  listRecipeCategories,
  listRecipeTags,
  listRecipes,
  updateRecipeCategory,
  updateRecipe
}
