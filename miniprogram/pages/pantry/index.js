const { createPantryService } = require('../../services/pantry')
const { ERROR_CODES } = require('../../shared/constants/error-codes')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { buildManagerOptionLabels, createEmptyPantryForm } = require('../../utils/pantry-form')
const { buildPantryManagerItems, getPantryManagerConfig } = require('../../utils/pantry-manager')
const { syncCurrentTabBar } = require('../../utils/tab-bar')
const { syncPageTheme } = require('../../utils/theme')

const DEFAULT_MANAGEMENT_CATEGORY_COUNT_TEXT = '暂无分类'
const UNCATEGORIZED_KEY = '__uncategorized__'
const STORED_STATUS_SEQUENCE = ['active', 'opened', 'empty', 'discarded']
const MANAGER_DRAG_SWAP_THRESHOLD = 56
const FLOATING_CREATE_SIZE_RPX = 112
const FLOATING_CREATE_MARGIN_RPX = 24
const FLOATING_CREATE_TOP_MARGIN_RPX = 120
const FLOATING_CREATE_BOTTOM_CLEARANCE_RPX = 256
const FLOATING_CREATE_DRAG_THRESHOLD_PX = 16

const FRESHNESS_META = {
  expiring: {
    label: '临期',
    className: 'freshness-badge freshness-badge--expiring-soon'
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
  },
  expired: {
    label: '已过期',
    className: 'usage-badge usage-badge--expired',
    actionLabel: '开封',
    actionIcon: '◔'
  }
}

const STATUS_ACTION_ITEMS = [
  { value: 'active', label: '标记为正常' },
  { value: 'opened', label: '标记为已开封' },
  { value: 'empty', label: '标记为已用完' },
  { value: 'discarded', label: '标记为已丢弃' }
]

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

function rpxToPx(rpx = 0, windowWidth = 375) {
  return (Number(rpx) * Number(windowWidth)) / 750
}

function getWindowMetrics() {
  let windowWidth = 375
  let windowHeight = 667
  let safeBottom = windowHeight

  if (typeof wx !== 'undefined') {
    let info = null
    if (typeof wx.getWindowInfo === 'function') {
      try {
        info = wx.getWindowInfo()
      } catch (error) {
        void error
      }
    }
    if (!info && typeof wx.getSystemInfoSync === 'function') {
      try {
        info = wx.getSystemInfoSync()
      } catch (error) {
        void error
      }
    }
    if (info) {
      windowWidth = Number(info.windowWidth || info.screenWidth || windowWidth)
      windowHeight = Number(info.windowHeight || info.screenHeight || windowHeight)
      const safeArea = info.safeArea || null
      safeBottom = safeArea && typeof safeArea.bottom === 'number' ? safeArea.bottom : windowHeight
    }
  }

  return {
    windowWidth,
    windowHeight,
    safeBottom
  }
}

function getFloatingCreateBounds() {
  const metrics = getWindowMetrics()
  const sizePx = rpxToPx(FLOATING_CREATE_SIZE_RPX, metrics.windowWidth)
  const marginPx = rpxToPx(FLOATING_CREATE_MARGIN_RPX, metrics.windowWidth)
  const minTop = rpxToPx(FLOATING_CREATE_TOP_MARGIN_RPX, metrics.windowWidth)
  const bottomClearancePx = rpxToPx(FLOATING_CREATE_BOTTOM_CLEARANCE_RPX, metrics.windowWidth)
  const minLeft = marginPx
  const maxLeft = Math.max(minLeft, metrics.windowWidth - sizePx - marginPx)
  const maxTop = Math.max(minTop, metrics.safeBottom - sizePx - marginPx - bottomClearancePx)

  return {
    minLeft,
    maxLeft,
    minTop,
    maxTop
  }
}

function clampFloatingCreatePosition(left = 0, top = 0) {
  const bounds = getFloatingCreateBounds()
  return {
    left: Math.min(bounds.maxLeft, Math.max(bounds.minLeft, Number(left) || 0)),
    top: Math.min(bounds.maxTop, Math.max(bounds.minTop, Number(top) || 0))
  }
}

function buildDefaultFloatingCreatePosition() {
  const bounds = getFloatingCreateBounds()
  return {
    left: bounds.maxLeft,
    top: bounds.maxTop
  }
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

function mergeCategorySourceValues(sourceValues = [], items = []) {
  const values = []
  ;(sourceValues || []).forEach((value) => {
    const text = normalizeText(value)
    if (text && !values.includes(text)) {
      values.push(text)
    }
  })
  buildCategorySourceValues(items).forEach((value) => {
    if (value && !values.includes(value)) {
      values.push(value)
    }
  })
  return values
}

function isProcessedItem(item = {}) {
  return item.status === 'empty' || item.status === 'discarded'
}

function buildCategoryOptions(items = [], sourceValues = [], showProcessed = false) {
  const countItems = showProcessed ? (items || []) : (items || []).filter((item) => !isProcessedItem(item))
  const countsByKey = {}
  countItems.forEach((item) => {
    const key = getCategoryKey(item.category)
    countsByKey[key] = (countsByKey[key] || 0) + 1
  })

  const options = [
    {
      key: 'all',
      label: '全部',
      count: countItems.length
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

function formatExpirationDateText(expirationDate = '') {
  const parts = normalizeText(expirationDate).split('-')
  if (parts.length !== 3) {
    return normalizeText(expirationDate)
  }
  return `${parts[0]}/${parts[1]}/${parts[2]}`
}

function buildExpirationDateClass(actualStatus = '', expirationDate = '') {
  if (!normalizeText(expirationDate)) {
    return 'pantry-item__expiration'
  }
  if (actualStatus === 'expired') {
    return 'pantry-item__expiration pantry-item__expiration--expired'
  }
  if (actualStatus === 'expiring') {
    return 'pantry-item__expiration pantry-item__expiration--soon'
  }
  return 'pantry-item__expiration'
}

function buildDisplayItem(item = {}) {
  const actualStatus = normalizeText(item.status) || 'active'
  const storedStatus = normalizeStoredStatus(item.storedStatus || item.status)
  const storedMeta = actualStatus === 'expired'
    ? STORED_STATUS_META.expired
    : STORED_STATUS_META[storedStatus] || STORED_STATUS_META.active
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
    expirationDateText: formatExpirationDateText(expirationDate),
    expirationDateClass: buildExpirationDateClass(actualStatus, expirationDate),
    hasNotes: Boolean(notes),
    notesDisplay: notes,
    cardThumbText: buildThumbText(item)
  }
}

function buildDisplayItems(items = []) {
  return (items || []).map((item) => buildDisplayItem(item))
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
  return getPantryManagerConfig(type)
}

function getManagerStateKeys(type = 'category') {
  return {
    inputKey: 'categoryManagerInput',
    loadingKey: 'categoryManagerLoading',
    itemsKey: 'categoryManagerItems',
    metaKey: 'categoryManagerMetaText'
  }
}

function replaceManagerItem(items = [], previousName = '', nextItem = {}) {
  return (items || []).map((item) => {
    if (!item || item.name !== previousName) {
      return item
    }
    return {
      ...item,
      ...nextItem
    }
  })
}

function appendManagerItem(items = [], nextItem = {}) {
  if (!nextItem || !nextItem.name) {
    return items || []
  }

  const exists = (items || []).some((item) => item && item.name === nextItem.name)
  if (exists) {
    return items || []
  }

  return (items || []).concat(nextItem)
}

function removeManagerItem(items = [], name = '') {
  return (items || []).filter((item) => item && item.name !== name)
}

function renamePantryItemsField(items = [], fieldKey = 'category', previousName = '', nextName = '') {
  const normalizedPreviousName = normalizeText(previousName)
  const normalizedNextName = normalizeText(nextName)

  return (items || []).map((item) => {
    if (!item || normalizeText(item[fieldKey]) !== normalizedPreviousName) {
      return item
    }

    if (fieldKey === 'category') {
      return {
        ...item,
        category: normalizedNextName,
        categoryKey: getCategoryKey(normalizedNextName),
        categoryLabel: getCategoryLabel(normalizedNextName)
      }
    }

    return {
      ...item,
      location: normalizedNextName,
      locationLabel: normalizedNextName || '未设置位置'
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

function prependItem(items = [], nextItem = {}) {
  return [nextItem].concat((items || []).filter((item) => item && item._id !== nextItem._id))
}

function buildManagerUpdates(page, type = 'category', managerItems = [], extras = {}) {
  const keys = getManagerStateKeys(type)
  const updates = {
    [keys.itemsKey]: managerItems,
    [keys.metaKey]: `${managerItems.length} ${getManagerConfig(type).metaSuffix || '类'}`,
    ...extras
  }
  updates.categorySourceValues = managerItems.map((item) => item.name)

  return updates
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

function showManagerSuccessToast(action = '', config = {}) {
  if (typeof wx !== 'undefined' && typeof wx.showToast === 'function') {
    wx.showToast({
      title: `已${action}${config.deleteLabel || '分类'}`,
      icon: 'success'
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
    themeKey: 'default',
    themeStyle: '',
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
    draggingManagerIndex: -1,
    categoryManagerInput: '',
    categoryManagerLoading: false,
    categoryManagerItems: [],
    categoryManagerMetaText: '0 类',
    showCreateModal: false,
    submittingCreate: false,
    createForm: createEmptyPantryForm(),
    createCategoryOptions: ['未设置'],
    createLocationOptions: ['未设置'],
    floatingCreateLeft: 0,
    floatingCreateTop: 0,
    floatingCreateInitialized: false,
    floatingCreateScrollLocked: false,
    railScrollHeight: 400,
    surfaceScrollHeight: 400,
    customScrollbarVisible: false,
    customScrollbarThumbH: 0,
    customScrollbarThumbTop: 0
  },

  onReady() {
    this.initializeFloatingCreatePosition()
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
    this.floatingCreateDragState = null
    if (this.data.floatingCreateScrollLocked) {
      this.setData({ floatingCreateScrollLocked: false })
    }
    syncPageTheme(this)
    this.initializeFloatingCreatePosition()
    syncCurrentTabBar(this, '/pages/pantry/index')
    if (this.shouldReuseLoadedState()) {
      return
    }
    this.loadPantry()
  },

  async onPullDownRefresh() {
    await this.loadPantry()
    wx.stopPullDownRefresh()
  },

  initializeFloatingCreatePosition(force = false) {
    if (!force && this.data.floatingCreateInitialized) {
      return
    }

    const nextPosition = buildDefaultFloatingCreatePosition()
    this.setData({
      floatingCreateLeft: nextPosition.left,
      floatingCreateTop: nextPosition.top,
      floatingCreateInitialized: true
    })
  },

  syncDerivedState(overrides = {}) {
    const nextState = {
      ...this.data,
      ...overrides
    }

    const categoryOptions = buildCategoryOptions(nextState.items || [], nextState.categorySourceValues || [], nextState.showProcessed)
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
        draggingManagerIndex: -1,
        categoryManagerInput: '',
        categoryManagerLoading: false,
        categoryManagerItems: [],
        categoryManagerMetaText: '0 类',
        floatingCreateInitialized: false
      })
      this.hasLoadedPantryOnce = true
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
      this.hasLoadedPantryOnce = true
    } catch (error) {
      this.syncDerivedState({
        loading: false,
        items: [],
        categorySourceValues: [],
        errorMessage: getErrorMessage(error),
        truncationMessage: '',
        summary: '库存加载失败，请稍后重试。'
      })
      this.hasLoadedPantryOnce = false
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

  markNeedsRefreshOnNextShow() {
    this.forceRefreshOnNextShow = true
  },

  shouldReuseLoadedState() {
    if (this.forceRefreshOnNextShow) {
      this.forceRefreshOnNextShow = false
      return false
    }

    return Boolean(this.hasLoadedPantryOnce) &&
      !this.data.errorMessage &&
      this.data.activeSpaceId === getActiveSpaceId()
  },

  async goCreate() {
    if (!this.data.activeSpaceId) {
      return
    }

    const service = createPantryService()
    const initialCategory =
      this.data.activeCategoryKey !== 'all' && this.data.activeCategoryKey !== UNCATEGORIZED_KEY
        ? getCategoryOptionLabel(this.data.categoryOptions || [], this.data.activeCategoryKey)
        : ''
    const initialForm = {
      ...createEmptyPantryForm(),
      category: initialCategory
    }

    this.setData({
      showCreateModal: true,
      submittingCreate: false,
      createForm: initialForm,
      createCategoryOptions: buildManagerOptionLabels([], initialCategory),
      createLocationOptions: ['未设置']
    })

    try {
      const [categoryResult, locationResult] = await Promise.all([
        service.listPantryCategories(this.data.activeSpaceId).catch((error) => {
          if (shouldTreatManagerListAsEmpty(error)) {
            return { items: [] }
          }
          throw error
        }),
        service.listPantryLocations(this.data.activeSpaceId).catch((error) => {
          if (shouldTreatManagerListAsEmpty(error)) {
            return { items: [] }
          }
          throw error
        })
      ])

      this.setData({
        showCreateModal: true,
        submittingCreate: false,
        createForm: this.data.createForm || initialForm,
        createCategoryOptions: buildManagerOptionLabels(categoryResult.items || [], initialCategory),
        createLocationOptions: buildManagerOptionLabels(locationResult.items || [])
      })
    } catch (error) {
      showOperationError(error)
    }
  },

  async handleFloatingCreateTap() {
    if (this.ignoreNextFloatingCreateTap) {
      this.ignoreNextFloatingCreateTap = false
      return
    }
    return this.goCreate()
  },

  handleFloatingCreateTouchStart(event) {
    const touch = Array.isArray(event.touches) && event.touches.length
      ? event.touches[0]
      : event && event.detail && Array.isArray(event.detail.touches) && event.detail.touches.length
        ? event.detail.touches[0]
        : null
    if (!touch || typeof touch.pageX !== 'number' || typeof touch.pageY !== 'number') {
      return
    }

    this.floatingCreateDragState = {
      startX: touch.pageX,
      startY: touch.pageY,
      startLeft: this.data.floatingCreateLeft,
      startTop: this.data.floatingCreateTop,
      dirty: false
    }
    if (!this.data.floatingCreateScrollLocked) {
      this.setData({ floatingCreateScrollLocked: true })
    }
  },

  handleFloatingCreateTouchMove(event) {
    if (!this.floatingCreateDragState) {
      return
    }

    const touch = Array.isArray(event.touches) && event.touches.length
      ? event.touches[0]
      : event && event.detail && Array.isArray(event.detail.touches) && event.detail.touches.length
        ? event.detail.touches[0]
        : null
    if (!touch || typeof touch.pageX !== 'number' || typeof touch.pageY !== 'number') {
      return
    }

    const deltaX = touch.pageX - this.floatingCreateDragState.startX
    const deltaY = touch.pageY - this.floatingCreateDragState.startY
    if (
      !this.floatingCreateDragState.dirty &&
      Math.abs(deltaX) < FLOATING_CREATE_DRAG_THRESHOLD_PX &&
      Math.abs(deltaY) < FLOATING_CREATE_DRAG_THRESHOLD_PX
    ) {
      return
    }

    this.floatingCreateDragState.dirty = true
    const nextPosition = clampFloatingCreatePosition(
      this.floatingCreateDragState.startLeft + deltaX,
      this.floatingCreateDragState.startTop + deltaY
    )
    this.setData({
      floatingCreateLeft: nextPosition.left,
      floatingCreateTop: nextPosition.top
    })
  },

  handleFloatingCreateTouchEnd() {
    if (!this.floatingCreateDragState) {
      if (this.data.floatingCreateScrollLocked) {
        this.setData({ floatingCreateScrollLocked: false })
      }
      return
    }
    const dragState = this.floatingCreateDragState
    this.floatingCreateDragState = null
    this.setData({ floatingCreateScrollLocked: false })
    if (dragState.dirty) {
      this.ignoreNextFloatingCreateTap = true
      return
    }
    this.ignoreNextFloatingCreateTap = true
    return this.goCreate()
  },

  handleFloatingCreateTouchCancel() {
    if (!this.floatingCreateDragState) {
      if (this.data.floatingCreateScrollLocked) {
        this.setData({ floatingCreateScrollLocked: false })
      }
      return
    }
    const dragState = this.floatingCreateDragState
    this.floatingCreateDragState = null
    this.setData({ floatingCreateScrollLocked: false })
    if (dragState.dirty) {
      this.ignoreNextFloatingCreateTap = true
    }
  },

  handleCreateFormChange(event) {
    this.setData({
      createForm: event && event.detail && event.detail.form
        ? event.detail.form
        : createEmptyPantryForm()
    })
  },

  closeCreateModal() {
    this.setData({
      showCreateModal: false,
      submittingCreate: false,
      createForm: createEmptyPantryForm(),
      createCategoryOptions: ['未设置'],
      createLocationOptions: ['未设置']
    })
  },

  async submitCreatePantry(event) {
    if (this.data.submittingCreate || !this.data.activeSpaceId) {
      return
    }

    const form = event && event.detail && event.detail.form
      ? event.detail.form
      : this.data.createForm

    this.setData({
      submittingCreate: true,
      createForm: form
    })

    try {
      const result = await createPantryService().createPantryItem(this.data.activeSpaceId, form)
      const createdItem = buildDisplayItem(result.item || form)
      const nextItems = prependItem(this.data.items || [], createdItem)
      this.closeCreateModal()
      this.syncDerivedState({
        items: nextItems,
        categorySourceValues: mergeCategorySourceValues(this.data.categorySourceValues || [], nextItems),
        summary: buildSummary(nextItems, nextItems.length, nextItems.length, false),
        truncationMessage: ''
      })
      wx.showToast({
        title: '已添加库存',
        icon: 'success'
      })
    } catch (error) {
      this.setData({
        submittingCreate: false
      })
      showOperationError(error)
    }
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
      const items = buildPantryManagerItems(Array.isArray(result.items) ? result.items : [], type)
      this.setData({
        [keys.loadingKey]: false,
        [keys.itemsKey]: items,
        [keys.metaKey]: `${items.length} ${config.metaSuffix || '类'}`
      })
    } catch (error) {
      if (shouldTreatManagerListAsEmpty(error)) {
        this.setData({
          [keys.loadingKey]: false,
          [keys.itemsKey]: [],
          [keys.metaKey]: `0 ${config.metaSuffix || '类'}`
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
      showSettingsModal: true,
      draggingManagerIndex: -1
    })

    await this.loadManagerItems('category')
  },

  closeSettingsModal() {
    this.setData({
      showSettingsModal: false,
      draggingManagerIndex: -1,
      categoryManagerInput: ''
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

  async submitManagerCreate(type = 'category') {
    const keys = getManagerStateKeys(type)
    const config = getManagerConfig(type)
    const name = normalizeText(this.data[keys.inputKey])
    if (!name || !this.data.activeSpaceId) {
      return
    }
    const service = createPantryService()

    try {
      const result = await service[config.createMethod](this.data.activeSpaceId, name)
      const nextManagerItems = buildPantryManagerItems(
        appendManagerItem(this.data[keys.itemsKey] || [], result.item || {
          name,
          pantryItemCount: 0,
          deletable: true
        }),
        type
      )

      this.syncDerivedState(buildManagerUpdates(this, type, nextManagerItems, {
        [keys.inputKey]: ''
      })
      )
      showManagerSuccessToast('添加', config)
    } catch (error) {
      showOperationError(error)
    }
  },

  async submitCategoryManagerCreate() {
    return this.submitManagerCreate('category')
  },

  async persistManagerOrder(type = 'category', names = []) {
    const config = getManagerConfig(type)
    const service = createPantryService()
    return service[config.reorderMethod](this.data.activeSpaceId, names)
  },

  handleManagerDragStart(event) {
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const detail = event && event.detail ? event.detail : {}
    const type = dataset.type || detail.type || 'category'
    const index = Number(dataset.index !== undefined ? dataset.index : detail.index)
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
      draggingManagerIndex: index
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
      draggingManagerIndex: nextIndex
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
        draggingManagerIndex: -1
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
        draggingManagerIndex: -1,
        [keys.itemsKey]: buildPantryManagerItems(persistedItems, dragState.type),
        [keys.metaKey]: `${persistedItems.length} ${getManagerConfig(dragState.type).metaSuffix || '类'}`
      }

      if (dragState.type === 'category') {
        updates.categorySourceValues = persistedItems.map((item) => item.name)
      }

      this.syncDerivedState(updates)
    } catch (error) {
      this.setData({
        draggingManagerIndex: -1,
        [keys.itemsKey]: dragState.snapshotItems,
        [keys.metaKey]: `${dragState.snapshotItems.length} ${getManagerConfig(dragState.type).metaSuffix || '类'}`
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
        draggingManagerIndex: -1
      })
      return
    }

    const keys = getManagerStateKeys(dragState.type)
    this.setData({
      draggingManagerIndex: -1,
      [keys.itemsKey]: dragState.snapshotItems,
      [keys.metaKey]: `${dragState.snapshotItems.length} ${getManagerConfig(dragState.type).metaSuffix || '类'}`
    })
  },

  async renameManagerItem(type = 'category', event) {
    const previousName = event && event.detail && event.detail.name
      ? event.detail.name
      : event && event.currentTarget && event.currentTarget.dataset
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
      const result = await service[config.updateMethod](this.data.activeSpaceId, previousName, name)
      const nextManagerItems = buildPantryManagerItems(
        replaceManagerItem(this.data[getManagerStateKeys(type).itemsKey] || [], previousName, result.item || {
          name
        }),
        type
      )
      const updates = buildManagerUpdates(this, type, nextManagerItems)

      if (type === 'category') {
        updates.items = renamePantryItemsField(this.data.items || [], 'category', previousName, name)
      } else {
        updates.items = renamePantryItemsField(this.data.items || [], 'location', previousName, name)
      }

      this.syncDerivedState(updates)
      showManagerSuccessToast('更新', config)
    } catch (error) {
      showOperationError(error)
    }
  },

  async renameCategoryManagerItem(event) {
    return this.renameManagerItem('category', event)
  },

  async deleteManagerItem(type = 'category', event) {
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const detail = event && event.detail ? event.detail : {}
    const name = detail.name || dataset.name || ''
    const deletable = detail.deletable === true || detail.deletable === 'true' || dataset.deletable === true || dataset.deletable === 'true'
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
      const nextManagerItems = buildPantryManagerItems(
        removeManagerItem(this.data[getManagerStateKeys(type).itemsKey] || [], name),
        type
      )
      this.syncDerivedState(buildManagerUpdates(this, type, nextManagerItems))
      showManagerSuccessToast('删除', config)
    } catch (error) {
      showOperationError(error)
    }
  },

  async deleteCategoryManagerItem(event) {
    return this.deleteManagerItem('category', event)
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

    const currentItem = (this.data.items || []).find((item) => item && item._id === pantryItemId)
    if (!currentItem) {
      return
    }

    if (typeof wx !== 'undefined' && typeof wx.showModal === 'function') {
      const modal = await wx.showModal({
        title: '删除库存',
        content: `确认删除“${currentItem.name || '这个库存项'}”吗？`,
        confirmColor: '#d14b4b'
      })
      if (!modal.confirm) {
        return
      }
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
