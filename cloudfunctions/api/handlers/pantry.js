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

async function listPantryCategories({ event, context, repository }) {
  return pantryService.listPantryCategories(event, context, repository)
}

async function createPantryCategory({ event, context, repository }) {
  return pantryService.createPantryCategory(event, context, repository)
}

async function updatePantryCategory({ event, context, repository }) {
  return pantryService.updatePantryCategory(event, context, repository)
}

async function deletePantryCategory({ event, context, repository }) {
  return pantryService.deletePantryCategory(event, context, repository)
}

async function reorderPantryCategories({ event, context, repository }) {
  return pantryService.reorderPantryCategories(event, context, repository)
}

async function listPantryLocations({ event, context, repository }) {
  return pantryService.listPantryLocations(event, context, repository)
}

async function createPantryLocation({ event, context, repository }) {
  return pantryService.createPantryLocation(event, context, repository)
}

async function updatePantryLocation({ event, context, repository }) {
  return pantryService.updatePantryLocation(event, context, repository)
}

async function deletePantryLocation({ event, context, repository }) {
  return pantryService.deletePantryLocation(event, context, repository)
}

async function reorderPantryLocations({ event, context, repository }) {
  return pantryService.reorderPantryLocations(event, context, repository)
}

module.exports = {
  createPantryItem,
  createPantryCategory,
  createPantryLocation,
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
