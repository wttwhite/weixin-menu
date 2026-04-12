const { createMealPlanService } = require('../../services/meal-plan')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

function groupPlansByDate(items = []) {
  const grouped = []
  ;(items || []).forEach((item) => {
    const date = item.planDate || '未设置日期'
    const lastGroup = grouped[grouped.length - 1]
    if (!lastGroup || lastGroup.date !== date) {
      grouped.push({
        date,
        items: [item]
      })
      return
    }
    lastGroup.items.push(item)
  })
  return grouped
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    groups: [],
    summary: '正在读取计划...',
    errorMessage: '',
    emptyMessage: '这个空间还没有用餐计划，点击右下角开始添加。',
    showEmptyState: false,
    truncationMessage: ''
  },

  onShow() {
    this.loadMealPlans()
  },

  async onPullDownRefresh() {
    await this.loadMealPlans()
    wx.stopPullDownRefresh()
  },

  async loadMealPlans() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        groups: [],
        showEmptyState: false,
        summary: '请先选择一个空间，再创建用餐计划。',
        truncationMessage: ''
      })
      return
    }

    try {
      const result = await createMealPlanService().listMealPlans(activeSpaceId)
      const groups = groupPlansByDate(result.items || [])
      const total = typeof result.total === 'number' ? result.total : (result.items || []).length
      const hasMore = Boolean(result.hasMore)
      this.setData({
        loading: false,
        groups,
        showEmptyState: groups.length === 0,
        summary: groups.length ? `已安排 ${total} 条用餐计划。` : '暂无用餐计划。',
        emptyMessage: '这个空间还没有用餐计划，点击右下角开始添加。',
        truncationMessage: hasMore ? '当前仅显示部分计划，请继续缩小范围或等待分页支持。' : ''
      })
    } catch (error) {
      this.setData({
        loading: false,
        groups: [],
        showEmptyState: false,
        summary: '计划加载失败，请稍后重试。',
        errorMessage: getErrorMessage(error),
        truncationMessage: ''
      })
    }
  },

  goCreate() {
    if (!this.data.activeSpaceId) {
      wx.showToast({
        title: '请先选择空间',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: '/pages/meal-plan-edit/index'
    })
  },

  handleSelectMealPlan(event) {
    const mealPlanId = event.detail.mealPlanId
    if (!mealPlanId) {
      return
    }
    wx.navigateTo({
      url: `/pages/meal-plan-edit/index?mealPlanId=${mealPlanId}`
    })
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  }
})
