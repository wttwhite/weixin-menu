function getActiveSpaceId() {
  const app = getApp()
  return app.globalData.activeSpaceId || ''
}

Page({
  data: {
    title: '库存页占位',
    description: '这里会接入空间级食材库存、保质期和库存变更记录。',
    activeSpaceId: ''
  },

  onShow() {
    this.setData({
      activeSpaceId: getActiveSpaceId()
    })
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  }
})
