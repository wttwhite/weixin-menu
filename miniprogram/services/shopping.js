const { callCloud } = require('./cloud')
const { unwrapResponse } = require('./session')

function createShoppingService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async listShoppingLists(spaceId) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'listShoppingLists',
          spaceId
        })
      )
    },

    async createShoppingList(spaceId, shoppingList) {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'createShoppingList',
          spaceId,
          shoppingList
        })
      )
    },

    async updateShoppingList(spaceId, shoppingListId, shoppingList, expectedUpdatedAt = '') {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'updateShoppingList',
          spaceId,
          shoppingListId,
          shoppingList,
          expectedUpdatedAt
        })
      )
    },

    async deleteShoppingList(spaceId, shoppingListId, expectedUpdatedAt = '') {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'deleteShoppingList',
          spaceId,
          shoppingListId,
          expectedUpdatedAt
        })
      )
    },

    async generateShoppingItemsFromPlan(spaceId, shoppingListId, expectedUpdatedAt = '') {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'generateShoppingItemsFromPlan',
          spaceId,
          shoppingListId,
          expectedUpdatedAt
        })
      )
    },

    async toggleShoppingItemChecked(spaceId, shoppingListId, shoppingItemId, checked, expectedUpdatedAt = '', shoppingListExpectedUpdatedAt = '') {
      return unwrapResponse(
        await cloudCall('api', {
          action: 'toggleShoppingItemChecked',
          spaceId,
          shoppingListId,
          shoppingItemId,
          checked,
          expectedUpdatedAt,
          shoppingListExpectedUpdatedAt
        })
      )
    }
  }
}

module.exports = {
  createShoppingService
}
