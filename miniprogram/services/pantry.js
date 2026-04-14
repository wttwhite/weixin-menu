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
    },

    async listPantryCategories(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listPantryCategories',
          spaceId
        })
      )
    },

    async createPantryCategory(spaceId, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createPantryCategory',
          spaceId,
          name
        })
      )
    },

    async updatePantryCategory(spaceId, previousName, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updatePantryCategory',
          spaceId,
          previousName,
          name
        })
      )
    },

    async deletePantryCategory(spaceId, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deletePantryCategory',
          spaceId,
          name
        })
      )
    },

    async reorderPantryCategories(spaceId, names = []) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'reorderPantryCategories',
          spaceId,
          names
        })
      )
    },

    async listPantryLocations(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listPantryLocations',
          spaceId
        })
      )
    },

    async createPantryLocation(spaceId, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createPantryLocation',
          spaceId,
          name
        })
      )
    },

    async updatePantryLocation(spaceId, previousName, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updatePantryLocation',
          spaceId,
          previousName,
          name
        })
      )
    },

    async deletePantryLocation(spaceId, name) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deletePantryLocation',
          spaceId,
          name
        })
      )
    },

    async reorderPantryLocations(spaceId, names = []) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'reorderPantryLocations',
          spaceId,
          names
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

async function listPantryCategories(spaceId, dependencies = {}) {
  return createPantryService(dependencies).listPantryCategories(spaceId)
}

async function createPantryCategory(spaceId, name, dependencies = {}) {
  return createPantryService(dependencies).createPantryCategory(spaceId, name)
}

async function updatePantryCategory(spaceId, previousName, name, dependencies = {}) {
  return createPantryService(dependencies).updatePantryCategory(spaceId, previousName, name)
}

async function deletePantryCategory(spaceId, name, dependencies = {}) {
  return createPantryService(dependencies).deletePantryCategory(spaceId, name)
}

async function reorderPantryCategories(spaceId, names = [], dependencies = {}) {
  return createPantryService(dependencies).reorderPantryCategories(spaceId, names)
}

async function listPantryLocations(spaceId, dependencies = {}) {
  return createPantryService(dependencies).listPantryLocations(spaceId)
}

async function createPantryLocation(spaceId, name, dependencies = {}) {
  return createPantryService(dependencies).createPantryLocation(spaceId, name)
}

async function updatePantryLocation(spaceId, previousName, name, dependencies = {}) {
  return createPantryService(dependencies).updatePantryLocation(spaceId, previousName, name)
}

async function deletePantryLocation(spaceId, name, dependencies = {}) {
  return createPantryService(dependencies).deletePantryLocation(spaceId, name)
}

async function reorderPantryLocations(spaceId, names = [], dependencies = {}) {
  return createPantryService(dependencies).reorderPantryLocations(spaceId, names)
}

module.exports = {
  createPantryItem,
  createPantryCategory,
  createPantryLocation,
  createPantryService,
  deletePantryItem,
  deletePantryCategory,
  deletePantryLocation,
  getPantryItem,
  listPantry,
  listPantryCategories,
  listPantryLocations,
  reorderPantryCategories,
  reorderPantryLocations,
  updatePantryCategory,
  updatePantryLocation,
  updatePantryItem
}
