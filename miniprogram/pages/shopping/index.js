const { createShoppingService } = require('../../services/shopping')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncCurrentTabBar } = require('../../utils/tab-bar')

function buildListOptions(lists = []) {
  return (lists || []).map((item) => ({
    value: item._id,
    label: item.title || '未命名清单'
  }))
}

function getListIndexById(lists = [], shoppingListId = '') {
  const index = (lists || []).findIndex((item) => item._id === shoppingListId)
  return index >= 0 ? index : 0
}

function decorateItems(items = []) {
  return (items || []).map((item) => ({
    ...item,
    quantityLabel: item.quantity && item.unit ? `${item.quantity} ${item.unit}` : item.quantity || item.unit || '',
    sourceLabel: item.sourceType === 'generated' ? '计划生成' : '手动添加'
  }))
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    shoppingLists: [],
    shoppingListOptions: [],
    selectedShoppingListId: '',
    selectedShoppingListIndex: 0,
    selectedShoppingList: null,
    items: [],
    summary: '正在读取采购清单...',
    errorMessage: '',
    emptyMessage: '当前还没有采购项，先手动添加或从用餐计划生成。',
    generating: false
  },

  onShow() {
    syncCurrentTabBar(this, '/pages/shopping/index')
    this.loadShoppingLists()
  },

  async onPullDownRefresh() {
    await this.loadShoppingLists()
    wx.stopPullDownRefresh()
  },

  async loadShoppingLists() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        shoppingLists: [],
        shoppingListOptions: [],
        selectedShoppingListId: '',
        selectedShoppingList: null,
        items: [],
        summary: '请先选择空间，再管理采购清单。'
      })
      return
    }

    try {
      const result = await createShoppingService().listShoppingLists(activeSpaceId)
      const shoppingLists = result.items || []
      const selectedShoppingListId =
        shoppingLists.find((item) => item._id === this.data.selectedShoppingListId)?._id ||
        (shoppingLists[0] && shoppingLists[0]._id) ||
        ''
      const selectedShoppingList = shoppingLists.find((item) => item._id === selectedShoppingListId) || null
      const shoppingListOptions = buildListOptions(shoppingLists)

      this.setData({
        loading: false,
        shoppingLists,
        shoppingListOptions,
        selectedShoppingListId,
        selectedShoppingListIndex: getListIndexById(shoppingLists, selectedShoppingListId),
        selectedShoppingList,
        items: decorateItems(selectedShoppingList ? selectedShoppingList.items || [] : []),
        summary: shoppingLists.length
          ? '勾选已购，或继续添加采购项。'
          : '你还没有采购清单，先创建一个。'
      })
    } catch (error) {
      this.setData({
        loading: false,
        shoppingLists: [],
        shoppingListOptions: [],
        selectedShoppingListId: '',
        selectedShoppingList: null,
        items: [],
        summary: '采购清单加载失败。',
        errorMessage: getErrorMessage(error)
      })
    }
  },

  async handleShoppingListChange(event) {
    const nextIndex = Number(event.detail.value)
    const selectedShoppingList = this.data.shoppingLists[nextIndex] || null
    this.setData({
      selectedShoppingListIndex: nextIndex,
      selectedShoppingListId: selectedShoppingList ? selectedShoppingList._id : '',
      selectedShoppingList,
      items: decorateItems(selectedShoppingList ? selectedShoppingList.items || [] : [])
    })
  },

  async createList() {
    if (!this.data.activeSpaceId) {
      wx.showToast({
        title: '请先选择空间',
        icon: 'none'
      })
      return
    }

    const modal = await wx.showModal({
      title: '创建采购清单',
      editable: true,
      placeholderText: '例如：周末采购',
      confirmText: '创建'
    })
    if (!modal.confirm) {
      return
    }

    const title = (modal.content || '').trim() || `采购清单 ${new Date().getMonth() + 1}/${new Date().getDate()}`
    try {
      await createShoppingService().createShoppingList(this.data.activeSpaceId, { title })
      await this.loadShoppingLists()
      wx.showToast({
        title: '已创建',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async handleToggleItem(event) {
    const shoppingItemId = event.currentTarget.dataset.shoppingItemId
    const checked = Boolean(event.detail.value.length)
    if (!this.data.activeSpaceId || !this.data.selectedShoppingListId || !shoppingItemId) {
      return
    }

    try {
      await createShoppingService().toggleShoppingItemChecked(
        this.data.activeSpaceId,
        this.data.selectedShoppingListId,
        shoppingItemId,
        checked,
        (this.data.selectedShoppingList.items || []).find((item) => item._id === shoppingItemId)?.updatedAt || '',
        this.data.selectedShoppingList.updatedAt || ''
      )
      await this.loadShoppingLists()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  goAddManualItem() {
    if (!this.data.selectedShoppingListId) {
      wx.showToast({
        title: '请先选择采购清单',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: `/pages/shopping-edit/index?shoppingListId=${this.data.selectedShoppingListId}&shoppingListUpdatedAt=${encodeURIComponent(this.data.selectedShoppingList.updatedAt || '')}`
    })
  },

  goEditItem(event) {
    const shoppingItemId = event.currentTarget.dataset.shoppingItemId
    if (!shoppingItemId || !this.data.selectedShoppingList) {
      return
    }
    const target = (this.data.selectedShoppingList.items || []).find((item) => item._id === shoppingItemId)
    if (!target) {
      return
    }
    wx.navigateTo({
      url: `/pages/shopping-edit/index?shoppingListId=${this.data.selectedShoppingListId}&shoppingListUpdatedAt=${encodeURIComponent(this.data.selectedShoppingList.updatedAt || '')}&shoppingItemId=${shoppingItemId}&updatedAt=${encodeURIComponent(target.updatedAt || '')}&name=${encodeURIComponent(target.name || '')}&quantity=${encodeURIComponent(target.quantity || '')}&unit=${encodeURIComponent(target.unit || '')}&notes=${encodeURIComponent(target.notes || '')}`
    })
  },

  async generateFromMealPlans() {
    if (!this.data.activeSpaceId || !this.data.selectedShoppingListId || this.data.generating) {
      return
    }
    this.setData({
      generating: true
    })
    try {
      await createShoppingService().generateShoppingItemsFromPlan(
        this.data.activeSpaceId,
        this.data.selectedShoppingListId,
        this.data.selectedShoppingList.updatedAt || ''
      )
      await this.loadShoppingLists()
      wx.showToast({
        title: '已生成采购项',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        generating: false
      })
    }
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  }
})
