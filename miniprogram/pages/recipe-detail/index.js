const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { switchToTab } = require('../../utils/tab-bar')
const {
  getRecipeCoverImageSrc,
  getRecipeImageSrc
} = require('../../utils/recipe-view')
const DEFAULT_RECIPE_HERO_IMAGE = '/images/food-hero-table.svg'
const recipeDetailCache = new Map()

function buildMetricTexts(item = {}) {
  const metrics = []
  if (item.recommendationScore !== null && item.recommendationScore !== undefined && item.recommendationScore !== '') {
    metrics.push(`推荐 ${item.recommendationScore}`)
  }
  if (item.servings !== null && item.servings !== undefined && item.servings !== '') {
    metrics.push(`${item.servings} 人份`)
  }
  if (item.prepTimeMinutes !== null && item.prepTimeMinutes !== undefined && item.prepTimeMinutes !== '') {
    metrics.push(`准备 ${item.prepTimeMinutes} 分钟`)
  }
  if (item.cookTimeMinutes !== null && item.cookTimeMinutes !== undefined && item.cookTimeMinutes !== '') {
    metrics.push(`烹饪 ${item.cookTimeMinutes} 分钟`)
  }
  return metrics
}

function buildIngredientViewItems(ingredients = []) {
  return (ingredients || []).map((item, index) => ({
    ...item,
    displayIndex: index + 1,
    quantityText: `${item.quantity || '-'} ${item.unit || ''} ${item.preparation || ''}`.trim()
  }))
}

function buildStepViewItems(steps = []) {
  return (steps || []).map((item, index) => ({
    ...item,
    displayIndex: index + 1,
    titleSuffix: item.title ? `· ${item.title}` : '',
    hasTips: Boolean(item.tips)
  }))
}

function buildGalleryItems(urls = [], coverImageUrl = '') {
  return (urls || []).map((url) => ({
    url,
    isCover: url === coverImageUrl
  }))
}

function resolveRecipeHeroCoverImage(item = {}) {
  return getRecipeCoverImageSrc(item || {}) || DEFAULT_RECIPE_HERO_IMAGE
}

function buildRecipeDetailViewState(item = {}, activeSpaceId = '') {
  const coverImageUrl = resolveRecipeHeroCoverImage(item || {})
  const galleryImageUrls = ((item && item.images) || [])
    .map((image) => getRecipeImageSrc(image))
    .filter(Boolean)
  const stepViewItems = buildStepViewItems((item && item.steps) || [])
  const ingredientViewItems = buildIngredientViewItems((item && item.ingredients) || [])
  const galleryItems = buildGalleryItems(galleryImageUrls, coverImageUrl)
  const metricTexts = buildMetricTexts(item || {})
  const heroMetricTexts = []
  if (item && item.cookTimeMinutes) {
    heroMetricTexts.push(`⏱ ${item.cookTimeMinutes}`)
  }
  if (item && item.recommendationScore !== null && item.recommendationScore !== undefined && item.recommendationScore !== '') {
    heroMetricTexts.push(`★ ${item.recommendationScore}/5`)
  }

  return {
    loading: false,
    item,
    canManageRecipe: Boolean(activeSpaceId),
    heroMetaText: `${item && item.category ? item.category : '未分类'} · ${item && item.cuisine ? item.cuisine : '未设置菜系'} · ${item && item.difficulty ? item.difficulty : '难度未设置'}`,
    heroSummaryText: item && item.summary ? item.summary : '',
    heroMetricTexts,
    metricTexts,
    hasMetricTexts: metricTexts.length > 0,
    hasTags: Boolean(item && Array.isArray(item.tags) && item.tags.length),
    ingredientViewItems,
    hasIngredients: ingredientViewItems.length > 0,
    stepViewItems,
    hasSteps: stepViewItems.length > 0,
    coverImageUrl,
    galleryImageUrls,
    galleryItems,
    hasGalleryItems: galleryItems.length > 0,
    hasNotesBlock: Boolean(item && (item.notes || item.sourceName || item.sourceUrl))
  }
}

function buildRecipeDetailCacheKey(spaceId = '', recipeId = '') {
  return `${spaceId}::${recipeId}`
}

function getPageCount() {
  if (typeof getCurrentPages !== 'function') {
    return 0
  }
  return getCurrentPages().length
}

function findPreviousPageByRoute(route = '') {
  if (typeof getCurrentPages !== 'function') {
    return null
  }

  const pages = getCurrentPages()
  if (!Array.isArray(pages) || pages.length < 2) {
    return null
  }

  for (let index = pages.length - 2; index >= 0; index -= 1) {
    const page = pages[index] || null
    if (!page) {
      continue
    }
    if ((page.route || '') === route) {
      return page
    }
  }

  return null
}

function markRecipesPageForRefresh() {
  const recipesPage = findPreviousPageByRoute('pages/recipes/index')
  if (!recipesPage || typeof recipesPage.markNeedsRefreshOnNextShow !== 'function') {
    return false
  }

  recipesPage.markNeedsRefreshOnNextShow()
  return true
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    recipeId: '',
    sourcePage: '',
    item: null,
    canManageRecipe: false,
    heroMetaText: '',
    heroSummaryText: '',
    heroMetricTexts: [],
    hasMetricTexts: false,
    hasTags: false,
    hasGalleryItems: false,
    hasIngredients: false,
    hasSteps: false,
    metricTexts: [],
    ingredientViewItems: [],
    stepViewItems: [],
    galleryItems: [],
    hasNotesBlock: false,
    errorMessage: '',
    coverImageUrl: '',
    galleryImageUrls: []
  },

  onLoad(options) {
    const recipeId = options && options.recipeId ? options.recipeId : ''
    const sourcePage = options && options.from ? options.from : ''
    this.setData({
      recipeId,
      sourcePage
    })
    this.hasLoadedDetail = false
    this.shouldRefreshOnNextShow = false
  },

  onShow() {
    return this.loadDetail({
      forceRefresh: Boolean(this.shouldRefreshOnNextShow)
    })
  },

  async loadDetail(options = {}) {
    const activeSpaceId = getActiveSpaceId()
    const recipeId = this.data.recipeId
    const cacheKey = buildRecipeDetailCacheKey(activeSpaceId, recipeId)
    const forceRefresh = Boolean(options.forceRefresh)

    if (!forceRefresh && this.hasLoadedDetail && this.data.item && this.data.recipeId === recipeId) {
      return
    }

    this.setData({
      loading: true,
      activeSpaceId,
      errorMessage: ''
    })

    if (!activeSpaceId || !recipeId) {
      this.setData({
        loading: false,
        item: null,
        canManageRecipe: false,
        heroMetaText: '',
        heroSummaryText: '',
        heroMetricTexts: [],
        hasMetricTexts: false,
        hasTags: false,
        hasGalleryItems: false,
        hasIngredients: false,
        hasSteps: false,
        metricTexts: [],
        ingredientViewItems: [],
        stepViewItems: [],
        galleryItems: [],
        hasNotesBlock: false,
        errorMessage: '缺少空间或菜谱信息。',
        coverImageUrl: '',
        galleryImageUrls: []
      })
      return
    }

    try {
      if (!forceRefresh && recipeDetailCache.has(cacheKey)) {
        this.setData({
          ...recipeDetailCache.get(cacheKey),
          activeSpaceId,
          errorMessage: ''
        })
        this.hasLoadedDetail = true
        this.shouldRefreshOnNextShow = false
        return
      }

      const result = await createRecipeService().getRecipeDetail(activeSpaceId, recipeId)
      const item = result.item || null
      const nextViewState = buildRecipeDetailViewState(item, activeSpaceId)
      recipeDetailCache.set(cacheKey, nextViewState)
      this.setData(nextViewState)
      this.hasLoadedDetail = true
      this.shouldRefreshOnNextShow = false
    } catch (error) {
      this.setData({
        loading: false,
        item: null,
        canManageRecipe: false,
        heroMetaText: '',
        heroSummaryText: '',
        heroMetricTexts: [],
        hasMetricTexts: false,
        hasTags: false,
        hasGalleryItems: false,
        hasIngredients: false,
        hasSteps: false,
        metricTexts: [],
        ingredientViewItems: [],
        stepViewItems: [],
        galleryItems: [],
        hasNotesBlock: false,
        errorMessage: getErrorMessage(error),
        coverImageUrl: '',
        galleryImageUrls: []
      })
      this.shouldRefreshOnNextShow = false
    }
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.current || ''
    const urls = this.data.galleryImageUrls || []
    if (!current || !urls.length || typeof wx.previewImage !== 'function') {
      return
    }

    wx.previewImage({
      current,
      urls
    })
  },

  goEdit() {
    this.shouldRefreshOnNextShow = true
    wx.navigateTo({
      url: `/pages/recipe-edit/index?recipeId=${this.data.recipeId}`
    })
  },

  async removeRecipe() {
    if (!this.data.canManageRecipe || !this.data.recipeId) {
      return
    }

    const result = await wx.showModal({
      title: '删除菜谱',
      content: '确认删除这道菜谱吗？',
      confirmColor: '#d14b4b'
    })
    if (!result.confirm) {
      return
    }

    try {
      await createRecipeService().deleteRecipe(this.data.activeSpaceId, this.data.recipeId)
      markRecipesPageForRefresh()
      wx.showToast({
        title: '已删除菜谱',
        icon: 'success'
      })
      await this.goBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async goBack() {
    const pageCount = getPageCount()
    if (this.data.sourcePage === 'plans') {
      if (pageCount > 1 && typeof wx.navigateBack === 'function') {
        wx.navigateBack()
        return
      }
      await switchToTab('/pages/meal-plans/index')
      return
    }

    if (pageCount > 1 && typeof wx.navigateBack === 'function') {
      wx.navigateBack()
      return
    }

    await switchToTab('/pages/recipes/index')
  },

  onShareAppMessage() {
    return {
      title: this.data.item && this.data.item.name ? this.data.item.name : '分享菜谱',
      path: `/pages/recipe-detail/index?recipeId=${this.data.recipeId}`
    }
  }
})
