const recipeService = require('../services/recipe-service')

async function listRecipes({ event, context, repository }) {
  return recipeService.listRecipes(event, context, repository)
}

async function getRecipeDetail({ event, context, repository }) {
  return recipeService.getRecipeDetail(event, context, repository)
}

async function createRecipe({ event, context, repository }) {
  return recipeService.createRecipe(event, context, repository)
}

async function updateRecipe({ event, context, repository }) {
  return recipeService.updateRecipe(event, context, repository)
}

async function deleteRecipe({ event, context, repository }) {
  return recipeService.deleteRecipe(event, context, repository)
}

async function listRecipeTags({ event, context, repository }) {
  return recipeService.listRecipeTags(event, context, repository)
}

async function listRecipeCategories({ event, context, repository }) {
  return recipeService.listRecipeCategories(event, context, repository)
}

async function createRecipeCategory({ event, context, repository }) {
  return recipeService.createRecipeCategory(event, context, repository)
}

async function updateRecipeCategory({ event, context, repository }) {
  return recipeService.updateRecipeCategory(event, context, repository)
}

async function deleteRecipeCategory({ event, context, repository }) {
  return recipeService.deleteRecipeCategory(event, context, repository)
}

async function createRecipeTag({ event, context, repository }) {
  return recipeService.createRecipeTag(event, context, repository)
}

async function deleteRecipeTag({ event, context, repository }) {
  return recipeService.deleteRecipeTag(event, context, repository)
}

module.exports = {
  createRecipe,
  createRecipeCategory,
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
