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

const MANAGER_DRAG_SWAP_THRESHOLD = 56

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function getAppSafe() {
  return typeof getApp === 'function' ? getApp() : null
}

function buildThemeOptionsView(themeKey = 'default') {
  return getThemeOptions(themeKey)
}

function buildBackupStatusText(recentBackup = {}) {
  return recentBackup && recentBackup.status === 'available'
    ? recentBackup.updatedAt || '最近已备份'
    : '暂无备份'
}

function buildPantryManagerMetaText(type = 'category', items = []) {
  const config = getPantryManagerConfig(type)
  return `${(items || []).length} ${config.metaSuffix || '类'}`
}

function moveArrayItem(items = [], fromIndex = 0, toIndex = 0) {
  const nextItems = (items || []).slice()
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= nextItems.length ||
    toIndex >= nextItems.length ||
    fromIndex === toIndex
  ) {
    return nextItems
  }

  const [movedItem] = nextItems.splice(fromIndex, 1)
  nextItems.splice(toIndex, 0, movedItem)
  return nextItems
}

function getTouchPageY(event = {}) {
  if (
    event.detail &&
    Array.isArray(event.detail.touches) &&
    event.detail.touches.length &&
    typeof event.detail.touches[0].pageY === 'number'
  ) {
    return event.detail.touches[0].pageY
  }
  if (
    event.detail &&
    Array.isArray(event.detail.changedTouches) &&
    event.detail.changedTouches.length &&
    typeof event.detail.changedTouches[0].pageY === 'number'
  ) {
    return event.detail.changedTouches[0].pageY
  }
  if (Array.isArray(event.touches) && event.touches.length && typeof event.touches[0].pageY === 'number') {
    return event.touches[0].pageY
  }
  if (
    Array.isArray(event.changedTouches) &&
    event.changedTouches.length &&
    typeof event.changedTouches[0].pageY === 'number'
  ) {
    return event.changedTouches[0].pageY
  }
  return null
}

function resolveManagerName(event = {}) {
  if (event.detail && event.detail.name) {
    return event.detail.name
  }
  if (event.currentTarget && event.currentTarget.dataset) {
    return event.currentTarget.dataset.name || ''
  }
  return ''
}

function resolveManagerDeletable(event = {}) {
  if (event.detail && typeof event.detail.deletable !== 'undefined') {
    return event.detail.deletable === true || event.detail.deletable === 'true'
  }
  if (event.currentTarget && event.currentTarget.dataset) {
    const value = event.currentTarget.dataset.deletable || event.currentTarget.dataset.showDelete
    return value === true || value === 'true'
  }
  return false
}

function showOperationError(error) {
  if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
    wx.showToast({
      title: getErrorMessage(error),
      icon: 'none'
    })
  }
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
    showRecipeCategoryManager: false,
    recipeCategoryManagerInput: '',
    recipeCategoryManagerItems: [],
    recipeCategoryManagerLoading: false,
    showPantryManagerModal: false,
    pantryManagerType: 'category',
    pantryManagerTitle: '',
    pantryManagerMetaText: '0 类',
    pantryManagerInputPlaceholder: '',
    pantryManagerInput: '',
    pantryManagerItems: [],
    pantryManagerLoading: false,
    pantryManagerLoadingText: '正在读取分类...',
    pantryManagerEmptyIllustration: '类',
    pantryManagerEmptyIllustrationClass: '',
    pantryManagerEmptyTitle: '暂无分类',
    pantryManagerEmptyText: '还没有维护库存分类，先添加一个常用分类。',
    pantryManagerDraggingIndex: -1,
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

  async handleGenerateRecipeSamples() {
    if (!this.data.canRenameSpace || !this.data.activeSpaceId || typeof wx.showModal !== 'function') {
      return
    }

    const modal = await wx.showModal({
      title: '生成示例菜谱',
      content: '将为当前空间随机生成 30 个菜谱数据，确认继续？',
      confirmText: '开始生成',
      confirmColor: '#4d7f5b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      if (typeof wx.showLoading === 'function') {
        wx.showLoading({
          title: '正在生成'
        })
      }
      const result = await createRecipeService().generateSampleRecipes(this.data.activeSpaceId, 30)
      await this.loadProfile()
      wx.showToast({
        title: `已生成${result.count || 30}个菜谱`,
        icon: 'success'
      })
    } catch (error) {
      showOperationError(error)
    } finally {
      if (typeof wx.hideLoading === 'function') {
        wx.hideLoading()
      }
    }
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

  async openRecipeCategoryManager(forceReload = false) {
    if (!this.data.activeSpaceId) {
      return
    }

    this.setData({
      showPantryManagerModal: false,
      showRecipeCategoryManager: true
    })

    if (!forceReload && Array.isArray(this.data.recipeCategoryManagerItems) && this.data.recipeCategoryManagerItems.length) {
      return
    }

    this.setData({
      recipeCategoryManagerLoading: true
    })

    try {
      const result = await createRecipeService().listRecipeCategories(this.data.activeSpaceId)
      this.setData({
        recipeCategoryManagerLoading: false,
        recipeCategoryManagerItems: buildRecipeCategoryManagerItems(Array.isArray(result.items) ? result.items : [])
      })
    } catch (error) {
      this.setData({
        recipeCategoryManagerLoading: false,
        recipeCategoryManagerItems: []
      })
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  openPantryCategoryManager() {
    return this.openPantryManagerModal('category')
  },

  openPantryLocationManager() {
    return this.openPantryManagerModal('location')
  },

  async openPantryManagerModal(type = 'category') {
    if (!this.data.activeSpaceId) {
      return
    }

    const config = getPantryManagerConfig(type)
    this.pantryManagerDragState = null
    this.setData({
      showRecipeCategoryManager: false,
      showPantryManagerModal: true,
      pantryManagerType: type,
      pantryManagerTitle: config.title,
      pantryManagerMetaText: buildPantryManagerMetaText(type, []),
      pantryManagerInputPlaceholder: config.inputPlaceholder,
      pantryManagerInput: '',
      pantryManagerItems: [],
      pantryManagerLoading: true,
      pantryManagerLoadingText: config.loadingText,
      pantryManagerEmptyIllustration: config.emptyIllustration,
      pantryManagerEmptyIllustrationClass: config.emptyIllustrationClass || '',
      pantryManagerEmptyTitle: config.emptyTitle,
      pantryManagerEmptyText: config.emptyText,
      pantryManagerDraggingIndex: -1
    })

    try {
      const result = await createPantryService()[config.listMethod](this.data.activeSpaceId)
      const items = buildPantryManagerItems(Array.isArray(result.items) ? result.items : [], type)
      this.setData({
        pantryManagerLoading: false,
        pantryManagerItems: items,
        pantryManagerMetaText: buildPantryManagerMetaText(type, items)
      })
    } catch (error) {
      this.setData({
        pantryManagerLoading: false,
        pantryManagerItems: [],
        pantryManagerMetaText: buildPantryManagerMetaText(type, [])
      })
      showOperationError(error)
    }
  },

  closePantryManagerModal() {
    this.pantryManagerDragState = null
    this.setData({
      showPantryManagerModal: false,
      pantryManagerInput: '',
      pantryManagerItems: [],
      pantryManagerLoading: false,
      pantryManagerDraggingIndex: -1
    })
  },

  closeRecipeCategoryManager() {
    this.setData({
      showRecipeCategoryManager: false,
      recipeCategoryManagerInput: ''
    })
  },

  handleRecipeCategoryManagerInput(event) {
    this.setData({
      recipeCategoryManagerInput: event && event.detail ? event.detail.value : ''
    })
  },

  handlePantryManagerInput(event) {
    this.setData({
      pantryManagerInput: event && event.detail ? event.detail.value : ''
    })
  },

  async submitRecipeCategoryManagerCreate() {
    const name = normalizeText(this.data.recipeCategoryManagerInput)
    if (!name || !this.data.activeSpaceId) {
      return
    }

    try {
      const result = await createRecipeService().createRecipeCategory(this.data.activeSpaceId, name)
      const nextItems = (this.data.recipeCategoryManagerItems || []).concat(
        buildRecipeCategoryManagerItems([result.item || { name, recipeCount: 0, deletable: true }])
      )
      this.setData({
        recipeCategoryManagerInput: '',
        recipeCategoryManagerItems: nextItems
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async renameRecipeCategoryManagerItem(event) {
    const previousName = event && event.detail ? event.detail.name || '' : ''
    if (!previousName || typeof wx.showModal !== 'function') {
      return
    }

    const modal = await wx.showModal({
      title: '重命名分类',
      editable: true,
      placeholderText: '输入分类名称',
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
      const result = await createRecipeService().updateRecipeCategory(this.data.activeSpaceId, previousName, name)
      this.setData({
        recipeCategoryManagerItems: (this.data.recipeCategoryManagerItems || []).map((item) => {
          if (!item || item.name !== previousName) {
            return item
          }
          return {
            ...item,
            ...(result.item || { name })
          }
        })
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async deleteRecipeCategoryManagerItem(event) {
    const name = event && event.detail ? event.detail.name || '' : ''
    const deletable = Boolean(event && event.detail && event.detail.deletable)
    if (!name || !deletable || typeof wx.showModal !== 'function') {
      return
    }

    const modal = await wx.showModal({
      title: '删除分类',
      content: `确认删除分类“${name}”吗？`,
      confirmColor: '#d14b4b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      await createRecipeService().deleteRecipeCategory(this.data.activeSpaceId, name)
      this.setData({
        recipeCategoryManagerItems: (this.data.recipeCategoryManagerItems || []).filter((item) => item && item.name !== name)
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async submitPantryManagerCreate() {
    const type = this.data.pantryManagerType || 'category'
    const config = getPantryManagerConfig(type)
    const name = normalizeText(this.data.pantryManagerInput)
    if (!name || !this.data.activeSpaceId) {
      return
    }

    try {
      const result = await createPantryService()[config.createMethod](this.data.activeSpaceId, name)
      const nextItems = buildPantryManagerItems(
        (this.data.pantryManagerItems || []).concat(result.item || {
          name,
          pantryItemCount: 0,
          deletable: true
        }),
        type
      )
      this.setData({
        pantryManagerInput: '',
        pantryManagerItems: nextItems,
        pantryManagerMetaText: buildPantryManagerMetaText(type, nextItems)
      })
    } catch (error) {
      showOperationError(error)
    }
  },

  async renamePantryManagerItem(event) {
    const type = this.data.pantryManagerType || 'category'
    const previousName = resolveManagerName(event)
    if (!previousName || typeof wx.showModal !== 'function') {
      return
    }

    const config = getPantryManagerConfig(type)
    const modal = await wx.showModal({
      title: config.renameTitle,
      editable: true,
      placeholderText: config.renamePlaceholder,
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
      const result = await createPantryService()[config.updateMethod](this.data.activeSpaceId, previousName, name)
      const nextItems = buildPantryManagerItems(
        (this.data.pantryManagerItems || []).map((item) => {
          if (!item || item.name !== previousName) {
            return item
          }
          return {
            ...item,
            ...(result.item || { name })
          }
        }),
        type
      )
      this.setData({
        pantryManagerItems: nextItems,
        pantryManagerMetaText: buildPantryManagerMetaText(type, nextItems)
      })
    } catch (error) {
      showOperationError(error)
    }
  },

  async deletePantryManagerItem(event) {
    const type = this.data.pantryManagerType || 'category'
    const name = resolveManagerName(event)
    const deletable = resolveManagerDeletable(event)
    if (!name || !deletable || typeof wx.showModal !== 'function') {
      return
    }

    const config = getPantryManagerConfig(type)
    const modal = await wx.showModal({
      title: config.deleteTitle,
      content: `确认删除${config.deleteLabel}“${name}”吗？`,
      confirmColor: '#d14b4b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      await createPantryService()[config.deleteMethod](this.data.activeSpaceId, name)
      const nextItems = buildPantryManagerItems(
        (this.data.pantryManagerItems || []).filter((item) => item && item.name !== name),
        type
      )
      this.setData({
        pantryManagerItems: nextItems,
        pantryManagerMetaText: buildPantryManagerMetaText(type, nextItems)
      })
    } catch (error) {
      showOperationError(error)
    }
  },

  handlePantryManagerDragStart(event) {
    const index = Number(event && event.detail ? event.detail.index : -1)
    const touchPageY = getTouchPageY(event)
    const items = (this.data.pantryManagerItems || []).slice()

    if (!Number.isInteger(index) || index < 0 || index >= items.length || typeof touchPageY !== 'number') {
      return
    }

    this.pantryManagerDragState = {
      startIndex: index,
      currentIndex: index,
      startY: touchPageY,
      snapshotItems: items,
      dirty: false
    }
    this.setData({
      pantryManagerDraggingIndex: index
    })
  },

  handlePantryManagerDragMove(event) {
    if (!this.pantryManagerDragState) {
      return
    }

    const touchPageY = getTouchPageY(event)
    if (typeof touchPageY !== 'number') {
      return
    }

    const currentItems = (this.data.pantryManagerItems || []).slice()
    const deltaY = touchPageY - this.pantryManagerDragState.startY
    if (Math.abs(deltaY) < MANAGER_DRAG_SWAP_THRESHOLD) {
      return
    }

    const direction = deltaY > 0 ? 1 : -1
    const nextIndex = Math.max(0, Math.min(currentItems.length - 1, this.pantryManagerDragState.currentIndex + direction))
    if (nextIndex === this.pantryManagerDragState.currentIndex) {
      this.pantryManagerDragState.startY = touchPageY
      return
    }

    const nextItems = moveArrayItem(currentItems, this.pantryManagerDragState.currentIndex, nextIndex)
    this.pantryManagerDragState.currentIndex = nextIndex
    this.pantryManagerDragState.startY = touchPageY
    this.pantryManagerDragState.dirty = true
    this.setData({
      pantryManagerItems: nextItems,
      pantryManagerDraggingIndex: nextIndex
    })
  },

  async handlePantryManagerDragEnd() {
    if (!this.pantryManagerDragState) {
      return
    }

    const dragState = this.pantryManagerDragState
    this.pantryManagerDragState = null

    if (!dragState.dirty) {
      this.setData({
        pantryManagerDraggingIndex: -1
      })
      return
    }

    const type = this.data.pantryManagerType || 'category'
    const config = getPantryManagerConfig(type)
    const reorderedItems = (this.data.pantryManagerItems || []).slice()
    const names = reorderedItems.map((item) => item.name)

    try {
      const result = await createPantryService()[config.reorderMethod](this.data.activeSpaceId, names)
      const nextItems = buildPantryManagerItems(Array.isArray(result.items) ? result.items : reorderedItems, type)
      this.setData({
        pantryManagerItems: nextItems,
        pantryManagerMetaText: buildPantryManagerMetaText(type, nextItems),
        pantryManagerDraggingIndex: -1
      })
    } catch (error) {
      this.setData({
        pantryManagerItems: dragState.snapshotItems,
        pantryManagerMetaText: buildPantryManagerMetaText(type, dragState.snapshotItems),
        pantryManagerDraggingIndex: -1
      })
      showOperationError(error)
    }
  },

  handlePantryManagerDragCancel() {
    if (!this.pantryManagerDragState) {
      return
    }

    const dragState = this.pantryManagerDragState
    this.pantryManagerDragState = null
    this.setData({
      pantryManagerItems: dragState.snapshotItems,
      pantryManagerMetaText: buildPantryManagerMetaText(this.data.pantryManagerType || 'category', dragState.snapshotItems),
      pantryManagerDraggingIndex: -1
    })
  }
})
