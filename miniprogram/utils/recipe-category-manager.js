function buildRecipeCategoryManagerItems(items = []) {
  return (items || []).map((item) => {
    const recipeCount = Number(item.recipeCount || 0)
    const deletable = item.deletable === true || item.deletable === 'true'
    return {
      ...item,
      recipeCount,
      countText: `${recipeCount} 个菜谱`,
      showDelete: deletable && recipeCount === 0
    }
  })
}

module.exports = {
  buildRecipeCategoryManagerItems
}
