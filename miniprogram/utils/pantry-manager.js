const PANTRY_MANAGER_CONFIG = {
  category: {
    mode: 'pantry-category',
    title: '食材分类',
    inputPlaceholder: '输入食材分类',
    listMethod: 'listPantryCategories',
    createMethod: 'createPantryCategory',
    updateMethod: 'updatePantryCategory',
    deleteMethod: 'deletePantryCategory'
  },
  location: {
    mode: 'pantry-location',
    title: '食材位置',
    inputPlaceholder: '输入食材位置',
    listMethod: 'listPantryLocations',
    createMethod: 'createPantryLocation',
    updateMethod: 'updatePantryLocation',
    deleteMethod: 'deletePantryLocation'
  }
}

function getPantryManagerConfig(type = 'category') {
  return PANTRY_MANAGER_CONFIG[type] || PANTRY_MANAGER_CONFIG.category
}

function buildPantryManagerItems(items = [], type = 'category') {
  return (items || []).map((item) => {
    const pantryItemCount = Number(item.pantryItemCount || item.itemCount || 0)
    const deletable = item.deletable === true || item.deletable === 'true'
    return {
      ...item,
      managerType: type,
      pantryItemCount,
      countText: `${pantryItemCount} 项食材`,
      showDelete: deletable && pantryItemCount === 0
    }
  })
}

module.exports = {
  buildPantryManagerItems,
  getPantryManagerConfig
}
