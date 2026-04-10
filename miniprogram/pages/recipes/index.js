const { getActiveSpaceId } = require('../../utils/app-session')

Page({
  data: {
    activeSpaceId: '',
    sections: [
      { title: '食谱库', detail: 'Task 4 will build recipe CRUD and filters.', path: '/pages/recipes/index' },
      { title: '库存', detail: 'Task 5 will add pantry items and expiry tracking.', path: '/pages/pantry/index' },
      { title: '计划', detail: 'Task 6 will connect meal plans to your space.', path: '/pages/meal-plans/index' },
      { title: '采购', detail: 'Task 7 will generate shopping lists from plans and pantry.', path: '/pages/shopping/index' },
      { title: '统计', detail: 'Task 8 will bring usage and budget metrics here.', path: '/pages/statistics/index' }
    ]
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
  },

  openSection(event) {
    const path = event.currentTarget.dataset.path
    if (!path || path === '/pages/recipes/index') {
      return
    }

    wx.navigateTo({
      url: path
    })
  }
})
