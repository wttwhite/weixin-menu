const { bootstrap } = require('../../services/session')
const { getErrorMessage } = require('../../utils/error')

Page({
  data: {
    loading: true,
    title: '正在准备你的菜单空间',
    detail: '同步空间信息与本地会话...'
  },

  onLoad() {
    this.runBootstrap()
  },

  async runBootstrap() {
    this.setData({
      loading: true,
      detail: '同步空间信息与本地会话...'
    })

    try {
      const session = await bootstrap()
      const app = getApp()
      app.setActiveSpaceId(session.activeSpaceId)

      if (session.activeSpaceId) {
        wx.redirectTo({
          url: '/pages/recipes/index'
        })
        return
      }

      wx.redirectTo({
        url: '/pages/space/index'
      })
    } catch (error) {
      this.setData({
        loading: false,
        title: '进入应用失败',
        detail: getErrorMessage(error)
      })
    }
  }
})
