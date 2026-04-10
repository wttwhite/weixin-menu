const { getActiveSpaceId } = require('../../utils/app-session')

Page({
  data: {
    title: '统计页占位',
    description: '这里会放空间内的菜谱使用、采购节奏和库存消耗趋势。',
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
