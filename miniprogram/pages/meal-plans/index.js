const { getActiveSpaceId } = require('../../utils/app-session')

Page({
  data: {
    title: '计划页占位',
    description: '这里会承接周计划、用餐安排和计划生成入口。',
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
