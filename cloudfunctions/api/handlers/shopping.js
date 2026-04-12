const shoppingService = require('../services/shopping-service')

async function listShoppingLists({ event, context, repository }) {
  return shoppingService.listShoppingLists(event, context, repository)
}

async function createShoppingList({ event, context, repository }) {
  return shoppingService.createShoppingList(event, context, repository)
}

async function updateShoppingList({ event, context, repository }) {
  return shoppingService.updateShoppingList(event, context, repository)
}

async function deleteShoppingList({ event, context, repository }) {
  return shoppingService.deleteShoppingList(event, context, repository)
}

async function generateShoppingItemsFromPlan({ event, context, repository }) {
  return shoppingService.generateShoppingItemsFromPlan(event, context, repository)
}

async function toggleShoppingItemChecked({ event, context, repository }) {
  return shoppingService.toggleShoppingItemChecked(event, context, repository)
}

module.exports = {
  createShoppingList,
  deleteShoppingList,
  generateShoppingItemsFromPlan,
  listShoppingLists,
  toggleShoppingItemChecked,
  updateShoppingList
}
