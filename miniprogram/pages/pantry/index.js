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

function buildServerFilters(data) {
  const category = data.categoryOptions[data.selectedCategoryIndex]
  const location = data.locationOptions[data.selectedLocationIndex]
  const filters = {}
  if (category && category !== '全部分类') {
    filters.category = category
  }
  if (location && location !== '全部位置') {
    filters.location = location
  }
  return filters
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    items: [],
    visibleItems: [],
    showEmptyState: false,
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
    this.loadPantry({ refreshOptions: true, filters: {} })
  },

  async onPullDownRefresh() {
    await this.loadPantry({ refreshOptions: true, filters: {} })
    wx.stopPullDownRefresh()
  },

  async loadPantry(options = {}) {
    const refreshOptions = Boolean(options.refreshOptions)
    const filters = options.filters || {}
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
        showEmptyState: false,
        summary: '请先选择一个空间，再查看共享库存。'
      })
      return
    }

    try {
      const result = await createPantryService().listPantry(activeSpaceId, filters)
      const items = buildDisplayItems(result.items || [])
      const nextData = {
        loading: false,
        items,
        summary: items.length
          ? '按分类、位置和状态快速筛选当前空间库存。'
          : '这个空间还没有库存项，先添加常用食材吧。'
      }

      if (refreshOptions) {
        nextData.categoryOptions = buildFilterOptions(items, 'category', '全部分类')
        nextData.locationOptions = buildFilterOptions(items, 'location', '全部位置')
        nextData.selectedCategoryIndex = 0
        nextData.selectedLocationIndex = 0
        nextData.selectedStatusIndex = 0
      }

      this.setData(nextData)
      this.applyFilters()
    } catch (error) {
      this.setData({
        loading: false,
        items: [],
        visibleItems: [],
        showEmptyState: false,
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
      showEmptyState: !this.data.errorMessage && visibleItems.length === 0,
      emptyMessage: this.data.items.length
        ? '当前筛选条件下没有匹配的库存项。'
        : '这个空间还没有库存项，先添加常用食材吧。'
    })
  },

  async handleCategoryChange(event) {
    this.setData({
      selectedCategoryIndex: Number(event.detail.value)
    })
    await this.loadPantry({
      filters: buildServerFilters(this.data),
      refreshOptions: false
    })
  },

  async handleLocationChange(event) {
    this.setData({
      selectedLocationIndex: Number(event.detail.value)
    })
    await this.loadPantry({
      filters: buildServerFilters(this.data),
      refreshOptions: false
    })
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
