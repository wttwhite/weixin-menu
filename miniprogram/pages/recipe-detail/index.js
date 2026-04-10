const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    recipeId: '',
    item: null,
    errorMessage: ''
  },

  onLoad(options) {
    const recipeId = options && options.recipeId ? options.recipeId : ''
    this.setData({
      recipeId
    })
  },

  onShow() {
    this.loadDetail()
  },

  async loadDetail() {
    const activeSpaceId = getActiveSpaceId()
    const recipeId = this.data.recipeId
    this.setData({
      loading: true,
      activeSpaceId,
      errorMessage: ''
    })

    if (!activeSpaceId || !recipeId) {
      this.setData({
        loading: false,
        item: null,
        errorMessage: '缺少空间或菜谱信息。'
      })
      return
    }

    try {
      const result = await createRecipeService().getRecipeDetail(activeSpaceId, recipeId)
      this.setData({
        loading: false,
        item: result.item || null
      })
    } catch (error) {
      this.setData({
        loading: false,
        item: null,
        errorMessage: getErrorMessage(error)
      })
    }
  },

  goEdit() {
    wx.navigateTo({
      url: `/pages/recipe-edit/index?recipeId=${this.data.recipeId}`
    })
  },

  goBack() {
    wx.navigateBack()
  }
})
