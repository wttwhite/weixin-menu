const { createSessionService } = require('../../services/session')
const { getErrorMessage } = require('../../utils/error')

function buildSpaceCards(spaces, activeSpaceId) {
  return (spaces || []).map((space) => ({
    id: space.id,
    name: space.name || '未命名空间',
    roleLabel: space.role === 'owner' ? '创建者' : '成员',
    isActive: space.id === activeSpaceId
  }))
}

Page({
  data: {
    loading: true,
    spaces: [],
    activeSpaceId: '',
    summary: '正在读取空间信息...',
    errorMessage: ''
  },

  onShow() {
    this.loadSession()
  },

  async loadSession() {
    this.setData({
      loading: true,
      errorMessage: ''
    })

    try {
      const session = await createSessionService().bootstrap()
      const app = getApp()
      app.setSession(session)

      this.setData({
        loading: false,
        spaces: buildSpaceCards(session.spaces, session.activeSpaceId),
        activeSpaceId: session.activeSpaceId,
        summary: session.spaces.length
          ? '选择当前正在使用的空间，或继续添加新的家庭/团队空间。'
          : '你还没有加入任何空间。先创建一个空间，或使用邀请码加入已有空间。'
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getErrorMessage(error),
        summary: '暂时无法加载空间信息。'
      })
    }
  },

  async handleSwitchSpace(event) {
    const nextSpaceId = event.currentTarget.dataset.spaceId
    if (!nextSpaceId || nextSpaceId === this.data.activeSpaceId) {
      return
    }

    try {
      const result = await createSessionService().switchSpace(nextSpaceId)
      const app = getApp()
      app.setActiveSpaceId(result.activeSpaceId)
      wx.redirectTo({
        url: '/pages/recipes/index'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/space-create/index'
    })
  },

  goJoin() {
    wx.navigateTo({
      url: '/pages/space-join/index'
    })
  }
})
