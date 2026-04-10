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

function createPantryService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async listPantry(spaceId, filters = {}) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listPantry',
          spaceId,
          filters
        })
      )
    },

    async createPantryItem(spaceId, item) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createPantryItem',
          spaceId,
          item
        })
      )
    },

    async getPantryItem(spaceId, pantryItemId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'getPantryItem',
          spaceId,
          pantryItemId
        })
      )
    },

    async updatePantryItem(spaceId, pantryItemId, item) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updatePantryItem',
          spaceId,
          pantryItemId,
          item
        })
      )
    },

    async deletePantryItem(spaceId, pantryItemId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deletePantryItem',
          spaceId,
          pantryItemId
        })
      )
    }
  }
}

async function listPantry(spaceId, filters = {}, dependencies = {}) {
  return createPantryService(dependencies).listPantry(spaceId, filters)
}

async function createPantryItem(spaceId, item, dependencies = {}) {
  return createPantryService(dependencies).createPantryItem(spaceId, item)
}

async function updatePantryItem(spaceId, pantryItemId, item, dependencies = {}) {
  return createPantryService(dependencies).updatePantryItem(spaceId, pantryItemId, item)
}

async function getPantryItem(spaceId, pantryItemId, dependencies = {}) {
  return createPantryService(dependencies).getPantryItem(spaceId, pantryItemId)
}

async function deletePantryItem(spaceId, pantryItemId, dependencies = {}) {
  return createPantryService(dependencies).deletePantryItem(spaceId, pantryItemId)
}

module.exports = {
  createPantryItem,
  createPantryService,
  deletePantryItem,
  getPantryItem,
  listPantry,
  updatePantryItem
}
