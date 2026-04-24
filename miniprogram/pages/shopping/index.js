const { createPantryService } = require('../../services/pantry')
const { createShoppingService } = require('../../services/shopping')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const {
  buildManagerOptionLabels,
  createEmptyPantryForm,
  getPickerIndex,
  getPickerValue,
  normalizeText
} = require('../../utils/pantry-form')
const { syncCurrentTabBar } = require('../../utils/tab-bar')
const { syncPageTheme } = require('../../utils/theme')

const STATUS_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'archived', label: '已归档' }
]

function createDateLabel(now = new Date()) {
  return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
}

function createTodayIso(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptyListForm(todayIso = createTodayIso()) {
  return {
    name: '',
    listDate: todayIso,
    status: 'open',
    notes: ''
  }
}

function createEmptyListItemDraft() {
  return {
    shoppingItemId: '',
    expectedUpdatedAt: '',
    name: '',
    category: '',
    quantity: '1',
    unit: '',
    notes: ''
  }
}

function buildShoppingProgress(items = []) {
  const total = (items || []).length
  const checked = (items || []).filter((item) => Boolean(item && item.isChecked)).length
  const percent = total ? Math.round((checked / total) * 100) : 0
  return {
    total,
    checked,
    percent
  }
}

function getStatusLabel(status = '') {
  const labels = {
    open: '进行中',
    completed: '已完成',
    archived: '已归档'
  }
  return labels[normalizeText(status)] || '进行中'
}

function getStatusClass(status = '') {
  const normalized = normalizeText(status) || 'open'
  return `shopping-list-card__status shopping-list-card__status--${normalized}`
}

function getStatusSectionTitle(filterKey = 'all') {
  return getStatusLabel(filterKey === 'all' ? 'open' : filterKey).replace('归档', '已归档')
}

function getTabClass(key = '', activeKey = 'all') {
  return key === activeKey ? 'shopping-status-tab shopping-status-tab--active' : 'shopping-status-tab'
}

function decorateShoppingItem(item = {}) {
  const isChecked = Boolean(item.isChecked)
  return {
    ...item,
    isChecked,
    quantityLabel: item.quantity && item.unit ? `${item.quantity} ${item.unit}` : item.quantity || item.unit || '',
    sourceLabel: item.sourceType === 'generated' ? '计划生成' : '手动增加',
    nameClass: isChecked ? 'shopping-item-row__name shopping-item-row__name--checked' : 'shopping-item-row__name'
  }
}

function sortShoppingLists(items = []) {
  return [...(items || [])].sort((left, right) => {
    const leftDate = normalizeText(left.listDate)
    const rightDate = normalizeText(right.listDate)
    const byDate = rightDate.localeCompare(leftDate)
    if (byDate !== 0) {
      return byDate
    }
    return normalizeText(right.updatedAt).localeCompare(normalizeText(left.updatedAt))
  })
}

function decorateShoppingList(list = {}, collapsedIdSet = new Set()) {
  const items = (list.items || []).map((item) => decorateShoppingItem(item))
  const progress = buildShoppingProgress(items)
  const generatedCount = items.filter((item) => item.sourceType === 'generated').length
  const status = normalizeText(list.status) || 'open'
  const itemsCollapsed = Boolean(list && list._id && collapsedIdSet.has(list._id))

  return {
    ...list,
    name: normalizeText(list.name) || '未命名清单',
    listDate: normalizeText(list.listDate),
    status,
    statusLabel: getStatusLabel(status),
    statusClass: getStatusClass(status),
    progress,
    progressText: `${progress.checked} / ${progress.total} 项已完成`,
    progressPercentStyle: `width:${progress.percent}%;`,
    items,
    itemsCollapsed,
    generatedCount,
    pendingCount: items.filter((item) => !item.isChecked).length,
    manualItems: items.filter((item) => item.sourceType !== 'generated')
  }
}

function filterShoppingLists(items = [], activeFilterKey = 'all') {
  if (activeFilterKey === 'all') {
    return items
  }
  return (items || []).filter((item) => item.status === activeFilterKey)
}

function buildStatusTabs(items = [], activeFilterKey = 'all') {
  const counts = {
    all: (items || []).length,
    open: (items || []).filter((item) => item.status === 'open').length,
    completed: (items || []).filter((item) => item.status === 'completed').length,
    archived: (items || []).filter((item) => item.status === 'archived').length
  }

  return STATUS_OPTIONS.map((item) => ({
    ...item,
    count: counts[item.key] || 0,
    itemClass: getTabClass(item.key, activeFilterKey)
  }))
}

function buildHeroMetrics(items = []) {
  const allItems = (items || []).flatMap((item) => item.items || [])
  const progress = buildShoppingProgress(allItems)
  return {
    heroPendingCountText: String(allItems.filter((item) => !item.isChecked).length),
    heroProgressText: `${progress.percent}%`,
    heroGeneratedCountText: String(allItems.filter((item) => item.sourceType === 'generated').length)
  }
}

function buildDraftFromShoppingItem(item = {}) {
  return {
    shoppingItemId: item._id || '',
    expectedUpdatedAt: item.updatedAt || '',
    name: item.name || '',
    category: item.category || '',
    quantity: item.quantity || '1',
    unit: item.unit || '',
    notes: item.notes || ''
  }
}

function hasValidDraftName(draft = {}) {
  return Boolean(normalizeText(draft.name))
}

function buildDraftCategoryOptions(drafts = [], categories = []) {
  const options = ['未设置']

  ;(categories || []).forEach((item) => {
    const name = normalizeText(item && item.name ? item.name : item)
    if (name && !options.includes(name)) {
      options.push(name)
    }
  })

  ;(drafts || []).forEach((draft) => {
    const name = normalizeText(draft && draft.category)
    if (name && !options.includes(name)) {
      options.push(name)
    }
  })

  return options
}

function decorateListItemDrafts(drafts = [], categoryOptions = []) {
  return (drafts || []).map((draft) => ({
    ...draft,
    categoryIndex: getPickerIndex(categoryOptions, draft.category)
  }))
}

function replaceShoppingItem(items = [], nextItem = {}) {
  const nextId = nextItem && nextItem._id ? nextItem._id : ''
  let replaced = false
  const nextItems = (items || []).map((item) => {
    if (item && item._id === nextId) {
      replaced = true
      return {
        ...item,
        ...nextItem
      }
    }
    return item
  })

  if (!replaced && nextId) {
    nextItems.push(nextItem)
  }

  return nextItems
}

function replaceShoppingList(lists = [], nextList = {}) {
  const nextId = nextList && nextList._id ? nextList._id : ''
  let replaced = false
  const nextLists = (lists || []).map((item) => {
    if (item && item._id === nextId) {
      replaced = true
      return {
        ...item,
        ...nextList
      }
    }
    return item
  })

  if (!replaced && nextId) {
    nextLists.push(nextList)
  }

  return nextLists
}

function updateShoppingListItems(lists = [], shoppingListId = '', updater) {
  return (lists || []).map((item) => {
    if (!item || item._id !== shoppingListId) {
      return item
    }

    return updater(item)
  })
}

function mergeGeneratedItems(items = [], generatedItems = []) {
  return (items || [])
    .filter((item) => item && item.sourceType !== 'generated')
    .concat(generatedItems || [])
}

function mergeManualDraftResults(items = [], savedItems = []) {
  const nextItems = (items || []).slice()

  ;(savedItems || []).forEach((savedItem) => {
    const savedId = savedItem && savedItem._id ? savedItem._id : ''
    const matchedIndex = nextItems.findIndex((item) => item && item._id === savedId)
    if (matchedIndex >= 0) {
      nextItems[matchedIndex] = {
        ...nextItems[matchedIndex],
        ...savedItem
      }
      return
    }
    nextItems.push(savedItem)
  })

  return nextItems
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
    activeSpaceId: '',
    currentDateLabel: createDateLabel(),
    todayIso: createTodayIso(),
    shoppingLists: [],
    visibleShoppingLists: [],
    activeFilterKey: 'all',
    statusTabs: buildStatusTabs([], 'all'),
    heroPendingCountText: '0',
    heroProgressText: '0%',
    heroGeneratedCountText: '0',
    summary: '管理采购清单，支持手动增加和计划生成。',
    listSectionTitle: '全部',
    errorMessage: '',
    emptyMessage: '当前还没有采购清单，先创建一个。',
    showListModal: false,
    listModalTitle: '新建清单',
    submittingList: false,
    editingShoppingListId: '',
    editingShoppingListUpdatedAt: '',
    listForm: createEmptyListForm(),
    listItemDrafts: [createEmptyListItemDraft()],
    listItemCategoryOptions: ['未设置'],
    collapsedShoppingListIds: [],
    showPantryEntryModal: false,
    submittingPantryEntry: false,
    pantryEntryForm: createEmptyPantryForm(),
    pantryEntryShoppingListId: '',
    pantryEntryShoppingListUpdatedAt: '',
    pantryEntryShoppingItemId: '',
    pantryEntryShoppingItemUpdatedAt: '',
    pantryCategoryOptions: ['未设置'],
    pantryLocationOptions: ['未设置'],
    pantryCategoryIndex: 0,
    pantryLocationIndex: 0
  },

  onShow() {
    syncPageTheme(this)
    syncCurrentTabBar(this, '/pages/shopping/index')
    if (this.shouldReuseLoadedState()) {
      return
    }
    this.loadShoppingLists()
  },

  async onPullDownRefresh() {
    await this.loadShoppingLists()
    wx.stopPullDownRefresh()
  },

  syncShoppingView(overrides = {}) {
    const nextState = {
      ...this.data,
      ...overrides
    }
    const collapsedShoppingListIds = (nextState.collapsedShoppingListIds || []).filter((id) =>
      (nextState.shoppingLists || []).some((item) => item && item._id === id)
    )
    const collapsedIdSet = new Set(collapsedShoppingListIds)
    const decoratedLists = sortShoppingLists(
      (nextState.shoppingLists || []).map((item) => decorateShoppingList(item, collapsedIdSet))
    )
    const activeFilterKey = nextState.activeFilterKey || 'all'
    const visibleShoppingLists = filterShoppingLists(decoratedLists, activeFilterKey)

    this.setData({
      ...overrides,
      collapsedShoppingListIds,
      shoppingLists: decoratedLists,
      visibleShoppingLists,
      activeFilterKey,
      statusTabs: buildStatusTabs(decoratedLists, activeFilterKey),
      listSectionTitle: activeFilterKey === 'all' ? '全部' : getStatusLabel(activeFilterKey),
      summary: decoratedLists.length ? '管理采购清单，支持手动增加和计划生成。' : '还没有采购清单，先创建一个。',
      emptyMessage: '当前还没有采购清单，先创建一个。',
      ...buildHeroMetrics(decoratedLists)
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

    return Boolean(this.hasLoadedShoppingOnce) &&
      !this.data.errorMessage &&
      this.data.activeSpaceId === getActiveSpaceId()
  },

  async loadShoppingLists() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId,
      currentDateLabel: createDateLabel(),
      todayIso: createTodayIso()
    })

    if (!activeSpaceId) {
      this.syncShoppingView({
        loading: false,
        shoppingLists: [],
        visibleShoppingLists: [],
        statusTabs: buildStatusTabs([], 'all'),
        summary: '请先选择空间后再查看采购清单。',
        errorMessage: '',
        emptyMessage: '当前没有可用空间。'
      })
      this.hasLoadedShoppingOnce = true
      return
    }

    try {
      const result = await createShoppingService().listShoppingLists(activeSpaceId)
      this.syncShoppingView({
        loading: false,
        shoppingLists: result.items || []
      })
      this.hasLoadedShoppingOnce = true
    } catch (error) {
      this.syncShoppingView({
        loading: false,
        shoppingLists: [],
        errorMessage: getErrorMessage(error),
        summary: '采购清单加载失败。'
      })
      this.hasLoadedShoppingOnce = false
    }
  },

  handleStatusFilterChange(event) {
    const key = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.key || 'all'
      : 'all'
    this.syncShoppingView({
      activeFilterKey: key
    })
  },

  openCreateListModal() {
    return this.openListModal({
      modalTitle: '新建清单',
      editingShoppingListId: '',
      editingShoppingListUpdatedAt: '',
      listForm: createEmptyListForm(this.data.todayIso),
      listItemDrafts: [createEmptyListItemDraft()]
    })
  },

  openEditListModal(event) {
    const shoppingListId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingListId || ''
      : ''
    const target = (this.data.shoppingLists || []).find((item) => item._id === shoppingListId)
    if (!target) {
      return Promise.resolve()
    }

    const draftRows = (target.manualItems || []).map((item) => buildDraftFromShoppingItem(item))

    return this.openListModal({
      modalTitle: '编辑清单',
      editingShoppingListId: target._id,
      editingShoppingListUpdatedAt: target.updatedAt || '',
      listForm: {
        name: target.name || '',
        listDate: target.listDate || this.data.todayIso,
        status: target.status || 'open',
        notes: target.notes || ''
      },
      listItemDrafts: draftRows.length ? draftRows : [createEmptyListItemDraft()]
    })
  },

  async openListModal(options = {}) {
    const rawDrafts = options.listItemDrafts || [createEmptyListItemDraft()]
    let listItemCategoryOptions = buildDraftCategoryOptions(rawDrafts, [])

    if (this.data.activeSpaceId) {
      try {
        const result = await createPantryService().listPantryCategories(this.data.activeSpaceId)
        listItemCategoryOptions = buildDraftCategoryOptions(rawDrafts, result.items || [])
      } catch (error) {
        listItemCategoryOptions = buildDraftCategoryOptions(rawDrafts, [])
      }
    }

    this.setData({
      showListModal: true,
      listModalTitle: options.modalTitle || '新建清单',
      editingShoppingListId: options.editingShoppingListId || '',
      editingShoppingListUpdatedAt: options.editingShoppingListUpdatedAt || '',
      listForm: options.listForm || createEmptyListForm(this.data.todayIso),
      listItemCategoryOptions,
      listItemDrafts: decorateListItemDrafts(rawDrafts, listItemCategoryOptions)
    })
  },

  closeListModal() {
    this.setData({
      showListModal: false,
      submittingList: false,
      listItemCategoryOptions: ['未设置']
    })
  },

  noop() {},

  handleListFormInput(event) {
    const field = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.field
      : ''
    if (!field) {
      return
    }
    this.setData({
      [`listForm.${field}`]: event.detail.value
    })
  },

  handleListDateChange(event) {
    this.setData({
      'listForm.listDate': event.detail.value
    })
  },

  handleListStatusChange(event) {
    const nextIndex = Number(event.detail.value)
    const option = STATUS_OPTIONS.filter((item) => item.key !== 'all')[nextIndex]
    this.setData({
      'listForm.status': option ? option.key : 'open'
    })
  },

  addListItemDraft() {
    this.setData({
      listItemDrafts: (this.data.listItemDrafts || []).concat(
        decorateListItemDrafts([createEmptyListItemDraft()], this.data.listItemCategoryOptions || ['未设置'])
      )
    })
  },

  removeListItemDraft(event) {
    const index = Number(event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.index
      : -1)
    if (index < 0) {
      return
    }
    const nextDrafts = (this.data.listItemDrafts || []).filter((_, itemIndex) => itemIndex !== index)
    this.setData({
      listItemDrafts: nextDrafts.length
        ? decorateListItemDrafts(nextDrafts, this.data.listItemCategoryOptions || ['未设置'])
        : decorateListItemDrafts([createEmptyListItemDraft()], this.data.listItemCategoryOptions || ['未设置'])
    })
  },

  handleListItemDraftInput(event) {
    const index = Number(event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.index
      : -1)
    const field = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.field
      : ''
    if (index < 0 || !field) {
      return
    }
    this.setData({
      [`listItemDrafts[${index}].${field}`]: event.detail.value
    })
  },

  handleListItemDraftCategoryChange(event) {
    const index = Number(event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.index
      : -1)
    if (index < 0) {
      return
    }

    const nextIndex = Number(event.detail.value)
    this.setData({
      [`listItemDrafts[${index}].categoryIndex`]: nextIndex,
      [`listItemDrafts[${index}].category`]: getPickerValue(this.data.listItemCategoryOptions || [], nextIndex)
    })
  },

  toggleShoppingListItems(event) {
    const shoppingListId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingListId || ''
      : ''
    if (!shoppingListId) {
      return
    }

    const collapsedShoppingListIds = (this.data.collapsedShoppingListIds || []).slice()
    const currentIndex = collapsedShoppingListIds.indexOf(shoppingListId)
    if (currentIndex >= 0) {
      collapsedShoppingListIds.splice(currentIndex, 1)
    } else {
      collapsedShoppingListIds.push(shoppingListId)
    }

    this.syncShoppingView({
      collapsedShoppingListIds
    })
  },

  async submitListModal() {
    if (this.data.submittingList || !this.data.activeSpaceId) {
      return
    }

    const name = normalizeText(this.data.listForm.name)
    if (!name) {
      wx.showToast({
        title: '请输入清单名称',
        icon: 'none'
      })
      return
    }

    this.setData({
      submittingList: true
    })

    try {
      let shoppingListId = this.data.editingShoppingListId
      let expectedUpdatedAt = this.data.editingShoppingListUpdatedAt
      let savedList = null

      const listPayload = {
        name,
        listDate: normalizeText(this.data.listForm.listDate),
        status: normalizeText(this.data.listForm.status) || 'open',
        notes: normalizeText(this.data.listForm.notes)
      }

      if (shoppingListId) {
        const updated = await createShoppingService().updateShoppingList(
          this.data.activeSpaceId,
          shoppingListId,
          listPayload,
          expectedUpdatedAt
        )
        savedList = updated.item || null
      } else {
        const created = await createShoppingService().createShoppingList(
          this.data.activeSpaceId,
          listPayload
        )
        savedList = created.item || null
      }

      shoppingListId = savedList ? savedList._id : shoppingListId
      expectedUpdatedAt = savedList ? savedList.updatedAt || '' : expectedUpdatedAt

      const drafts = (this.data.listItemDrafts || []).filter((item) => hasValidDraftName(item))
      const savedShoppingItems = []
      for (const draft of drafts) {
        const result = await createShoppingService().updateShoppingList(
          this.data.activeSpaceId,
          shoppingListId,
          {
            itemDraft: {
              shoppingItemId: draft.shoppingItemId || '',
              expectedUpdatedAt: draft.expectedUpdatedAt || '',
              name: normalizeText(draft.name),
              category: normalizeText(draft.category),
              quantity: normalizeText(draft.quantity) || '1',
              unit: normalizeText(draft.unit),
              notes: normalizeText(draft.notes),
              sourceType: 'manual'
            }
          },
          expectedUpdatedAt
        )
        expectedUpdatedAt = result && result.item ? result.item.updatedAt || expectedUpdatedAt : expectedUpdatedAt
        if (result && result.shoppingItem) {
          savedShoppingItems.push(result.shoppingItem)
        }
      }

      const existingList = shoppingListId
        ? (this.data.shoppingLists || []).find((item) => item._id === shoppingListId)
        : null
      const nextList = {
        ...(existingList || {}),
        ...(savedList || {}),
        updatedAt: expectedUpdatedAt || (savedList && savedList.updatedAt) || (existingList && existingList.updatedAt) || '',
        items: existingList
          ? mergeManualDraftResults(existingList.items || [], savedShoppingItems)
          : savedShoppingItems
      }

      this.closeListModal()
      this.syncShoppingView({
        shoppingLists: replaceShoppingList(this.data.shoppingLists || [], nextList)
      })
      wx.showToast({
        title: this.data.editingShoppingListId ? '已更新清单' : '已创建清单',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        submittingList: false
      })
    }
  },

  async deleteList(event) {
    const shoppingListId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingListId || ''
      : ''
    const target = (this.data.shoppingLists || []).find((item) => item._id === shoppingListId)
    if (!target) {
      return
    }

    const modal = await wx.showModal({
      title: '删除清单',
      content: `确认删除“${target.name}”吗？`,
      confirmColor: '#d14b4b'
    })
    if (!modal.confirm) {
      return
    }

    try {
      await createShoppingService().deleteShoppingList(
        this.data.activeSpaceId,
        shoppingListId,
        target.updatedAt || ''
      )
      this.syncShoppingView({
        shoppingLists: (this.data.shoppingLists || []).filter((item) => item && item._id !== shoppingListId)
      })
      wx.showToast({
        title: '已删除',
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
    const shoppingListId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingListId || ''
      : ''
    const shoppingItemId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingItemId || ''
      : ''
    const checked = Boolean(event.detail.value.length)
    const shoppingList = (this.data.shoppingLists || []).find((item) => item._id === shoppingListId)
    const shoppingItem = shoppingList
      ? (shoppingList.items || []).find((item) => item._id === shoppingItemId)
      : null

    if (!shoppingList || !shoppingItem) {
      return
    }

    try {
      const result = await createShoppingService().toggleShoppingItemChecked(
        this.data.activeSpaceId,
        shoppingListId,
        shoppingItemId,
        checked,
        shoppingItem.updatedAt || '',
        shoppingList.updatedAt || ''
      )
      const updatedItem = result && result.item
        ? result.item
        : {
            ...shoppingItem,
            isChecked: checked
          }

      this.syncShoppingView({
        shoppingLists: updateShoppingListItems(this.data.shoppingLists || [], shoppingListId, (item) => ({
          ...item,
          updatedAt: (result && result.shoppingListUpdatedAt) || updatedItem.updatedAt || item.updatedAt || '',
          items: replaceShoppingItem(item.items || [], updatedItem)
        }))
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async generateFromMealPlans(event) {
    const shoppingListId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingListId || ''
      : ''
    const shoppingList = (this.data.shoppingLists || []).find((item) => item._id === shoppingListId)
    if (!shoppingList) {
      return
    }

    try {
      const result = await createShoppingService().generateShoppingItemsFromPlan(
        this.data.activeSpaceId,
        shoppingListId,
        shoppingList.updatedAt || ''
      )
      const generatedItems = result && Array.isArray(result.items) ? result.items : []

      this.syncShoppingView({
        shoppingLists: updateShoppingListItems(this.data.shoppingLists || [], shoppingListId, (item) => ({
          ...item,
          updatedAt: (result && result.shoppingListUpdatedAt) || item.updatedAt || '',
          items: mergeGeneratedItems(item.items || [], generatedItems)
        }))
      })
      wx.showToast({
        title: '已生成采购项',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async openPantryEntryModal(event) {
    const shoppingListId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingListId || ''
      : ''
    const shoppingItemId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.shoppingItemId || ''
      : ''
    const shoppingList = (this.data.shoppingLists || []).find((item) => item._id === shoppingListId)
    const shoppingItem = shoppingList
      ? (shoppingList.items || []).find((item) => item._id === shoppingItemId)
      : null

    if (!shoppingList || !shoppingItem || !this.data.activeSpaceId) {
      return
    }

    const pantryService = createPantryService()
    const [categoryResult, locationResult] = await Promise.all([
      pantryService.listPantryCategories(this.data.activeSpaceId),
      pantryService.listPantryLocations(this.data.activeSpaceId)
    ])

    const pantryEntryForm = {
      ...createEmptyPantryForm(),
      name: shoppingItem.name || '',
      category: shoppingItem.category || '',
      quantity: shoppingItem.quantity || '1',
      unit: shoppingItem.unit || ''
    }
    const pantryCategoryOptions = buildManagerOptionLabels(categoryResult.items || [], pantryEntryForm.category)
    const pantryLocationOptions = buildManagerOptionLabels(locationResult.items || [], pantryEntryForm.location)

    this.setData({
      showPantryEntryModal: true,
      pantryEntryShoppingListId: shoppingListId,
      pantryEntryShoppingListUpdatedAt: shoppingList.updatedAt || '',
      pantryEntryShoppingItemId: shoppingItemId,
      pantryEntryShoppingItemUpdatedAt: shoppingItem.updatedAt || '',
      pantryEntryForm,
      pantryCategoryOptions,
      pantryLocationOptions,
      pantryCategoryIndex: getPickerIndex(pantryCategoryOptions, pantryEntryForm.category),
      pantryLocationIndex: getPickerIndex(pantryLocationOptions, pantryEntryForm.location)
    })
  },

  handlePantryEntryFormChange(event) {
    const nextForm = event && event.detail && event.detail.form
      ? event.detail.form
      : createEmptyPantryForm()

    this.setData({
      pantryEntryForm: nextForm,
      pantryCategoryIndex: getPickerIndex(this.data.pantryCategoryOptions || [], nextForm.category),
      pantryLocationIndex: getPickerIndex(this.data.pantryLocationOptions || [], nextForm.location)
    })
  },

  closePantryEntryModal() {
    this.setData({
      showPantryEntryModal: false,
      submittingPantryEntry: false,
      pantryEntryForm: createEmptyPantryForm(),
      pantryCategoryOptions: ['未设置'],
      pantryLocationOptions: ['未设置'],
      pantryCategoryIndex: 0,
      pantryLocationIndex: 0
    })
  },

  async submitPantryEntry(event) {
    if (this.data.submittingPantryEntry || !this.data.activeSpaceId) {
      return
    }
    const pantryEntryForm = event && event.detail && event.detail.form
      ? event.detail.form
      : this.data.pantryEntryForm

    if (!normalizeText(pantryEntryForm.name)) {
      wx.showToast({
        title: '请输入库存名称',
        icon: 'none'
      })
      return
    }

    this.setData({
      submittingPantryEntry: true
    })

    try {
      await createPantryService().createPantryItem(this.data.activeSpaceId, pantryEntryForm)
      const toggleResult = await createShoppingService().toggleShoppingItemChecked(
        this.data.activeSpaceId,
        this.data.pantryEntryShoppingListId,
        this.data.pantryEntryShoppingItemId,
        true,
        this.data.pantryEntryShoppingItemUpdatedAt,
        this.data.pantryEntryShoppingListUpdatedAt
      )
      const updatedItem = toggleResult && toggleResult.item
        ? toggleResult.item
        : {
            _id: this.data.pantryEntryShoppingItemId,
            isChecked: true
          }
      this.closePantryEntryModal()
      this.syncShoppingView({
        shoppingLists: updateShoppingListItems(
          this.data.shoppingLists || [],
          this.data.pantryEntryShoppingListId,
          (item) => ({
            ...item,
            updatedAt: (toggleResult && toggleResult.shoppingListUpdatedAt) || updatedItem.updatedAt || item.updatedAt || '',
            items: replaceShoppingItem(item.items || [], updatedItem)
          })
        )
      })
      wx.showToast({
        title: '已录入库存',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        submittingPantryEntry: false
      })
    }
  }
})
