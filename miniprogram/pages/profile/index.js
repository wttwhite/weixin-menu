const { createMembersService } = require('../../services/members')
const { createRecipeService } = require('../../services/recipe')
const { createPantryService } = require('../../services/pantry')
const { createStatisticsService } = require('../../services/statistics')
const { getActiveSpaceId, setActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncCurrentTabBar } = require('../../utils/tab-bar')
const { getThemeOptions, syncPageTheme } = require('../../utils/theme')
const { buildRoleLabel, decorateSpaceMembers } = require('../../utils/member-view')
const { buildRecipeCategoryManagerItems } = require('../../utils/recipe-category-manager')
const { buildPantryManagerItems, getPantryManagerConfig } = require('../../utils/pantry-manager')

const MANAGER_MODE_CONFIG = {
  'recipe-category': {
    title: '菜谱分类',
    inputPlaceholder: '输入分类名称',
    listMethod: 'listRecipeCategories',
    createMethod: 'createRecipeCategory',
    updateMethod: 'updateRecipeCategory',
    deleteMethod: 'deleteRecipeCategory'
  },
  'pantry-category': getPantryManagerConfig('category'),
  'pantry-location': getPantryManagerConfig('location')
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getAppSafe() {
  return typeof getApp === 'function' ? getApp() : null
}

function buildThemeOptionsView(themeKey = 'default') {
  return getThemeOptions(themeKey)
}

function resolveManagerConfig(mode = 'recipe-category') {
  return MANAGER_MODE_CONFIG[mode] || MANAGER_MODE_CONFIG['recipe-category']
}

function buildBackupStatusText(recentBackup = {}) {
  return recentBackup && recentBackup.status === 'available'
    ? recentBackup.updatedAt || '最近已备份'
    : '暂无备份'
}

function buildManagerItems(mode = 'recipe-category', items = []) {
  if (mode === 'recipe-category') {
    return buildRecipeCategoryManagerItems(items)
  }
  if (mode === 'pantry-category') {
    return buildPantryManagerItems(items, 'category')
  }
  return buildPantryManagerItems(items, 'location')
}

Page({
  data: {
    loading: true,
    errorMessage: '',
    themeKey: 'default',
    themeStyle: '',
    activeSpaceId: '',
    activeSpaceName: '',
    currentOpenid: '',
    currentDisplayName: '',
    role: '',
    roleLabel: '',
    inviteCode: '',
    recipeCountText: '0',
    memberCountText: '0',
    backupStatusText: '暂无备份',
    spacesCountText: '0 个空间',
    canRenameSpace: false,
    showEmptyState: false,
    showManagerModal: false,
    managerMode: '',
    managerTitle: '',
    managerInputPlaceholder: '',
    managerInput: '',
    managerItems: [],
    managerLoading: false,
    showThemeModal: false,
    themeOptions: buildThemeOptionsView('default')
  },

  onShow() {
    syncCurrentTabBar(this, '/pages/profile/index')
    this.applyTheme()
    return this.loadProfile()
  },

  async onPullDownRefresh() {
    await this.loadProfile()
    wx.stopPullDownRefresh()
  },

  applyTheme() {
    const nextTheme = syncPageTheme(this)
    this.setData({
      themeOptions: buildThemeOptionsView(nextTheme.themeKey)
    })
    const tabBar = this.getTabBar && this.getTabBar()
    if (tabBar && typeof tabBar.refreshTheme === 'function') {
      tabBar.refreshTheme()
    }
  },

  async loadProfile() {
    const requestedSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: ''
    })

    try {
      const session = await createMembersService().bootstrapSession(requestedSpaceId)
      const activeSpaceId = session.activeSpaceId || ''
      setActiveSpaceId(activeSpaceId)

      if (!activeSpaceId) {
        this.setData({
          loading: false,
          activeSpaceId: '',
          activeSpaceName: '',
          currentOpenid: session.openid || '',
          currentDisplayName: '',
          role: session.role || '',
          roleLabel: buildRoleLabel(session.role || ''),
          inviteCode: '',
          recipeCountText: '0',
          memberCountText: '0',
          backupStatusText: '暂无备份',
          spacesCountText: `${(session.spaces || []).length} 个空间`,
          canRenameSpace: false,
          showEmptyState: true
        })
        return
      }

      const [membersResult, dashboard] = await Promise.all([
        createMembersService().listMembers(activeSpaceId),
        createStatisticsService().getStatisticsDashboard(activeSpaceId)
      ])

      const members = decorateSpaceMembers(membersResult.members || [], session.openid || '')
      const currentMember = members.find((item) => item.isCurrentUser) || {}
      const activeSpace = (session.spaces || []).find((item) => (item.spaceId || item.id) === activeSpaceId) || {}

      this.setData({
        loading: false,
        activeSpaceId,
        activeSpaceName: activeSpace.name || '未命名空间',
        currentOpenid: session.openid || '',
        currentDisplayName: currentMember.name || '匿名成员',
        role: session.role || '',
        roleLabel: buildRoleLabel(session.role || ''),
        inviteCode: activeSpace.inviteCode || '',
        recipeCountText: String(dashboard.recipeCount || 0),
        memberCountText: String(dashboard.memberCount || members.length),
        backupStatusText: buildBackupStatusText(dashboard.recentBackup || {}),
        spacesCountText: `${(session.spaces || []).length} 个空间`,
        canRenameSpace: session.role === 'owner',
        showEmptyState: false
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getErrorMessage(error),
        showEmptyState: false
      })
    }
  },

  async handleEditDisplayName() {
    if (!this.data.activeSpaceId || !this.data.currentOpenid || typeof wx.showModal !== 'function') {
      return
    }

    const modal = await wx.showModal({
      title: '编辑昵称',
      editable: true,
      placeholderText: '输入当前空间昵称',
      content: this.data.currentDisplayName,
      confirmText: '保存'
    })
    if (!modal.confirm) {
      return
    }

    const displayName = normalizeText(modal.content)
    if (!displayName) {
      return
    }

    try {
      await createMembersService().updateMemberDisplayName(this.data.activeSpaceId, this.data.currentOpenid, displayName)
      this.setData({
        currentDisplayName: displayName
      })
      wx.showToast({
        title: '昵称已更新',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async handleRenameSpace() {
    if (!this.data.canRenameSpace || !this.data.activeSpaceId || typeof wx.showModal !== 'function') {
      return
    }

    const modal = await wx.showModal({
      title: '修改空间名',
      editable: true,
      placeholderText: '输入新的空间名',
      content: this.data.activeSpaceName,
      confirmText: '保存'
    })
    if (!modal.confirm) {
      return
    }

    const name = normalizeText(modal.content)
    if (!name) {
      return
    }

    try {
      await createMembersService().renameSpace(this.data.activeSpaceId, name)
      this.setData({
        activeSpaceName: name
      })
      wx.showToast({
        title: '空间名已更新',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async handleCopyInviteCode() {
    if (!this.data.inviteCode || typeof wx.setClipboardData !== 'function') {
      return
    }
    await wx.setClipboardData({
      data: this.data.inviteCode
    })
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  },

  openCreateSpace() {
    wx.navigateTo({
      url: '/pages/space-create/index'
    })
  },

  openJoinSpace() {
    wx.navigateTo({
      url: '/pages/space-join/index'
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
  },

  openStatistics() {
    wx.navigateTo({
      url: '/pages/statistics/index'
    })
  },

  openThemeModal() {
    this.applyTheme()
    this.setData({
      showThemeModal: true
    })
  },

  closeThemeModal() {
    this.setData({
      showThemeModal: false
    })
  },

  selectTheme(event) {
    const themeKey = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.key || 'default'
      : 'default'
    const app = getAppSafe()
    if (app && typeof app.setTheme === 'function') {
      app.setTheme(themeKey)
    }
    this.applyTheme()
  },

  noop() {},

  async openManagerModal(mode = 'recipe-category') {
    if (!this.data.activeSpaceId) {
      return
    }
    const config = resolveManagerConfig(mode)
    this.setData({
      showManagerModal: true,
      managerMode: mode,
      managerTitle: config.title,
      managerInputPlaceholder: config.inputPlaceholder,
      managerInput: '',
      managerLoading: true
    })

    try {
      const service = mode === 'recipe-category' ? createRecipeService() : createPantryService()
      const result = await service[config.listMethod](this.data.activeSpaceId)
      const items = Array.isArray(result.items) ? result.items : []
      this.setData({
        managerLoading: false,
        managerItems: buildManagerItems(mode, items)
      })
    } catch (error) {
      this.setData({
        managerLoading: false,
        managerItems: []
      })
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  openRecipeCategoryManager() {
    return this.openManagerModal('recipe-category')
  },

  openPantryCategoryManager() {
    return this.openManagerModal('pantry-category')
  },

  openPantryLocationManager() {
    return this.openManagerModal('pantry-location')
  },

  closeManagerModal() {
    this.setData({
      showManagerModal: false,
      managerMode: '',
      managerInput: '',
      managerItems: []
    })
  },

  handleManagerInput(event) {
    this.setData({
      managerInput: event && event.detail ? event.detail.value : ''
    })
  },

  async reloadManagerItems() {
    if (!this.data.managerMode) {
      return
    }
    return this.openManagerModal(this.data.managerMode)
  },

  async submitManagerCreate() {
    const config = resolveManagerConfig(this.data.managerMode)
    const name = normalizeText(this.data.managerInput)
    if (!name || !this.data.activeSpaceId) {
      return
    }

    try {
      const service = this.data.managerMode === 'recipe-category' ? createRecipeService() : createPantryService()
      await service[config.createMethod](this.data.activeSpaceId, name)
      this.setData({
        managerInput: ''
      })
      await this.reloadManagerItems()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async renameManagerItem(event) {
    const previousName = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.name || ''
      : ''
    if (!previousName || typeof wx.showModal !== 'function') {
      return
    }

    const config = resolveManagerConfig(this.data.managerMode)
    const modal = await wx.showModal({
      title: `重命名${config.title}`,
      editable: true,
      placeholderText: config.inputPlaceholder,
      content: previousName,
      confirmText: '保存'
    })
    if (!modal.confirm) {
      return
    }
    const name = normalizeText(modal.content)
    if (!name) {
      return
    }

    try {
      const service = this.data.managerMode === 'recipe-category' ? createRecipeService() : createPantryService()
      await service[config.updateMethod](this.data.activeSpaceId, previousName, name)
      await this.reloadManagerItems()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async deleteManagerItem(event) {
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const name = dataset.name || ''
    const showDelete = dataset.showDelete === true || dataset.showDelete === 'true'
    if (!name || !showDelete || typeof wx.showModal !== 'function') {
      return
    }

    const config = resolveManagerConfig(this.data.managerMode)
    const modal = await wx.showModal({
      title: `删除${config.title}`,
      content: `确认删除“${name}”吗？`,
      confirmColor: '#d14b4b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      const service = this.data.managerMode === 'recipe-category' ? createRecipeService() : createPantryService()
      await service[config.deleteMethod](this.data.activeSpaceId, name)
      await this.reloadManagerItems()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  }
})
