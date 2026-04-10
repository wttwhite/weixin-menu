const { createPantryService } = require('../../services/pantry')
const { getErrorMessage } = require('../../utils/error')

const STATUS_LABELS = {
  fresh: '新鲜',
  'expiring-soon': '临期',
  expired: '已过期'
}
const STATUS_FILTER_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '新鲜', value: 'fresh' },
  { label: '临期', value: 'expiring-soon' },
  { label: '已过期', value: 'expired' }
]

function getActiveSpaceId() {
  const app = getApp()
  return app.globalData.activeSpaceId || ''
}

function buildFilterOptions(items, field, allLabel) {
  const values = []
  ;(items || []).forEach((item) => {
    const value = item[field] || ''
    if (value && values.indexOf(value) === -1) {
      values.push(value)
    }
  })

  return [allLabel].concat(values)
}

function buildDisplayItems(items) {
  return (items || []).map((item) => ({
    ...item,
    statusLabel: STATUS_LABELS[item.status] || '正常'
  }))
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    items: [],
    visibleItems: [],
    errorMessage: '',
    summary: '正在读取库存...',
    emptyMessage: '这个空间还没有库存项，先添加常用食材吧。',
    categoryOptions: ['全部分类'],
    locationOptions: ['全部位置'],
    statusOptions: STATUS_FILTER_OPTIONS,
    selectedCategoryIndex: 0,
    selectedLocationIndex: 0,
    selectedStatusIndex: 0
  },

  onShow() {
    this.loadPantry()
  },

  async onPullDownRefresh() {
    await this.loadPantry()
    wx.stopPullDownRefresh()
  },

  async loadPantry() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        items: [],
        visibleItems: [],
        summary: '请先选择一个空间，再查看共享库存。'
      })
      return
    }

    try {
      const result = await createPantryService().listPantry(activeSpaceId, {})
      const items = buildDisplayItems(result.items || [])

      this.setData({
        loading: false,
        items,
        categoryOptions: buildFilterOptions(items, 'category', '全部分类'),
        locationOptions: buildFilterOptions(items, 'location', '全部位置'),
        selectedCategoryIndex: 0,
        selectedLocationIndex: 0,
        selectedStatusIndex: 0,
        summary: items.length
          ? '按分类、位置和状态快速筛选当前空间库存。'
          : '这个空间还没有库存项，先添加常用食材吧。'
      })
      this.applyFilters()
    } catch (error) {
      this.setData({
        loading: false,
        items: [],
        visibleItems: [],
        errorMessage: getErrorMessage(error),
        summary: '库存加载失败，请稍后重试。'
      })
    }
  },

  applyFilters() {
    const category = this.data.categoryOptions[this.data.selectedCategoryIndex]
    const location = this.data.locationOptions[this.data.selectedLocationIndex]
    const status = this.data.statusOptions[this.data.selectedStatusIndex]

    const visibleItems = this.data.items.filter((item) => {
      if (category && category !== '全部分类' && item.category !== category) {
        return false
      }
      if (location && location !== '全部位置' && item.location !== location) {
        return false
      }
      if (status && status.value && item.status !== status.value) {
        return false
      }
      return true
    })

    this.setData({
      visibleItems,
      emptyMessage: this.data.items.length
        ? '当前筛选条件下没有匹配的库存项。'
        : '这个空间还没有库存项，先添加常用食材吧。'
    })
  },

  handleCategoryChange(event) {
    this.setData({
      selectedCategoryIndex: Number(event.detail.value)
    })
    this.applyFilters()
  },

  handleLocationChange(event) {
    this.setData({
      selectedLocationIndex: Number(event.detail.value)
    })
    this.applyFilters()
  },

  handleStatusChange(event) {
    this.setData({
      selectedStatusIndex: Number(event.detail.value)
    })
    this.applyFilters()
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/pantry-edit/index'
    })
  },

  handleSelectItem(event) {
    const pantryItemId = event.detail.pantryItemId
    if (!pantryItemId) {
      return
    }

    wx.navigateTo({
      url: `/pages/pantry-edit/index?pantryItemId=${pantryItemId}`
    })
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  }
})
