const { bootstrap } = require('../../services/session')
const { createMembersService } = require('../../services/members')
const { getErrorMessage, isMissingCollectionError } = require('../../utils/error')
const { setActiveSpaceId } = require('../../utils/app-session')
const { switchToTab } = require('../../utils/tab-bar')

const membersService = createMembersService()

Page({
  data: {
    loading: true,
    title: '正在准备你的菜单空间',
    detail: '同步空间信息与本地会话...',
    canInitCollections: false,
    initCollectionsLoading: false
  },

  onLoad() {
    this.runBootstrap()
  },

  async runBootstrap() {
    this.setData({
      loading: true,
      title: '正在准备你的菜单空间',
      detail: '同步空间信息与本地会话...',
      canInitCollections: false,
      initCollectionsLoading: false
    })

    try {
      const session = await bootstrap()
      setActiveSpaceId(session.activeSpaceId)

      if (session.activeSpaceId) {
        await switchToTab('/pages/recipes/index')
        return
      }

      wx.redirectTo({
        url: '/pages/space/index'
      })
    } catch (error) {
      this.setData({
        loading: false,
        title: '进入应用失败',
        detail: getErrorMessage(error),
        canInitCollections: isMissingCollectionError(error),
        initCollectionsLoading: false
      })
    }
  },

  async handleInitCollections() {
    if (this.data.initCollectionsLoading) {
      return
    }

    this.setData({
      loading: true,
      title: '正在初始化云数据库',
      detail: '创建业务集合并准备重新连接...',
      canInitCollections: false,
      initCollectionsLoading: true
    })

    try {
      await membersService.initCollections()
      if (typeof wx.showToast === 'function') {
        wx.showToast({
          title: '云数据库初始化完成',
          icon: 'success'
        })
      }
      await this.runBootstrap()
    } catch (error) {
      this.setData({
        loading: false,
        title: '初始化失败',
        detail: getErrorMessage(error, '云数据库初始化失败，请稍后重试'),
        canInitCollections: isMissingCollectionError(error),
        initCollectionsLoading: false
      })
    }
  }
})
