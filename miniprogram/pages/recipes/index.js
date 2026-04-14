const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { switchToTab, syncCurrentTabBar } = require('../../utils/tab-bar')
const {
  buildRecipeSectionOptions,
  filterRecipesBySection,
  formatRecommendationStars,
  getRecipeCoverImageSrc
} = require('../../utils/recipe-view')
const DEFAULT_CATEGORY_SUMMARY = '共享菜谱 · 适合家庭点单'

function createDateLabel(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  return `${year}/${month}/${day}`
}

function getSectionLabel(sectionOptions = [], activeSectionKey = 'all') {
  const matched = (sectionOptions || []).find((item) => item.key === activeSectionKey)
  return matched ? matched.label : '全部'
}

function buildHeroImages(items = []) {
  return (items || [])
    .map((item) => item.coverImageUrl)
    .filter(Boolean)
    .slice(0, 4)
}

function buildManagementCategorySummary(sectionOptions = []) {
  const labels = (sectionOptions || [])
    .filter((item) => item.key !== 'all')
    .map((item) => item.label)
    .filter(Boolean)
    .slice(0, 3)

  return labels.length ? labels.join(' · ') : DEFAULT_CATEGORY_SUMMARY
}

function buildSectionOptionsFromManagedCategories(categories = [], items = []) {
  const managedItems = (categories || []).filter(
    (item) => item && typeof item.name === 'string' && typeof item.recipeCount === 'number'
  )
  const names = Array.from(new Set(managedItems.map((item) => item.name.trim()).filter(Boolean)))

  const fallbackOptions = buildRecipeSectionOptions(items)
  for (const option of fallbackOptions) {
    if (option.key === 'all') {
      continue
    }
    if (!names.includes(option.label)) {
      names.push(option.label)
    }
  }

  return [{ key: 'all', label: '全部' }].concat(
    names.map((name) => ({
      key: name,
      label: name
    }))
  )
}

function applySelectionState(items = [], selectedRecipeIds = []) {
  const selectedIdSet = new Set(selectedRecipeIds || [])
  return (items || []).map((item) => ({
    ...item,
    selected: selectedIdSet.has(item._id),
    planUsageCount:
      typeof item.planUsageCount === 'number' && item.planUsageCount >= 0
        ? item.planUsageCount
        : 0
  }))
}

function buildSectionViewItems(sectionOptions = [], activeSectionKey = 'all') {
  return (sectionOptions || []).map((item) => ({
    ...item,
    active: item.key === activeSectionKey,
    itemClass: item.key === activeSectionKey ? 'rail-item rail-item--active' : 'rail-item'
  }))
}

function buildVisibleRecipeCards(items = []) {
  return (items || []).map((item) => {
    const servingsDisplay = item.servings || (Array.isArray(item.ingredients) ? item.ingredients.length : 0) || 1
    return {
      ...item,
      servingsDisplay: String(servingsDisplay),
      summaryDisplay: item.summary || item.categorySummary || '点击查看菜谱详情',
      selectionSymbol: item.selected ? '✓' : '+',
      selectionClass: item.selected ? 'dish-add dish-add--selected' : 'dish-add'
    }
  })
}

function buildCategoryManagerViewItems(items = []) {
  return (items || []).map((item) => ({
    ...item,
    showCountBadge: (item.recipeCount || 0) > 0,
    countText: `${item.recipeCount || 0}个菜谱`,
    showDelete: !((item.recipeCount || 0) > 0)
  }))
}

function buildEmptyStateView(items = [], activeSpaceId = '') {
  if (!activeSpaceId) {
    return {
      emptyTitle: '先选择一个空间',
      emptyText: '空间用于团队共享菜谱、库存、计划和采购数据。',
      emptyButtonText: '前往选择空间'
    }
  }

  if ((items || []).length) {
    return {
      emptyTitle: '当前分类没有菜谱',
      emptyText: '换个分类看看，或把这类菜先录入进来。',
      emptyButtonText: '录入这类菜谱'
    }
  }

  return {
    emptyTitle: '还没有菜谱',
    emptyText: '添加第一道菜并维护配料、步骤和标签。',
    emptyButtonText: '立即添加'
  }
}

function clampSelectedRecipeIds(items = [], selectedRecipeIds = []) {
  const availableIdSet = new Set((items || []).map((item) => item._id).filter(Boolean))
  return (selectedRecipeIds || []).filter((id) => availableIdSet.has(id))
}

function buildTagSummary(tags = []) {
  return (tags || [])
    .map((tag) => tag.name)
    .filter(Boolean)
    .join(' / ')
}

function buildCategorySummary(item = {}) {
  const parts = [item.category, item.cuisine, item.difficulty].filter(Boolean)
  return parts.join(' · ') || '未分类'
}

function buildMetricSummary(item = {}) {
  const parts = []
  if (item.recommendationScore !== '' && item.recommendationScore !== null && item.recommendationScore !== undefined) {
    parts.push(`推荐 ${item.recommendationScore}`)
  }
  if (item.servings !== '' && item.servings !== null && item.servings !== undefined) {
    parts.push(`${item.servings} 人份`)
  }
  if (item.prepTimeMinutes !== '' && item.prepTimeMinutes !== null && item.prepTimeMinutes !== undefined) {
    parts.push(`准备 ${item.prepTimeMinutes} 分钟`)
  }
  if (item.cookTimeMinutes !== '' && item.cookTimeMinutes !== null && item.cookTimeMinutes !== undefined) {
    parts.push(`烹饪 ${item.cookTimeMinutes} 分钟`)
  }
  return parts.join(' · ')
}

Page({
  data: {
    loading: true,
    currentDateLabel: createDateLabel(),
    activeSpaceId: '',
    items: [],
    visibleItems: [],
    sectionOptions: [{ key: 'all', label: '全部' }],
    activeSectionKey: 'all',
    activeSectionLabel: '全部',
    heroImages: [],
    heroPrimaryImageUrl: '',
    heroThumbImages: [],
    managementImageUrl: '',
    managementRecipeCountText: '共 0 个菜谱',
    managementCategorySummary: DEFAULT_CATEGORY_SUMMARY,
    showCategoryManager: false,
    categoryManagerLoading: false,
    categoryManagerInput: '',
    categoryManagerItems: [],
    categoryManagerViewItems: [],
    selectedRecipeIds: [],
    selectedRecipesCount: 0,
    visibleItemsCountText: '0 道菜',
    sectionViewItems: [],
    showHeroThumbs: false,
    showVisibleItems: false,
    emptyTitle: '还没有菜谱',
    emptyText: '添加第一道菜并维护配料、步骤和标签。',
    emptyButtonText: '立即添加',
    showEmptyState: false,
    errorMessage: '',
    truncationMessage: '',
    summary: '正在读取菜谱...'
  },

  onShow() {
    syncCurrentTabBar(this, '/pages/recipes/index')
    this.loadRecipes()
  },

  async onPullDownRefresh() {
    await this.loadRecipes()
    wx.stopPullDownRefresh()
  },

  async loadRecipes() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      currentDateLabel: createDateLabel(),
      activeSpaceId,
      errorMessage: ''
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        items: [],
        visibleItems: [],
        sectionOptions: [{ key: 'all', label: '全部' }],
        activeSectionKey: 'all',
        activeSectionLabel: '全部',
        heroImages: [],
        heroPrimaryImageUrl: '',
        heroThumbImages: [],
        showHeroThumbs: false,
        managementImageUrl: '',
        managementRecipeCountText: '共 0 个菜谱',
        managementCategorySummary: DEFAULT_CATEGORY_SUMMARY,
        selectedRecipeIds: [],
        selectedRecipesCount: 0,
        visibleItemsCountText: '0 道菜',
        sectionViewItems: buildSectionViewItems([{ key: 'all', label: '全部' }], 'all'),
        showVisibleItems: false,
        showEmptyState: false,
        ...buildEmptyStateView([], ''),
        truncationMessage: '',
        summary: '请先选择一个空间，再开始管理共享菜谱。'
      })
      return
    }

    try {
      const service = createRecipeService()
      const [result, categoryResult] = await Promise.all([
        service.listRecipes(activeSpaceId),
        service.listRecipeCategories(activeSpaceId)
      ])
      const items = (result.items || []).map((item) => ({
        ...item,
        tagSummary: buildTagSummary(item.tags || []),
        categorySummary: buildCategorySummary(item),
        metricSummary: buildMetricSummary(item),
        coverImageUrl: getRecipeCoverImageSrc(item),
        recommendationStars: formatRecommendationStars(item.recommendationScore)
      }))
      const categoryManagerItems = Array.isArray(categoryResult.items)
        ? categoryResult.items.filter(
            (item) => item && typeof item.name === 'string' && typeof item.recipeCount === 'number'
          )
        : []
      const sectionOptions = buildSectionOptionsFromManagedCategories(categoryManagerItems, items)
      const availableSectionKeySet = new Set(sectionOptions.map((item) => item.key))
      const activeSectionKey = availableSectionKeySet.has(this.data.activeSectionKey)
        ? this.data.activeSectionKey
        : 'all'
      const selectedRecipeIds = clampSelectedRecipeIds(items, this.data.selectedRecipeIds || [])
      const itemsWithSelection = applySelectionState(items, selectedRecipeIds)
      const visibleItems = filterRecipesBySection(itemsWithSelection, activeSectionKey)
      const visibleRecipeCards = buildVisibleRecipeCards(visibleItems)
      const heroImages = buildHeroImages(itemsWithSelection)
      const total = typeof result.total === 'number' ? result.total : items.length
      const limit =
        typeof result.limit === 'number' && result.limit > 0 ? result.limit : items.length
      const hasMore = Boolean(result.hasMore) || (limit > 0 && total > limit)
      this.setData({
        loading: false,
        items: itemsWithSelection,
        visibleItems,
        sectionOptions,
        activeSectionKey,
        activeSectionLabel: getSectionLabel(sectionOptions, activeSectionKey),
        heroImages,
        heroPrimaryImageUrl: heroImages[0] || '',
        heroThumbImages: heroImages.slice(1, 4),
        showHeroThumbs: heroImages.length > 1,
        managementImageUrl: itemsWithSelection[0] ? itemsWithSelection[0].coverImageUrl || '' : '',
        managementRecipeCountText: `共 ${items.length} 个菜谱`,
        managementCategorySummary: buildManagementCategorySummary(sectionOptions),
        categoryManagerItems,
        categoryManagerViewItems: buildCategoryManagerViewItems(categoryManagerItems),
        selectedRecipeIds,
        selectedRecipesCount: selectedRecipeIds.length,
        visibleItemsCountText: `${visibleItems.length} 道菜`,
        sectionViewItems: buildSectionViewItems(sectionOptions, activeSectionKey),
        showVisibleItems: visibleRecipeCards.length > 0,
        visibleItems: visibleRecipeCards,
        showEmptyState: !items.length,
        ...buildEmptyStateView(items, activeSpaceId),
        truncationMessage: hasMore ? `当前仅显示前 ${limit} 道菜谱，请继续筛选以缩小范围。` : '',
        summary: items.length
          ? hasMore
            ? `当前空间共 ${total} 道菜谱，当前显示前 ${limit} 道。`
            : `当前空间共 ${total} 道菜谱，可按分类和标签快速浏览。`
          : '这个空间还没有菜谱，先创建第一道拿手菜吧。'
      })
    } catch (error) {
      this.setData({
        loading: false,
        items: [],
        visibleItems: [],
        sectionOptions: [{ key: 'all', label: '全部' }],
        activeSectionKey: 'all',
        activeSectionLabel: '全部',
        heroImages: [],
        heroPrimaryImageUrl: '',
        heroThumbImages: [],
        showHeroThumbs: false,
        managementImageUrl: '',
        managementRecipeCountText: '共 0 个菜谱',
        managementCategorySummary: DEFAULT_CATEGORY_SUMMARY,
        categoryManagerItems: [],
        categoryManagerViewItems: [],
        selectedRecipeIds: [],
        selectedRecipesCount: 0,
        visibleItemsCountText: '0 道菜',
        sectionViewItems: buildSectionViewItems([{ key: 'all', label: '全部' }], 'all'),
        showVisibleItems: false,
        showEmptyState: false,
        ...buildEmptyStateView([], activeSpaceId),
        errorMessage: getErrorMessage(error),
        truncationMessage: '',
        summary: '菜谱加载失败，请稍后重试。'
      })
    }
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/recipe-edit/index'
    })
  },

  handleSectionChange(event) {
    const key = event.currentTarget.dataset.key || 'all'
    const visibleItems = buildVisibleRecipeCards(filterRecipesBySection(this.data.items || [], key))
    this.setData({
      activeSectionKey: key,
      activeSectionLabel: getSectionLabel(this.data.sectionOptions || [], key),
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      sectionViewItems: buildSectionViewItems(this.data.sectionOptions || [], key),
      showVisibleItems: visibleItems.length > 0,
      visibleItems,
      ...buildEmptyStateView(this.data.items || [], this.data.activeSpaceId)
    })
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  },

  handleSelectRecipe(event) {
    const recipeId = event.detail.recipeId
    if (!recipeId) {
      return
    }

    wx.navigateTo({
      url: `/pages/recipe-detail/index?recipeId=${recipeId}`
    })
  },

  handleEditRecipe(event) {
    const recipeId = event.detail.recipeId
    if (!recipeId) {
      return
    }

    wx.navigateTo({
      url: `/pages/recipe-edit/index?recipeId=${recipeId}`
    })
  },

  goPantry() {
    switchToTab('/pages/pantry/index')
  },

  goMealPlans() {
    switchToTab('/pages/meal-plans/index')
  },

  goShopping() {
    switchToTab('/pages/shopping/index')
  },

  toggleRecipeSelection(event) {
    const recipeId = event.currentTarget.dataset.recipeId || ''
    if (!recipeId) {
      return
    }

    const current = this.data.selectedRecipeIds || []
    const nextSelectedRecipeIds = current.indexOf(recipeId) === -1
      ? current.concat(recipeId)
      : current.filter((item) => item !== recipeId)
    const nextItems = applySelectionState(this.data.items || [], nextSelectedRecipeIds)
    const visibleItems = buildVisibleRecipeCards(
      filterRecipesBySection(nextItems, this.data.activeSectionKey || 'all')
    )

    this.setData({
      selectedRecipeIds: nextSelectedRecipeIds,
      selectedRecipesCount: nextSelectedRecipeIds.length,
      items: nextItems,
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      showVisibleItems: visibleItems.length > 0,
      visibleItems
    })
  },

  clearSelectedRecipes() {
    const nextItems = applySelectionState(this.data.items || [], [])
    const visibleItems = buildVisibleRecipeCards(
      filterRecipesBySection(nextItems, this.data.activeSectionKey || 'all')
    )
    this.setData({
      selectedRecipeIds: [],
      selectedRecipesCount: 0,
      items: nextItems,
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      showVisibleItems: visibleItems.length > 0,
      visibleItems
    })
  },

  handleRandomPick() {
    if (typeof wx.showToast === 'function') {
      wx.showToast({
        title: '随机点菜待实现',
        icon: 'none'
      })
    }
  },

  handlePlanSelectedRecipes() {
    if (typeof wx.showToast !== 'function') {
      return
    }

    if (!this.data.selectedRecipeIds || !this.data.selectedRecipeIds.length) {
      wx.showToast({
        title: '请先选择菜谱',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '加入计划待实现',
      icon: 'none'
    })
  },

  openSpaceManager() {
    return this.openCategoryManager()
  },

  openRecipeFromCard(event) {
    const recipeId = event.currentTarget.dataset.recipeId || ''
    if (!recipeId) {
      return
    }

    wx.navigateTo({
      url: `/pages/recipe-detail/index?recipeId=${recipeId}`
    })
  },

  noop() {},

  async openCategoryManager(forceReload = false) {
    if (!this.data.activeSpaceId) {
      return
    }

    this.setData({
      showCategoryManager: true
    })

    if (!forceReload && Array.isArray(this.data.categoryManagerItems) && this.data.categoryManagerItems.length) {
      return
    }

    this.setData({
      categoryManagerLoading: true
    })

    try {
      const result = await createRecipeService().listRecipeCategories(this.data.activeSpaceId)
      this.setData({
        categoryManagerItems: Array.isArray(result.items) ? result.items : [],
        categoryManagerViewItems: buildCategoryManagerViewItems(Array.isArray(result.items) ? result.items : []),
        categoryManagerLoading: false
      })
    } catch (error) {
      this.setData({
        categoryManagerLoading: false
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
  },

  closeCategoryManager() {
    this.setData({
      showCategoryManager: false,
      categoryManagerInput: ''
    })
  },

  handleCategoryManagerInput(event) {
    this.setData({
      categoryManagerInput: event.detail.value
    })
  },

  async submitCategoryManagerCreate() {
    const name = (this.data.categoryManagerInput || '').trim()
    if (!name) {
      return
    }

    try {
      await createRecipeService().createRecipeCategory(this.data.activeSpaceId, name)
      this.setData({
        categoryManagerInput: ''
      })
      await this.loadRecipes()
      await this.openCategoryManager(true)
    } catch (error) {
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
  },

  async renameCategory(event) {
    const previousName = event.currentTarget.dataset.name || ''
    if (!previousName) {
      return
    }

    const modal = await wx.showModal({
      title: '重命名分类',
      editable: true,
      placeholderText: '输入新的分类名称',
      content: previousName,
      confirmText: '保存'
    })
    if (!modal.confirm) {
      return
    }

    const nextName = (modal.content || '').trim()
    if (!nextName) {
      return
    }

    try {
      await createRecipeService().updateRecipeCategory(this.data.activeSpaceId, previousName, nextName)
      await this.loadRecipes()
      await this.openCategoryManager(true)
    } catch (error) {
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
  },

  async deleteCategory(event) {
    const name = event.currentTarget.dataset.name || ''
    const deletable =
      event.currentTarget.dataset.deletable === true ||
      event.currentTarget.dataset.deletable === 'true'
    if (!name || !deletable) {
      return
    }

    const modal = await wx.showModal({
      title: '删除分类',
      content: `确认删除分类“${name}”吗？`,
      confirmColor: '#d14b4b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      await createRecipeService().deleteRecipeCategory(this.data.activeSpaceId, name)
      await this.loadRecipes()
      await this.openCategoryManager(true)
    } catch (error) {
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
  }
})
