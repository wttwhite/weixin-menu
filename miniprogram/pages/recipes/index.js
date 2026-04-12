const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

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
    activeSpaceId: '',
    items: [],
    showEmptyState: false,
    errorMessage: '',
    truncationMessage: '',
    summary: '正在读取菜谱...'
  },

  onShow() {
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
      activeSpaceId,
      errorMessage: ''
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        items: [],
        showEmptyState: false,
        truncationMessage: '',
        summary: '请先选择一个空间，再开始管理共享菜谱。'
      })
      return
    }

    try {
      const result = await createRecipeService().listRecipes(activeSpaceId)
      const items = (result.items || []).map((item) => ({
        ...item,
        tagSummary: buildTagSummary(item.tags || []),
        categorySummary: buildCategorySummary(item),
        metricSummary: buildMetricSummary(item)
      }))
      const total = typeof result.total === 'number' ? result.total : items.length
      const limit =
        typeof result.limit === 'number' && result.limit > 0 ? result.limit : items.length
      const hasMore = Boolean(result.hasMore) || (limit > 0 && total > limit)
      this.setData({
        loading: false,
        items,
        showEmptyState: !items.length,
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
        showEmptyState: false,
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
    wx.navigateTo({
      url: '/pages/pantry/index'
    })
  }
})
