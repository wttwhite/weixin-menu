const { getActiveSpaceId } = require('../../utils/app-session')

Page({
  data: {
    title: '采购页占位',
    description: '这里会展示购物清单、已购状态以及与库存和计划的联动。',
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
