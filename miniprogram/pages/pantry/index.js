const { createPantryService } = require('../../services/pantry')
const { ERROR_CODES } = require('../../shared/constants/error-codes')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncCurrentTabBar } = require('../../utils/tab-bar')

const DEFAULT_MANAGEMENT_CATEGORY_COUNT_TEXT = '暂无分类'
const UNCATEGORIZED_KEY = '__uncategorized__'
const STORED_STATUS_SEQUENCE = ['active', 'opened', 'empty', 'discarded']
const MANAGER_DRAG_SWAP_THRESHOLD = 56

const FRESHNESS_META = {
  expiring: {
    label: '临期',
    className: 'freshness-badge freshness-badge--expiring-soon'
  },
  expired: {
    label: '过期',
    className: 'freshness-badge freshness-badge--expired'
  }
}

const STORED_STATUS_META = {
  active: {
    label: '正常',
    className: 'usage-badge usage-badge--normal',
    actionLabel: '开封',
    actionIcon: '◔'
  },
  opened: {
    label: '已开封',
    className: 'usage-badge usage-badge--opened',
    actionLabel: '用完',
    actionIcon: '✓'
  },
  empty: {
    label: '已用完',
    className: 'usage-badge usage-badge--used-up',
    actionLabel: '废弃',
    actionIcon: '🗑'
  },
  discarded: {
    label: '已丢弃',
    className: 'usage-badge usage-badge--discarded',
    actionLabel: '恢复',
    actionIcon: '↺'
  }
}

const STATUS_ACTION_ITEMS = [
  { value: 'active', label: '标记为正常' },
  { value: 'opened', label: '标记为已开封' },
  { value: 'empty', label: '标记为已用完' },
  { value: 'discarded', label: '标记为已丢弃' }
]

const MANAGER_CONFIG = {
  category: {
    title: '分类管理',
    inputPlaceholder: '输入分类名称',
    loadingText: '正在读取分类...',
    renameTitle: '重命名分类',
    renamePlaceholder: '输入新的分类名称',
    deleteTitle: '删除分类',
    deleteLabel: '分类',
    listMethod: 'listPantryCategories',
    createMethod: 'createPantryCategory',
    updateMethod: 'updatePantryCategory',
    deleteMethod: 'deletePantryCategory',
    reorderMethod: 'reorderPantryCategories'
  },
  location: {
    title: '位置管理',
    inputPlaceholder: '输入位置名称',
    loadingText: '正在读取位置...',
    renameTitle: '重命名位置',
    renamePlaceholder: '输入新的位置名称',
    deleteTitle: '删除位置',
    deleteLabel: '位置',
    listMethod: 'listPantryLocations',
    createMethod: 'createPantryLocation',
    updateMethod: 'updatePantryLocation',
    deleteMethod: 'deletePantryLocation',
    reorderMethod: 'reorderPantryLocations'
  }
}

function createDateLabel(now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  return `${year}/${month}/${day}`
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStoredStatus(value) {
  const text = normalizeText(value)
  return STORED_STATUS_SEQUENCE.includes(text) ? text : 'active'
}

function getCategoryKey(category) {
  const text = normalizeText(category)
  return text || UNCATEGORIZED_KEY
}

function getCategoryLabel(category) {
  const text = normalizeText(category)
  return text || '未分类'
}

function buildCategorySourceValues(items = []) {
  const values = []
  ;(items || []).forEach((item) => {
    const value = normalizeText(item.category)
    if (value && !values.includes(value)) {
      values.push(value)
    }
  })
  return values
}

function buildCategoryOptions(items = [], sourceValues = []) {
  const countsByKey = {}
  ;(items || []).forEach((item) => {
    const key = getCategoryKey(item.category)
    countsByKey[key] = (countsByKey[key] || 0) + 1
  })

  const options = [
    {
      key: 'all',
      label: '全部',
      count: (items || []).length
    }
  ]
  const seen = new Set(['all'])

  ;(sourceValues || []).forEach((value) => {
    const key = getCategoryKey(value)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    options.push({
      key,
      label: getCategoryLabel(value),
      count: countsByKey[key] || 0
    })
  })

  if (!seen.has(UNCATEGORIZED_KEY) && countsByKey[UNCATEGORIZED_KEY]) {
    options.push({
      key: UNCATEGORIZED_KEY,
      label: '未分类',
      count: countsByKey[UNCATEGORIZED_KEY]
    })
  }

  return options
}

function buildCategoryViewItems(options = [], activeCategoryKey = 'all') {
  return (options || []).map((item) => ({
    ...item,
    countText: String(item.count || 0),
    itemClass: item.key === activeCategoryKey ? 'rail-item rail-item--active' : 'rail-item'
  }))
}

function getCategoryOptionLabel(options = [], key = 'all') {
  const matched = (options || []).find((item) => item.key === key)
  return matched ? matched.label : '全部'
}

function buildThumbText(item = {}) {
  const name = normalizeText(item.name)
  const category = normalizeText(item.category)
  return (name || category || '食').slice(0, 1)
}

function buildQuantityDisplay(item = {}) {
  const quantity = normalizeText(item.quantity) || '1'
  const unit = normalizeText(item.unit)
  return unit ? `${quantity} ${unit}` : quantity
}

function buildDisplayItem(item = {}) {
  const actualStatus = normalizeText(item.status) || 'active'
  const storedStatus = normalizeStoredStatus(item.storedStatus || item.status)
  const storedMeta = STORED_STATUS_META[storedStatus] || STORED_STATUS_META.active
  const freshnessMeta = FRESHNESS_META[actualStatus] || null
  const location = normalizeText(item.location)
  const notes = normalizeText(item.notes)
  const expirationDate = normalizeText(item.expirationDate)

  return {
    ...item,
    storedStatus,
    categoryKey: getCategoryKey(item.category),
    categoryLabel: getCategoryLabel(item.category),
    quantityDisplay: buildQuantityDisplay(item),
    statusLabel: freshnessMeta ? freshnessMeta.label : '',
    statusClass: freshnessMeta ? freshnessMeta.className : '',
    showStatusBadge: Boolean(freshnessMeta),
    usageStatusLabel: storedMeta.label,
    usageStatusClass: storedMeta.className,
    usageActionLabel: storedMeta.actionLabel,
    usageActionIcon: '⋯',
    deleteActionIcon: '🗑',
    locationLabel: location || '未设置位置',
    dateLabel: expirationDate ? `到期 ${expirationDate}` : '未设置到期',
    hasNotes: Boolean(notes),
    notesDisplay: notes,
    cardThumbText: buildThumbText(item)
  }
}

function buildDisplayItems(items = []) {
  return (items || []).map((item) => buildDisplayItem(item))
}

function isProcessedItem(item = {}) {
  return item.status === 'empty' || item.status === 'discarded'
}

function matchesKeyword(item = {}, keyword = '') {
  const normalizedKeyword = normalizeText(keyword).toLowerCase()
  if (!normalizedKeyword) {
    return true
  }

  return [item.name, item.categoryLabel, item.locationLabel, item.notesDisplay]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedKeyword))
}

function filterVisibleItems(items = [], options = {}) {
  return (items || []).filter((item) => {
    if (!options.showProcessed && isProcessedItem(item)) {
      return false
    }

    if (options.activeCategoryKey && options.activeCategoryKey !== 'all' && item.categoryKey !== options.activeCategoryKey) {
      return false
    }

    if (!matchesKeyword(item, options.searchKeyword)) {
      return false
    }

    return true
  })
}

function buildFreshnessSummary(items = []) {
  const counts = {
    active: 0,
    expiring: 0,
    expired: 0
  }

  ;(items || []).forEach((item) => {
    if (counts[item.status] !== undefined) {
      counts[item.status] += 1
    }
  })

  return `正常 ${counts.active} · 临期 ${counts.expiring} · 过期 ${counts.expired}`
}

function buildManagementStatusText(items = []) {
  const counts = {
    active: 0,
    opened: 0,
    expiring: 0,
    expired: 0,
    empty: 0,
    discarded: 0
  }

  ;(items || []).forEach((item) => {
    const actualStatus = normalizeText(item.status)
    if (counts[actualStatus] !== undefined) {
      counts[actualStatus] += 1
    }
  })

  return `正常 ${counts.active} · 已开封 ${counts.opened} · 即将过期 ${counts.expiring} · 已过期 ${counts.expired} · 已用完 ${counts.empty} · 已丢弃 ${counts.discarded}`
}

function buildManagementCategoryCountText(categoryOptions = []) {
  const visibleOptions = (categoryOptions || []).filter((item) => item && item.key !== 'all')
  if (!visibleOptions.length) {
    return DEFAULT_MANAGEMENT_CATEGORY_COUNT_TEXT
  }

  return visibleOptions.map((item) => `${item.label} ${item.count || 0}`).join(' · ')
}

function buildManagementCoverText(items = []) {
  return items.length ? items[0].cardThumbText || '食' : '柜'
}

function getManagerConfig(type = 'category') {
  return MANAGER_CONFIG[type] || MANAGER_CONFIG.category
}

function getManagerStateKeys(type = 'category') {
  if (type === 'location') {
    return {
      inputKey: 'locationManagerInput',
      loadingKey: 'locationManagerLoading',
      itemsKey: 'locationManagerItems',
      viewItemsKey: 'locationManagerViewItems'
    }
  }

  return {
    inputKey: 'categoryManagerInput',
    loadingKey: 'categoryManagerLoading',
    itemsKey: 'categoryManagerItems',
    viewItemsKey: 'categoryManagerViewItems'
  }
}

function buildManagerViewItems(items = [], options = {}) {
  return (items || []).map((item, index) => {
    const isDragging = options.draggingType === options.type && options.draggingIndex === index
    return {
    ...item,
    showCountBadge: (item.pantryItemCount || 0) > 0,
    countText: `${item.pantryItemCount || 0}项库存`,
    showDelete: !((item.pantryItemCount || 0) > 0),
    itemClass: isDragging ? 'settings-modal__item settings-modal__item--dragging' : 'settings-modal__item',
    dragClass: isDragging ? 'settings-modal__drag settings-modal__drag--active' : 'settings-modal__drag'
    }
  })
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

function buildSummary(items = [], total = 0, limit = 0, hasMore = false) {
  if (!(items || []).length) {
    return '这个空间还没有库存项，先添加常用食材吧。'
  }

  if (hasMore && limit > 0) {
    return `当前空间共 ${total} 项库存，当前显示前 ${limit} 项。`
  }

  return `当前空间共 ${total || items.length} 项库存，可按分类和关键词快速筛选。`
}

function replaceItem(items = [], nextItem = {}) {
  return (items || []).map((item) => (item._id === nextItem._id ? nextItem : item))
}

function toPantryWritePayload(item = {}, usageStatus) {
  return {
    name: normalizeText(item.name),
    category: normalizeText(item.category),
    quantity: normalizeText(item.quantity) || '1',
    unit: normalizeText(item.unit),
    location: normalizeText(item.location),
    expirationDate: normalizeText(item.expirationDate),
    notes: normalizeText(item.notes),
    productionDate: normalizeText(item.productionDate),
    shelfLifeMonths: normalizeText(item.shelfLifeMonths),
    openedDate: normalizeText(item.openedDate),
    status: normalizeStoredStatus(usageStatus)
  }
}

function showOperationError(error) {
  if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
    wx.showToast({
      title: getErrorMessage(error),
      icon: 'none'
    })
  }
}

function isNotFoundError(error) {
  return error && typeof error.code === 'number' && error.code === ERROR_CODES.NOT_FOUND
}

function shouldTreatManagerListAsEmpty(error) {
  if (!isNotFoundError(error)) {
    return false
  }

  const message = error && typeof error.message === 'string' ? error.message : ''
  return message === 'Pantry category not found' || message === 'Pantry location not found'
}

Page({
  data: {
    loading: true,
    currentDateLabel: createDateLabel(),
    activeSpaceId: '',
    items: [],
    visibleItems: [],
    categorySourceValues: [],
    categoryOptions: [{ key: 'all', label: '全部', count: 0 }],
    categoryViewItems: [{ key: 'all', label: '全部', count: 0, countText: '0', itemClass: 'rail-item rail-item--active' }],
    activeCategoryKey: 'all',
    activeCategoryLabel: '全部',
    searchKeyword: '',
    showProcessed: false,
    showProcessedText: '显示已处理',
    showVisibleItems: false,
    showEmptyState: false,
    errorMessage: '',
    truncationMessage: '',
    summary: '正在读取库存...',
    emptyTitle: '还没有库存',
    emptyMessage: '这个空间还没有库存项，先添加常用食材吧。',
    managementCountText: '共 0 项库存',
    managementStatusText: '正常 0 · 已开封 0 · 即将过期 0 · 已过期 0 · 已用完 0 · 已丢弃 0',
    managementCategoryCountText: DEFAULT_MANAGEMENT_CATEGORY_COUNT_TEXT,
    managementCoverText: '柜',
    visibleItemsCountText: '0 项',
    processedCount: 0,
    processedCountText: '已处理 0 项',
    showSettingsModal: false,
    draggingManagerType: '',
    draggingManagerIndex: -1,
    categoryManagerInput: '',
    categoryManagerLoading: false,
    categoryManagerItems: [],
    categoryManagerViewItems: [],
    locationManagerInput: '',
    locationManagerLoading: false,
    locationManagerItems: [],
    locationManagerViewItems: [],
    railScrollHeight: 400,
    surfaceScrollHeight: 400,
    customScrollbarVisible: false,
    customScrollbarThumbH: 0,
    customScrollbarThumbTop: 0
  },

  onReady() {
    const query = wx.createSelectorQuery().in(this)
    query.select('.channel-layout').boundingClientRect()
    query.select('.channel-surface').boundingClientRect()
    query.exec((res) => {
      const next = {}
      if (res[0] && res[0].height > 0) next.railScrollHeight = res[0].height
      if (res[1] && res[1].height > 0) next.surfaceScrollHeight = res[1].height
      if (Object.keys(next).length) this.setData(next)
    })
  },

  onShow() {
    this.managerDragState = null
    syncCurrentTabBar(this, '/pages/pantry/index')
    this.loadPantry()
  },

  async onPullDownRefresh() {
    await this.loadPantry()
    wx.stopPullDownRefresh()
  },

  syncDerivedState(overrides = {}) {
    const nextState = {
      ...this.data,
      ...overrides
    }

    const categoryOptions = buildCategoryOptions(nextState.items || [], nextState.categorySourceValues || [])
    const hasActiveCategory = categoryOptions.some((item) => item.key === nextState.activeCategoryKey)
    const activeCategoryKey = hasActiveCategory ? nextState.activeCategoryKey : 'all'
    const visibleItems = filterVisibleItems(nextState.items || [], {
      activeCategoryKey,
      searchKeyword: nextState.searchKeyword,
      showProcessed: nextState.showProcessed
    })
    const processedCount = (nextState.items || []).filter((item) => isProcessedItem(item)).length
    const updates = {
      ...overrides,
      categoryOptions,
      categoryViewItems: buildCategoryViewItems(categoryOptions, activeCategoryKey),
      activeCategoryKey,
      activeCategoryLabel: getCategoryOptionLabel(categoryOptions, activeCategoryKey),
      visibleItems,
      visibleItemsCountText: `${visibleItems.length} 项`,
      showVisibleItems: visibleItems.length > 0,
      showEmptyState: !nextState.loading && !nextState.errorMessage && visibleItems.length === 0,
      showProcessedText: nextState.showProcessed ? '隐藏已处理' : '显示已处理',
      emptyTitle: (nextState.items || []).length ? '暂无匹配库存' : '还没有库存',
      emptyMessage: (nextState.items || []).length
        ? '调整分类、搜索词或处理状态后再试。'
        : '这个空间还没有库存项，先添加常用食材吧。',
      managementCountText: `共 ${(nextState.items || []).length} 项库存`,
      managementStatusText: buildManagementStatusText(nextState.items || []),
      managementCategoryCountText: buildManagementCategoryCountText(categoryOptions),
      managementCoverText: buildManagementCoverText(nextState.items || []),
      processedCount,
      processedCountText: `已处理 ${processedCount} 项`
    }

    this.setData(updates, () => {
      const query = wx.createSelectorQuery().in(this)
      query.select('.channel-layout').boundingClientRect()
      query.select('.channel-surface').boundingClientRect()
      query.exec((res) => {
        const next = {}
        if (res[0] && res[0].height > 0 && res[0].height !== this.data.railScrollHeight) next.railScrollHeight = res[0].height
        if (res[1] && res[1].height > 0 && res[1].height !== this.data.surfaceScrollHeight) next.surfaceScrollHeight = res[1].height
        if (Object.keys(next).length) this.setData(next)
      })
    })
  },

  async loadPantry() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      currentDateLabel: createDateLabel(),
      activeSpaceId,
      errorMessage: ''
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        items: [],
        visibleItems: [],
        categorySourceValues: [],
        categoryOptions: [{ key: 'all', label: '全部', count: 0 }],
        categoryViewItems: [{ key: 'all', label: '全部', count: 0, countText: '0', itemClass: 'rail-item rail-item--active' }],
        activeCategoryKey: 'all',
        activeCategoryLabel: '全部',
        showVisibleItems: false,
        showEmptyState: false,
        truncationMessage: '',
        summary: '请先选择一个空间，再查看共享库存。',
        managementCountText: '共 0 项库存',
        managementStatusText: '正常 0 · 已开封 0 · 即将过期 0 · 已过期 0 · 已用完 0 · 已丢弃 0',
        managementCategoryCountText: DEFAULT_MANAGEMENT_CATEGORY_COUNT_TEXT,
        managementCoverText: '柜',
        visibleItemsCountText: '0 项',
        processedCount: 0,
        processedCountText: '已处理 0 项',
        showSettingsModal: false,
        draggingManagerType: '',
        draggingManagerIndex: -1,
        categoryManagerInput: '',
        categoryManagerLoading: false,
        categoryManagerItems: [],
        categoryManagerViewItems: [],
        locationManagerInput: '',
        locationManagerLoading: false,
        locationManagerItems: [],
        locationManagerViewItems: []
      })
      return
    }

    try {
      const result = await createPantryService().listPantry(activeSpaceId, {})
      const items = buildDisplayItems(result.items || [])
      const total = typeof result.total === 'number' ? result.total : items.length
      const limit = typeof result.limit === 'number' && result.limit > 0 ? result.limit : items.length
      const hasMore = Boolean(result.hasMore) || (limit > 0 && total > limit)

      this.syncDerivedState({
        loading: false,
        errorMessage: '',
        items,
        categorySourceValues:
          result.filterOptions && Array.isArray(result.filterOptions.categories)
            ? result.filterOptions.categories
            : buildCategorySourceValues(items),
        truncationMessage: hasMore ? `当前仅显示前 ${limit} 条库存，请继续筛选以缩小范围。` : '',
        summary: buildSummary(items, total, limit, hasMore)
      })
    } catch (error) {
      this.syncDerivedState({
        loading: false,
        items: [],
        categorySourceValues: [],
        errorMessage: getErrorMessage(error),
        truncationMessage: '',
        summary: '库存加载失败，请稍后重试。'
      })
    }
  },

  handleSurfaceScroll(event) {
    const { scrollTop, scrollHeight } = event.detail
    const viewH = this.data.surfaceScrollHeight
    if (!scrollHeight || scrollHeight <= viewH) return

    const minThumbH = 48
    const thumbH = Math.max(minThumbH, Math.round((viewH / scrollHeight) * viewH))
    const maxTop = viewH - thumbH
    const thumbTop = Math.round((scrollTop / (scrollHeight - viewH)) * maxTop)

    if (this._scrollbarTimer) clearTimeout(this._scrollbarTimer)
    this.setData({
      customScrollbarVisible: true,
      customScrollbarThumbH: thumbH,
      customScrollbarThumbTop: thumbTop
    })
    this._scrollbarTimer = setTimeout(() => {
      this.setData({ customScrollbarVisible: false })
    }, 800)
  },

  handleSearchInput(event) {
    this.syncDerivedState({
      searchKeyword: event && event.detail ? event.detail.value : ''
    })
  },

  clearSearch() {
    this.syncDerivedState({
      searchKeyword: ''
    })
  },

  handleCategoryChange(event) {
    const key = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.key || 'all'
      : 'all'
    this.syncDerivedState({
      activeCategoryKey: key
    })
  },

  handleToggleProcessed() {
    this.syncDerivedState({
      showProcessed: !this.data.showProcessed
    })
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/pantry-edit/index'
    })
  },

  handleOpenItem(event) {
    const pantryItemId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.pantryItemId || ''
      : ''
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
  },

  noop() {},

  async loadManagerItems(type = 'category') {
    if (!this.data.activeSpaceId) {
      return
    }

    const config = getManagerConfig(type)
    const keys = getManagerStateKeys(type)
    this.setData({
      [keys.loadingKey]: true
    })

    try {
      const service = createPantryService()
      const result = await service[config.listMethod](this.data.activeSpaceId)
      const items = Array.isArray(result.items) ? result.items : []
      this.setData({
        [keys.loadingKey]: false,
        [keys.itemsKey]: items,
        [keys.viewItemsKey]: buildManagerViewItems(items, {
          type,
          draggingType: this.data.draggingManagerType,
          draggingIndex: this.data.draggingManagerIndex
        })
      })
    } catch (error) {
      if (shouldTreatManagerListAsEmpty(error)) {
        this.setData({
          [keys.loadingKey]: false,
          [keys.itemsKey]: [],
          [keys.viewItemsKey]: []
        })
        return
      }
      this.setData({
        [keys.loadingKey]: false
      })
      showOperationError(error)
    }
  },

  async openSettingsModal() {
    if (!this.data.activeSpaceId) {
      return
    }

    this.setData({
      showSettingsModal: true
    })

    await Promise.all([
      this.loadManagerItems('category'),
      this.loadManagerItems('location')
    ])
  },

  closeSettingsModal() {
    this.setData({
      showSettingsModal: false,
      categoryManagerInput: '',
      locationManagerInput: ''
    })
  },

  handleManagerInput(type = 'category', event) {
    const keys = getManagerStateKeys(type)
    this.setData({
      [keys.inputKey]: event && event.detail ? event.detail.value : ''
    })
  },

  handleCategoryManagerInput(event) {
    this.handleManagerInput('category', event)
  },

  handleLocationManagerInput(event) {
    this.handleManagerInput('location', event)
  },

  async reloadPantryAndManager(type = 'category') {
    await this.loadPantry()
    await this.loadManagerItems(type)
  },

  async submitManagerCreate(type = 'category') {
    const keys = getManagerStateKeys(type)
    const config = getManagerConfig(type)
    const name = normalizeText(this.data[keys.inputKey])
    if (!name || !this.data.activeSpaceId) {
      return
    }
    const service = createPantryService()

    try {
      await service[config.createMethod](this.data.activeSpaceId, name)
      this.setData({
        [keys.inputKey]: ''
      })
      await this.reloadPantryAndManager(type)
    } catch (error) {
      showOperationError(error)
    }
  },

  async submitCategoryManagerCreate() {
    return this.submitManagerCreate('category')
  },

  async submitLocationManagerCreate() {
    return this.submitManagerCreate('location')
  },

  async persistManagerOrder(type = 'category', names = []) {
    const config = getManagerConfig(type)
    const service = createPantryService()
    return service[config.reorderMethod](this.data.activeSpaceId, names)
  },

  handleManagerDragStart(event) {
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const type = dataset.type || 'category'
    const index = Number(dataset.index)
    const touchPageY = getTouchPageY(event)
    const keys = getManagerStateKeys(type)
    const items = (this.data[keys.itemsKey] || []).slice()

    if (!Number.isInteger(index) || index < 0 || index >= items.length || typeof touchPageY !== 'number') {
      return
    }

    this.managerDragState = {
      type,
      startIndex: index,
      currentIndex: index,
      startY: touchPageY,
      snapshotItems: items,
      dirty: false
    }
    this.setData({
      draggingManagerType: type,
      draggingManagerIndex: index,
      [keys.viewItemsKey]: buildManagerViewItems(items, {
        type,
        draggingType: type,
        draggingIndex: index
      })
    })
  },

  handleManagerDragMove(event) {
    if (!this.managerDragState) {
      return
    }

    const touchPageY = getTouchPageY(event)
    if (typeof touchPageY !== 'number') {
      return
    }

    const keys = getManagerStateKeys(this.managerDragState.type)
    const currentItems = (this.data[keys.itemsKey] || []).slice()
    const deltaY = touchPageY - this.managerDragState.startY
    if (Math.abs(deltaY) < MANAGER_DRAG_SWAP_THRESHOLD) {
      return
    }

    const direction = deltaY > 0 ? 1 : -1
    const nextIndex = Math.max(0, Math.min(currentItems.length - 1, this.managerDragState.currentIndex + direction))
    if (nextIndex === this.managerDragState.currentIndex) {
      this.managerDragState.startY = touchPageY
      return
    }

    const nextItems = moveArrayItem(currentItems, this.managerDragState.currentIndex, nextIndex)
    this.managerDragState.currentIndex = nextIndex
    this.managerDragState.startY = touchPageY
    this.managerDragState.dirty = true

    this.setData({
      [keys.itemsKey]: nextItems,
      draggingManagerType: this.managerDragState.type,
      draggingManagerIndex: nextIndex,
      [keys.viewItemsKey]: buildManagerViewItems(nextItems, {
        type: this.managerDragState.type,
        draggingType: this.managerDragState.type,
        draggingIndex: nextIndex
      })
    })
  },

  async handleManagerDragEnd() {
    if (!this.managerDragState) {
      return
    }

    const dragState = this.managerDragState
    this.managerDragState = null

    if (!dragState.dirty) {
      this.setData({
        draggingManagerType: '',
        draggingManagerIndex: -1,
        [getManagerStateKeys(dragState.type).viewItemsKey]: buildManagerViewItems(
          this.data[getManagerStateKeys(dragState.type).itemsKey] || [],
          {
            type: dragState.type,
            draggingType: '',
            draggingIndex: -1
          }
        )
      })
      return
    }

    const keys = getManagerStateKeys(dragState.type)
    const reorderedItems = (this.data[keys.itemsKey] || []).slice()
    const names = reorderedItems.map((item) => item.name)

    try {
      const result = await this.persistManagerOrder(dragState.type, names)
      const persistedItems = Array.isArray(result.items) ? result.items : reorderedItems
      const updates = {
        draggingManagerType: '',
        draggingManagerIndex: -1,
        [keys.itemsKey]: persistedItems,
        [keys.viewItemsKey]: buildManagerViewItems(persistedItems, {
          type: dragState.type,
          draggingType: '',
          draggingIndex: -1
        })
      }

      if (dragState.type === 'category') {
        updates.categorySourceValues = persistedItems.map((item) => item.name)
      }

      this.syncDerivedState(updates)
    } catch (error) {
      this.setData({
        draggingManagerType: '',
        draggingManagerIndex: -1,
        [keys.itemsKey]: dragState.snapshotItems,
        [keys.viewItemsKey]: buildManagerViewItems(dragState.snapshotItems, {
          type: dragState.type,
          draggingType: '',
          draggingIndex: -1
        })
      })
      showOperationError(error)
    }
  },

  handleManagerDragCancel() {
    if (!this.managerDragState) {
      return
    }

    const dragState = this.managerDragState
    this.managerDragState = null
    if (!dragState.dirty) {
      this.setData({
        draggingManagerType: '',
        draggingManagerIndex: -1,
        [getManagerStateKeys(dragState.type).viewItemsKey]: buildManagerViewItems(
          this.data[getManagerStateKeys(dragState.type).itemsKey] || [],
          {
            type: dragState.type,
            draggingType: '',
            draggingIndex: -1
          }
        )
      })
      return
    }

    const keys = getManagerStateKeys(dragState.type)
    this.setData({
      draggingManagerType: '',
      draggingManagerIndex: -1,
      [keys.itemsKey]: dragState.snapshotItems,
      [keys.viewItemsKey]: buildManagerViewItems(dragState.snapshotItems, {
        type: dragState.type,
        draggingType: '',
        draggingIndex: -1
      })
    })
  },

  async renameManagerItem(type = 'category', event) {
    const previousName = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.name || ''
      : ''
    if (!previousName || typeof wx.showModal !== 'function') {
      return
    }

    const config = getManagerConfig(type)
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
      const service = createPantryService()
      await service[config.updateMethod](this.data.activeSpaceId, previousName, name)
      await this.reloadPantryAndManager(type)
    } catch (error) {
      showOperationError(error)
    }
  },

  async renameCategoryManagerItem(event) {
    return this.renameManagerItem('category', event)
  },

  async renameLocationManagerItem(event) {
    return this.renameManagerItem('location', event)
  },

  async deleteManagerItem(type = 'category', event) {
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const name = dataset.name || ''
    const deletable = dataset.deletable === true || dataset.deletable === 'true'
    if (!name || !deletable || typeof wx.showModal !== 'function') {
      return
    }

    const config = getManagerConfig(type)
    const modal = await wx.showModal({
      title: config.deleteTitle,
      content: `确认删除${config.deleteLabel}“${name}”吗？`,
      confirmColor: '#d14b4b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      const service = createPantryService()
      await service[config.deleteMethod](this.data.activeSpaceId, name)
      await this.reloadPantryAndManager(type)
    } catch (error) {
      showOperationError(error)
    }
  },

  async deleteCategoryManagerItem(event) {
    return this.deleteManagerItem('category', event)
  },

  async deleteLocationManagerItem(event) {
    return this.deleteManagerItem('location', event)
  },

  async handleCycleUsageStatus(event) {
    const pantryItemId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.pantryItemId || ''
      : ''
    if (!pantryItemId || !this.data.activeSpaceId) {
      return
    }

    const currentItem = (this.data.items || []).find((item) => item._id === pantryItemId)
    if (!currentItem) {
      return
    }

    let nextUsageStatus = ''
    if (typeof wx !== 'undefined' && typeof wx.showActionSheet === 'function') {
      const actionResult = await wx.showActionSheet({
        itemList: STATUS_ACTION_ITEMS.map((item) => item.label)
      })
      if (actionResult.cancel) {
        return
      }
      const selected = STATUS_ACTION_ITEMS[actionResult.tapIndex]
      nextUsageStatus = selected ? selected.value : ''
    } else {
      const current = normalizeStoredStatus(currentItem.storedStatus)
      const index = STORED_STATUS_SEQUENCE.indexOf(current)
      nextUsageStatus = STORED_STATUS_SEQUENCE[(index + 1) % STORED_STATUS_SEQUENCE.length]
    }

    if (!nextUsageStatus || nextUsageStatus === currentItem.storedStatus) {
      return
    }

    try {
      const result = await createPantryService().updatePantryItem(
        this.data.activeSpaceId,
        pantryItemId,
        toPantryWritePayload(currentItem, nextUsageStatus)
      )
      const updatedItem = buildDisplayItem(result.item || { ...currentItem, storedStatus: nextUsageStatus, status: nextUsageStatus })
      this.syncDerivedState({
        items: replaceItem(this.data.items || [], updatedItem)
      })
    } catch (error) {
      showOperationError(error)
    }
  },

  async handleDeleteItem(event) {
    const pantryItemId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.pantryItemId || ''
      : ''
    if (!pantryItemId || !this.data.activeSpaceId) {
      return
    }

    try {
      await createPantryService().deletePantryItem(this.data.activeSpaceId, pantryItemId)
      const nextItems = (this.data.items || []).filter((item) => item._id !== pantryItemId)
      this.syncDerivedState({
        items: nextItems
      })
    } catch (error) {
      showOperationError(error)
    }
  }
})
