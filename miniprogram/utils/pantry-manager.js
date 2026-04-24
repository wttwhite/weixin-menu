const PANTRY_MANAGER_CONFIG = {
  category: {
    type: 'category',
    mode: 'pantry-category',
    title: '食材分类',
    metaSuffix: '类',
    inputPlaceholder: '输入分类名称',
    loadingText: '正在读取分类...',
    renameTitle: '重命名分类',
    renamePlaceholder: '输入新的分类名称',
    deleteTitle: '删除分类',
    deleteLabel: '分类',
    emptyIllustration: '类',
    emptyIllustrationClass: '',
    emptyTitle: '暂无分类',
    emptyText: '还没有维护库存分类，先添加一个常用分类。',
    listMethod: 'listPantryCategories',
    createMethod: 'createPantryCategory',
    updateMethod: 'updatePantryCategory',
    deleteMethod: 'deletePantryCategory',
    reorderMethod: 'reorderPantryCategories'
  },
  location: {
    type: 'location',
    mode: 'pantry-location',
    title: '食材位置',
    metaSuffix: '处',
    inputPlaceholder: '输入位置名称',
    loadingText: '正在读取位置...',
    renameTitle: '重命名位置',
    renamePlaceholder: '输入新的位置名称',
    deleteTitle: '删除位置',
    deleteLabel: '位置',
    emptyIllustration: '位',
    emptyIllustrationClass: 'pantry-manager-modal__empty-illustration--location',
    emptyTitle: '暂无位置',
    emptyText: '还没有维护库存位置，先添加一个常用存放位置。',
    listMethod: 'listPantryLocations',
    createMethod: 'createPantryLocation',
    updateMethod: 'updatePantryLocation',
    deleteMethod: 'deletePantryLocation',
    reorderMethod: 'reorderPantryLocations'
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
      showCountBadge: pantryItemCount > 0,
      showDelete: deletable && pantryItemCount === 0
    }
  })
}

module.exports = {
  buildPantryManagerItems,
  getPantryManagerConfig
}
