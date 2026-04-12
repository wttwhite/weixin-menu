const { createStatisticsService } = require('../../services/statistics')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    errorMessage: '',
    dashboard: {
      recipeCount: 0,
      pantryCount: 0,
      upcomingExpirations: 0,
      shoppingProgress: {
        total: 0,
        checked: 0,
        percent: 0
      },
      memberCount: 0,
      recentBackup: {
        status: 'not-available',
        updatedAt: ''
      }
    }
  },

  onShow() {
    this.loadDashboard()
  },

  async onPullDownRefresh() {
    await this.loadDashboard()
    wx.stopPullDownRefresh()
  },

  async loadDashboard() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false
      })
      return
    }

    try {
      const dashboard = await createStatisticsService().getStatisticsDashboard(activeSpaceId)
      this.setData({
        loading: false,
        dashboard
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getErrorMessage(error)
      })
    }
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  },

  openMembers() {
    wx.navigateTo({
      url: '/pages/space-members/index'
    })
  },

  openBackup() {
    wx.navigateTo({
      url: '/pages/backup/index'
    })
  }
})
