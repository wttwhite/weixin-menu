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

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    items: [],
    errorMessage: '',
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
        summary: '请先选择一个空间，再开始管理共享菜谱。'
      })
      return
    }

    try {
      const result = await createRecipeService().listRecipes(activeSpaceId)
      const items = (result.items || []).map((item) => ({
        ...item,
        tagSummary: buildTagSummary(item.tags || []),
        categorySummary: buildCategorySummary(item)
      }))
      this.setData({
        loading: false,
        items,
        summary: items.length
          ? `当前空间共 ${items.length} 道菜谱，可按分类和标签快速浏览。`
          : '这个空间还没有菜谱，先创建第一道拿手菜吧。'
      })
    } catch (error) {
      this.setData({
        loading: false,
        items: [],
        errorMessage: getErrorMessage(error),
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
