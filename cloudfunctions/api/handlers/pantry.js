const pantryService = require('../services/pantry-service')

async function listPantry({ event, context, repository }) {
  return pantryService.listPantry(event, context, repository)
}

async function createPantryItem({ event, context, repository }) {
  return pantryService.createPantryItem(event, context, repository)
}

async function updatePantryItem({ event, context, repository }) {
  return pantryService.updatePantryItem(event, context, repository)
}

async function getPantryItem({ event, context, repository }) {
  return pantryService.getPantryItem(event, context, repository)
}

async function deletePantryItem({ event, context, repository }) {
  return pantryService.deletePantryItem(event, context, repository)
}

module.exports = {
  createPantryItem,
  deletePantryItem,
  getPantryItem,
  listPantry,
  updatePantryItem
}
