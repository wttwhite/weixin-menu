const { createRecipeService } = require('../../services/recipe')
const { createMealPlanService } = require('../../services/meal-plan')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { switchToTab, syncCurrentTabBar } = require('../../utils/tab-bar')
const { syncPageTheme } = require('../../utils/theme')
const {
  buildRecipeSectionOptions,
  filterRecipesBySection,
  formatRecommendationStars,
  getRecipeCoverImageSrc
} = require('../../utils/recipe-view')
const DEFAULT_CATEGORY_SUMMARY = '共享菜谱 · 适合家庭点单'
const PLAN_MEAL_TYPE_OPTIONS = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '加餐', value: 'snack' }
]

function createDateLabel(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  return `${year}/${month}/${day}`
}

function createIsoDate(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createDateOptionLabel(dateText = '') {
  const parts = String(dateText).split('-')
  if (parts.length !== 3) {
    return dateText
  }
  return `${parts[1]}月${parts[2]}日`
}

function buildUpcomingDateOptions(now = new Date(), days = 7) {
  const results = []
  for (let offset = 0; offset < days; offset += 1) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    const value = createIsoDate(next)
    results.push({
      value,
      label: createDateOptionLabel(value)
    })
  }
  return results
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

function buildRecipeSummary(total = 0, limit = 0, hasMore = false) {
  if (!total) {
    return '这个空间还没有菜谱，先创建第一道拿手菜吧。'
  }
  if (hasMore && limit > 0) {
    return `当前空间共 ${total} 道菜谱，当前显示前 ${limit} 道。`
  }
  return `当前空间共 ${total} 道菜谱，可按分类和标签快速浏览。`
}

function buildRecipeTruncationMessage(limit = 0, hasMore = false) {
  if (!hasMore || limit <= 0) {
    return ''
  }
  return `当前仅显示前 ${limit} 道菜谱，请继续筛选以缩小范围。`
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

function normalizeSearchQuery(value = '') {
  return String(value || '').trim().toLowerCase()
}

function collectRecipeSearchText(item = {}) {
  const tagText = (Array.isArray(item.tags) ? item.tags : [])
    .map((tag) => (tag && tag.name) || '')
    .join(' ')
  const ingredientText = (Array.isArray(item.ingredients) ? item.ingredients : [])
    .map((ingredient) => (ingredient && ingredient.name) || '')
    .join(' ')
  return [
    item.name,
    item.summary,
    item.category,
    item.categorySummary,
    tagText,
    ingredientText
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function filterRecipesBySearch(items = [], query = '') {
  const normalizedQuery = normalizeSearchQuery(query)
  if (!normalizedQuery) {
    return items
  }

  return (items || []).filter((item) => collectRecipeSearchText(item).includes(normalizedQuery))
}

function buildFilteredVisibleRecipeCards(items = [], activeSectionKey = 'all', query = '') {
  return buildVisibleRecipeCards(
    filterRecipesBySearch(filterRecipesBySection(items, activeSectionKey), query)
  )
}

function buildSearchToggleClass(query = '') {
  return normalizeSearchQuery(query)
    ? 'management-card__search management-card__search--active'
    : 'management-card__search'
}

function buildSearchPanelClass(showSearchPanel = false) {
  return showSearchPanel
    ? 'management-card__search-panel management-card__search-panel--open'
    : 'management-card__search-panel'
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

function buildSelectedRecipeItems(items = [], selectedRecipeIds = []) {
  const selectedIdSet = new Set(selectedRecipeIds || [])
  return (items || []).filter((item) => selectedIdSet.has(item._id))
}

function buildMealPlanRecipePayloadFromRecipe(item = {}) {
  return {
    recipeId: item._id || item.recipeId || '',
    recipeNameSnapshot: item.name || item.recipeNameSnapshot || '',
    servingsOverride: item.servingsOverride || '',
    notes: item.notes || ''
  }
}

function mergeMealPlanRecipes(existingRecipes = [], selectedRecipes = []) {
  const merged = Array.isArray(existingRecipes) ? existingRecipes.slice() : []
  const existingIdSet = new Set(merged.map((item) => item && item.recipeId).filter(Boolean))

  ;(selectedRecipes || []).forEach((item) => {
    const recipe = buildMealPlanRecipePayloadFromRecipe(item)
    if (!recipe.recipeId || existingIdSet.has(recipe.recipeId)) {
      return
    }
    merged.push(recipe)
    existingIdSet.add(recipe.recipeId)
  })

  return merged
}

function findPageByRoute(route = '') {
  if (typeof getCurrentPages !== 'function') {
    return null
  }

  const pages = getCurrentPages()
  if (!Array.isArray(pages) || !pages.length) {
    return null
  }

  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index] || null
    if (page && (page.route || '') === route) {
      return page
    }
  }

  return null
}

function normalizeRefreshText(value = '') {
  return typeof value === 'string' ? value.trim() : ''
}

function markPendingMealPlansRefresh(targetDate = '') {
  if (typeof getApp !== 'function') {
    return false
  }

  const app = getApp()
  if (!app || !app.globalData) {
    return false
  }

  app.globalData.pendingMealPlansRefresh = {
    spaceId: getActiveSpaceId(),
    targetDate: normalizeRefreshText(targetDate)
  }
  return true
}

function markMealPlansPageForRefresh(targetDate = '') {
  markPendingMealPlansRefresh(targetDate)
  const mealPlansPage = findPageByRoute('pages/meal-plans/index')
  if (!mealPlansPage || typeof mealPlansPage.markNeedsRefreshOnNextShow !== 'function') {
    return false
  }

  mealPlansPage.markNeedsRefreshOnNextShow(targetDate)
  return true
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

function decorateRecipeItem(item = {}) {
  return {
    ...item,
    tagSummary: buildTagSummary(item.tags || []),
    categorySummary: buildCategorySummary(item),
    metricSummary: buildMetricSummary(item),
    coverImageUrl: getRecipeCoverImageSrc(item),
    recommendationStars: formatRecommendationStars(item.recommendationScore)
  }
}

function getRecipeCreatedTimestamp(item = {}) {
  const value = item.createdAt || item.updatedAt || ''
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function sortRecipesByCreatedTime(items = []) {
  return (items || [])
    .map((item, index) => ({
      item,
      index,
      timestamp: getRecipeCreatedTimestamp(item)
    }))
    .sort((left, right) => {
      if (right.timestamp !== left.timestamp) {
        return right.timestamp - left.timestamp
      }
      return left.index - right.index
    })
    .map(({ item }) => item)
}

function appendRecipeCategoryManagerItem(items = [], nextItem = {}) {
  if (!nextItem || !nextItem.name) {
    return items || []
  }
  if ((items || []).some((item) => item && item.name === nextItem.name)) {
    return items || []
  }
  return (items || []).concat(nextItem)
}

function replaceRecipeCategoryManagerItem(items = [], previousName = '', nextItem = {}) {
  return (items || []).map((item) => {
    if (!item || item.name !== previousName) {
      return item
    }
    return {
      ...item,
      ...nextItem
    }
  })
}

function removeRecipeCategoryManagerItem(items = [], name = '') {
  return (items || []).filter((item) => item && item.name !== name)
}

function prependRecipeItem(items = [], nextItem = {}) {
  if (!nextItem || !nextItem._id) {
    return (items || []).slice()
  }

  return [nextItem].concat((items || []).filter((item) => item && item._id !== nextItem._id))
}

function incrementRecipeCategoryCount(items = [], categoryName = '') {
  const normalizedCategoryName = typeof categoryName === 'string' ? categoryName.trim() : ''
  const nextItems = (items || []).slice()
  if (!normalizedCategoryName) {
    return nextItems
  }

  const matchedIndex = nextItems.findIndex((item) => item && item.name === normalizedCategoryName)
  if (matchedIndex === -1) {
    return nextItems.concat({
      name: normalizedCategoryName,
      recipeCount: 1,
      deletable: false
    })
  }

  nextItems[matchedIndex] = {
    ...nextItems[matchedIndex],
    recipeCount: (nextItems[matchedIndex].recipeCount || 0) + 1,
    deletable: false
  }
  return nextItems
}

function moveArrayItem(items = [], fromIndex = 0, toIndex = 0) {
  const nextItems = (items || []).slice()
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= nextItems.length ||
    toIndex >= nextItems.length ||
    fromIndex === toIndex
  ) {
    return nextItems
  }

  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function getTouchPageY(event = {}) {
  if (
    event.detail &&
    Array.isArray(event.detail.touches) &&
    event.detail.touches.length &&
    typeof event.detail.touches[0].pageY === 'number'
  ) {
    return event.detail.touches[0].pageY
  }
  if (
    event.detail &&
    Array.isArray(event.detail.changedTouches) &&
    event.detail.changedTouches.length &&
    typeof event.detail.changedTouches[0].pageY === 'number'
  ) {
    return event.detail.changedTouches[0].pageY
  }
  if (Array.isArray(event.touches) && event.touches.length && typeof event.touches[0].pageY === 'number') {
    return event.touches[0].pageY
  }
  if (
    Array.isArray(event.changedTouches) &&
    event.changedTouches.length &&
    typeof event.changedTouches[0].pageY === 'number'
  ) {
    return event.changedTouches[0].pageY
  }
  return null
}

function renameRecipeItemsCategory(items = [], previousName = '', nextName = '') {
  return (items || []).map((item) => {
    if (!item || (item.category || '') !== previousName) {
      return item
    }
    return {
      ...item,
      category: nextName
    }
  })
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
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
    showSearchPanel: false,
    recipeSearchQuery: '',
    searchToggleClass: buildSearchToggleClass(''),
    searchPanelClass: buildSearchPanelClass(false),
    showCategoryManager: false,
    categoryManagerLoading: false,
    categoryManagerInput: '',
    categoryManagerItems: [],
    categoryManagerViewItems: [],
    categoryManagerDraggingIndex: -1,
    selectedRecipeIds: [],
    selectedRecipesCount: 0,
    showPlanModal: false,
    submittingPlanSelection: false,
    planModalDate: createIsoDate(),
    planModalMealType: 'dinner',
    planModalDateOptions: buildUpcomingDateOptions(),
    planModalMealTypeOptions: PLAN_MEAL_TYPE_OPTIONS,
    planModalSelectedRecipes: [],
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
    summary: '正在读取菜谱...',
    recipeListTotal: 0,
    recipeListLimit: 0,
    recipeListHasMore: false,
    railScrollHeight: 400,
    surfaceScrollHeight: 400
  },

  onReady() {
    this.updateScrollableHeights()
  },

  onShow() {
    syncPageTheme(this)
    syncCurrentTabBar(this, '/pages/recipes/index')
    if (this.consumeQueuedCreatedRecipe()) {
      return
    }
    if (this.consumeSuppressedOnShowReload()) {
      return
    }
    if (this.shouldReuseLoadedState()) {
      return
    }
    this.loadRecipes()
  },

  async onPullDownRefresh() {
    await this.loadRecipes()
    wx.stopPullDownRefresh()
  },

  updateScrollableHeights() {
    if (typeof wx === 'undefined' || typeof wx.createSelectorQuery !== 'function') {
      return
    }

    const query = wx.createSelectorQuery().in(this)
    query.select('.channel-layout').boundingClientRect()
    query.select('.channel-surface').boundingClientRect()
    query.exec((res) => {
      const next = {}
      if (res[0] && res[0].height > 0 && res[0].height !== this.data.railScrollHeight) {
        next.railScrollHeight = res[0].height
      }
      if (res[1] && res[1].height > 0 && res[1].height !== this.data.surfaceScrollHeight) {
        next.surfaceScrollHeight = res[1].height
      }
      if (Object.keys(next).length) {
        this.setData(next)
      }
    })
  },

  syncRecipeView(overrides = {}) {
    const nextState = {
      ...this.data,
      ...overrides
    }
    const items = sortRecipesByCreatedTime(nextState.items || []).map((item) => decorateRecipeItem(item))
    const categoryManagerItems = Array.isArray(nextState.categoryManagerItems)
      ? nextState.categoryManagerItems.filter(
          (item) => item && typeof item.name === 'string' && typeof item.recipeCount === 'number'
        )
      : []
    const sectionOptions = buildSectionOptionsFromManagedCategories(categoryManagerItems, items)
    const availableSectionKeySet = new Set(sectionOptions.map((item) => item.key))
    const activeSectionKey = availableSectionKeySet.has(nextState.activeSectionKey)
      ? nextState.activeSectionKey
      : 'all'
    const selectedRecipeIds = clampSelectedRecipeIds(items, nextState.selectedRecipeIds || [])
    const itemsWithSelection = applySelectionState(items, selectedRecipeIds)
    const recipeSearchQuery = nextState.recipeSearchQuery || ''
    const visibleItems = buildFilteredVisibleRecipeCards(itemsWithSelection, activeSectionKey, recipeSearchQuery)
    const heroImages = buildHeroImages(itemsWithSelection)

    this.setData({
      ...overrides,
      items: itemsWithSelection,
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
      planModalSelectedRecipes: buildSelectedRecipeItems(itemsWithSelection, selectedRecipeIds),
      recipeSearchQuery,
      searchToggleClass: buildSearchToggleClass(recipeSearchQuery),
      searchPanelClass: buildSearchPanelClass(Boolean(nextState.showSearchPanel)),
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      sectionViewItems: buildSectionViewItems(sectionOptions, activeSectionKey),
      showVisibleItems: visibleItems.length > 0,
      visibleItems,
      showEmptyState: !items.length,
      ...buildEmptyStateView(items, nextState.activeSpaceId)
    }, () => {
      this.updateScrollableHeights()
    })
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
        showPlanModal: false,
        submittingPlanSelection: false,
        planModalDate: createIsoDate(),
        planModalMealType: 'dinner',
        planModalDateOptions: buildUpcomingDateOptions(),
        planModalSelectedRecipes: [],
        visibleItemsCountText: '0 道菜',
        sectionViewItems: buildSectionViewItems([{ key: 'all', label: '全部' }], 'all'),
        showVisibleItems: false,
        showEmptyState: false,
        ...buildEmptyStateView([], ''),
        truncationMessage: '',
        recipeListTotal: 0,
        recipeListLimit: 0,
        recipeListHasMore: false,
        summary: '请先选择一个空间，再开始管理共享菜谱。'
      })
      this.hasLoadedRecipesOnce = true
      return
    }

    try {
      const service = createRecipeService()
      const [result, categoryResult] = await Promise.all([
        service.listRecipes(activeSpaceId),
        service.listRecipeCategories(activeSpaceId)
      ])
      const items = result.items || []
      const categoryManagerItems = Array.isArray(categoryResult.items)
        ? categoryResult.items.filter(
            (item) => item && typeof item.name === 'string' && typeof item.recipeCount === 'number'
          )
        : []
      const total = typeof result.total === 'number' ? result.total : items.length
      const limit = typeof result.limit === 'number' && result.limit > 0 ? result.limit : 0
      const hasMore = Boolean(result.hasMore) || (limit > 0 && total > limit)
      this.syncRecipeView({
        loading: false,
        items,
        categoryManagerItems,
        recipeListTotal: total,
        recipeListLimit: limit,
        recipeListHasMore: hasMore,
        truncationMessage: buildRecipeTruncationMessage(limit, hasMore),
        summary: buildRecipeSummary(total, limit, hasMore)
      })
      this.hasLoadedRecipesOnce = true
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
        showPlanModal: false,
        submittingPlanSelection: false,
        planModalDate: createIsoDate(),
        planModalMealType: 'dinner',
        planModalDateOptions: buildUpcomingDateOptions(),
        planModalSelectedRecipes: [],
        visibleItemsCountText: '0 道菜',
        sectionViewItems: buildSectionViewItems([{ key: 'all', label: '全部' }], 'all'),
        showVisibleItems: false,
        showEmptyState: false,
        ...buildEmptyStateView([], activeSpaceId),
        recipeListTotal: 0,
        recipeListLimit: 0,
        recipeListHasMore: false,
        errorMessage: getErrorMessage(error),
        truncationMessage: '',
        summary: '菜谱加载失败，请稍后重试。'
      })
      this.hasLoadedRecipesOnce = false
    }
  },

  goCreate() {
    const activeCategory = this.data.activeSectionKey && this.data.activeSectionKey !== 'all'
      ? this.data.activeSectionKey
      : ''
    wx.navigateTo({
      url: activeCategory
        ? `/pages/recipe-edit/index?category=${encodeURIComponent(activeCategory)}`
        : '/pages/recipe-edit/index'
    })
  },

  handleSectionChange(event) {
    const key = event.currentTarget.dataset.key || 'all'
    const visibleItems = buildFilteredVisibleRecipeCards(this.data.items || [], key, this.data.recipeSearchQuery)
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

  toggleSearchPanel() {
    const showSearchPanel = !this.data.showSearchPanel
    this.setData({
      showSearchPanel,
      searchPanelClass: buildSearchPanelClass(showSearchPanel)
    })
  },

  handleRecipeSearchInput(event) {
    const recipeSearchQuery = event && event.detail ? event.detail.value || '' : ''
    const visibleItems = buildFilteredVisibleRecipeCards(
      this.data.items || [],
      this.data.activeSectionKey || 'all',
      recipeSearchQuery
    )
    this.setData({
      recipeSearchQuery,
      searchToggleClass: buildSearchToggleClass(recipeSearchQuery),
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      showVisibleItems: visibleItems.length > 0,
      visibleItems
    })
  },

  clearRecipeSearch() {
    const visibleItems = buildFilteredVisibleRecipeCards(
      this.data.items || [],
      this.data.activeSectionKey || 'all',
      ''
    )
    this.setData({
      recipeSearchQuery: '',
      searchToggleClass: buildSearchToggleClass(''),
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      showVisibleItems: visibleItems.length > 0,
      visibleItems
    })
  },

  queueCreatedRecipe(recipe = {}) {
    this.pendingCreatedRecipe = recipe && recipe._id ? { ...recipe } : null
    this.skipNextOnShowReload = false
    this.forceRefreshOnNextShow = false
  },

  suppressNextOnShowReload() {
    this.skipNextOnShowReload = true
  },

  markNeedsRefreshOnNextShow() {
    this.forceRefreshOnNextShow = true
    this.skipNextOnShowReload = false
  },

  consumeSuppressedOnShowReload() {
    if (!this.skipNextOnShowReload) {
      return false
    }

    this.skipNextOnShowReload = false
    return this.data.activeSpaceId === getActiveSpaceId()
  },

  shouldReuseLoadedState() {
    if (this.forceRefreshOnNextShow) {
      this.forceRefreshOnNextShow = false
      return false
    }

    return Boolean(this.hasLoadedRecipesOnce) &&
      !this.data.errorMessage &&
      this.data.activeSpaceId === getActiveSpaceId()
  },

  consumeQueuedCreatedRecipe() {
    if (!this.pendingCreatedRecipe) {
      return false
    }

    const createdRecipe = this.pendingCreatedRecipe
    this.pendingCreatedRecipe = null
    return this.applyCreatedRecipe(createdRecipe)
  },

  applyCreatedRecipe(recipe = {}) {
    if (!recipe || !recipe._id) {
      return false
    }

    const currentItems = Array.isArray(this.data.items) ? this.data.items : []
    const currentTotal =
      typeof this.data.recipeListTotal === 'number' && this.data.recipeListTotal > 0
        ? this.data.recipeListTotal
        : currentItems.length
    const alreadyExists = currentItems.some((item) => item && item._id === recipe._id)
    const nextTotal = alreadyExists ? currentTotal : currentTotal + 1
    const nextLimit = typeof this.data.recipeListLimit === 'number' ? this.data.recipeListLimit : 0
    let nextItems = prependRecipeItem(currentItems, recipe)
    let nextHasMore = Boolean(this.data.recipeListHasMore)

    if (nextLimit > 0 && nextItems.length > nextLimit) {
      nextItems = nextItems.slice(0, nextLimit)
      nextHasMore = true
    }

    this.syncRecipeView({
      loading: false,
      items: nextItems,
      categoryManagerItems: alreadyExists
        ? this.data.categoryManagerItems || []
        : incrementRecipeCategoryCount(this.data.categoryManagerItems || [], recipe.category || ''),
      recipeListTotal: nextTotal,
      recipeListLimit: nextLimit,
      recipeListHasMore: nextHasMore,
      truncationMessage: buildRecipeTruncationMessage(nextLimit, nextHasMore),
      summary: buildRecipeSummary(nextTotal, nextLimit, nextHasMore)
    })
    this.hasLoadedRecipesOnce = true
    return true
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

  syncSelectedRecipes(nextSelectedRecipeIds = []) {
    const nextItems = applySelectionState(this.data.items || [], nextSelectedRecipeIds)
    const visibleItems = buildFilteredVisibleRecipeCards(
      nextItems,
      this.data.activeSectionKey || 'all',
      this.data.recipeSearchQuery
    )

    this.setData({
      selectedRecipeIds: nextSelectedRecipeIds,
      selectedRecipesCount: nextSelectedRecipeIds.length,
      planModalSelectedRecipes: buildSelectedRecipeItems(nextItems, nextSelectedRecipeIds),
      items: nextItems,
      visibleItemsCountText: `${visibleItems.length} 道菜`,
      showVisibleItems: visibleItems.length > 0,
      visibleItems
    })
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

    this.syncSelectedRecipes(nextSelectedRecipeIds)
  },

  removePlanModalRecipe(event) {
    const recipeId = event.currentTarget.dataset.recipeId || ''
    if (!recipeId) {
      return
    }

    this.syncSelectedRecipes((this.data.selectedRecipeIds || []).filter((item) => item !== recipeId))
  },

  clearSelectedRecipes() {
    this.syncSelectedRecipes([])
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

    this.setData({
      showPlanModal: true,
      submittingPlanSelection: false,
      planModalDate: createIsoDate(),
      planModalMealType: 'dinner',
      planModalDateOptions: buildUpcomingDateOptions(),
      planModalSelectedRecipes: buildSelectedRecipeItems(this.data.items || [], this.data.selectedRecipeIds || [])
    })
  },

  closePlanModal() {
    this.setData({
      showPlanModal: false,
      submittingPlanSelection: false
    })
  },

  handlePlanDateChange(event) {
    this.setData({
      planModalDate: event && event.detail ? event.detail.value : this.data.planModalDate
    })
  },

  handlePlanDateShortcutSelect(event) {
    const date = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.date || this.data.planModalDate
      : this.data.planModalDate
    this.setData({
      planModalDate: date
    })
  },

  handlePlanMealTypeChange(event) {
    const mealType = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.mealType || 'dinner'
      : 'dinner'
    this.setData({
      planModalMealType: mealType
    })
  },

  async submitPlanSelection() {
    if (this.data.submittingPlanSelection || !this.data.activeSpaceId) {
      return
    }

    const selectedRecipes = buildSelectedRecipeItems(this.data.items || [], this.data.selectedRecipeIds || [])
    if (!selectedRecipes.length) {
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: '请先选择菜谱',
          icon: 'none'
        })
      }
      return
    }

    const service = createMealPlanService()
    this.setData({
      submittingPlanSelection: true
    })

    try {
      const listResult = await service.listMealPlans(this.data.activeSpaceId)
      const mealPlans = Array.isArray(listResult.items) ? listResult.items : []
      const targetPlan = mealPlans.find(
        (item) => item && item.planDate === this.data.planModalDate && item.mealType === this.data.planModalMealType
      )
      const selectedPayloadRecipes = selectedRecipes.map((item) => buildMealPlanRecipePayloadFromRecipe(item))

      if (targetPlan && targetPlan._id) {
        const mergedRecipes = mergeMealPlanRecipes(targetPlan.recipes || [], selectedPayloadRecipes)
        await service.updateMealPlan(this.data.activeSpaceId, targetPlan._id, {
          planDate: this.data.planModalDate,
          mealType: this.data.planModalMealType,
          notes: targetPlan.notes || '',
          recipes: mergedRecipes
        })
      } else {
        await service.createMealPlan(this.data.activeSpaceId, {
          planDate: this.data.planModalDate,
          mealType: this.data.planModalMealType,
          notes: '',
          recipes: selectedPayloadRecipes
        })
      }

      markMealPlansPageForRefresh(this.data.planModalDate)
      this.clearSelectedRecipes()
      this.setData({
        showPlanModal: false,
        submittingPlanSelection: false
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: `已加入 ${this.data.planModalDate}`,
          icon: 'success'
        })
      }
    } catch (error) {
      this.setData({
        submittingPlanSelection: false
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
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
      showCategoryManager: true,
      categoryManagerDraggingIndex: -1
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
    this.categoryManagerDragState = null
    this.setData({
      showCategoryManager: false,
      categoryManagerInput: '',
      categoryManagerDraggingIndex: -1
    })
  },

  handleCategoryManagerInput(event) {
    this.setData({
      categoryManagerInput: event && event.detail ? event.detail.value : ''
    })
  },

  async submitCategoryManagerCreate() {
    const name = (this.data.categoryManagerInput || '').trim()
    if (!name) {
      return
    }

    try {
      const result = await createRecipeService().createRecipeCategory(this.data.activeSpaceId, name)
      const nextCategoryManagerItems = appendRecipeCategoryManagerItem(this.data.categoryManagerItems || [], result.item || {
        name,
        recipeCount: 0,
        deletable: true
      })
      this.syncRecipeView({
        categoryManagerInput: '',
        categoryManagerItems: nextCategoryManagerItems
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: '已添加分类',
          icon: 'success'
        })
      }
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
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const detail = event && event.detail ? event.detail : {}
    const previousName = dataset.name || detail.name || ''
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
      const result = await createRecipeService().updateRecipeCategory(
        this.data.activeSpaceId,
        previousName,
        nextName
      )
      const nextCategoryManagerItems = replaceRecipeCategoryManagerItem(
        this.data.categoryManagerItems || [],
        previousName,
        result.item || {
          name: nextName
        }
      )
      this.syncRecipeView({
        activeSectionKey: this.data.activeSectionKey === previousName ? nextName : this.data.activeSectionKey,
        categoryManagerItems: nextCategoryManagerItems,
        items: renameRecipeItemsCategory(this.data.items || [], previousName, nextName)
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: '已更新分类',
          icon: 'success'
        })
      }
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
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const detail = event && event.detail ? event.detail : {}
    const name = dataset.name || detail.name || ''
    const deletable =
      dataset.deletable === true ||
      dataset.deletable === 'true' ||
      detail.deletable === true ||
      detail.deletable === 'true'
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
      this.syncRecipeView({
        categoryManagerItems: removeRecipeCategoryManagerItem(this.data.categoryManagerItems || [], name)
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: '已删除分类',
          icon: 'success'
        })
      }
    } catch (error) {
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
  }
,

  handleCategoryManagerDragStart(event) {
    const index = Number(event && event.detail ? event.detail.index : -1)
    const touchPageY = getTouchPageY(event)
    const items = (this.data.categoryManagerItems || []).slice()
    if (!Number.isInteger(index) || index < 0 || index >= items.length || typeof touchPageY !== 'number') {
      return
    }

    this.categoryManagerDragState = {
      startIndex: index,
      currentIndex: index,
      startY: touchPageY,
      snapshotItems: items,
      dirty: false
    }
    this.setData({
      categoryManagerDraggingIndex: index
    })
  },

  handleCategoryManagerDragMove(event) {
    if (!this.categoryManagerDragState) {
      return
    }

    const touchPageY = getTouchPageY(event)
    if (typeof touchPageY !== 'number') {
      return
    }

    const currentItems = (this.data.categoryManagerItems || []).slice()
    const deltaY = touchPageY - this.categoryManagerDragState.startY
    if (Math.abs(deltaY) < 56) {
      return
    }

    const direction = deltaY > 0 ? 1 : -1
    const nextIndex = Math.max(0, Math.min(currentItems.length - 1, this.categoryManagerDragState.currentIndex + direction))
    if (nextIndex === this.categoryManagerDragState.currentIndex) {
      this.categoryManagerDragState.startY = touchPageY
      return
    }

    const nextItems = moveArrayItem(currentItems, this.categoryManagerDragState.currentIndex, nextIndex)
    this.categoryManagerDragState.currentIndex = nextIndex
    this.categoryManagerDragState.startY = touchPageY
    this.categoryManagerDragState.dirty = true
    this.setData({
      categoryManagerItems: nextItems,
      categoryManagerViewItems: buildCategoryManagerViewItems(nextItems),
      categoryManagerDraggingIndex: nextIndex
    })
  },

  async handleCategoryManagerDragEnd() {
    if (!this.categoryManagerDragState) {
      return
    }

    const dragState = this.categoryManagerDragState
    this.categoryManagerDragState = null

    if (!dragState.dirty) {
      this.setData({
        categoryManagerDraggingIndex: -1
      })
      return
    }

    const reorderedItems = (this.data.categoryManagerItems || []).slice()
    const names = reorderedItems.map((item) => item.name)

    try {
      const result = await createRecipeService().reorderRecipeCategories(this.data.activeSpaceId, names)
      this.syncRecipeView({
        categoryManagerItems: Array.isArray(result.items) ? result.items : reorderedItems,
        categoryManagerDraggingIndex: -1
      })
    } catch (error) {
      this.syncRecipeView({
        categoryManagerItems: dragState.snapshotItems,
        categoryManagerDraggingIndex: -1
      })
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      }
    }
  },

  handleCategoryManagerDragCancel() {
    if (!this.categoryManagerDragState) {
      return
    }

    const dragState = this.categoryManagerDragState
    this.categoryManagerDragState = null
    this.setData({
      categoryManagerItems: dragState.snapshotItems,
      categoryManagerViewItems: buildCategoryManagerViewItems(dragState.snapshotItems),
      categoryManagerDraggingIndex: -1
    })
  }
})
