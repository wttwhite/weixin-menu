const { createPantryService } = require('../../services/pantry')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncPageTheme } = require('../../utils/theme')
const {
  buildUnitOptionItems,
  buildManagerOptionLabels,
  buildPickerUpdates,
  createEmptyPantryForm,
  formatStepperValue,
  getPickerIndex,
  getPickerValue,
  normalizeDecimalStepperValue,
  normalizeStepperValue,
  normalizeText,
  resolveExpirationDate
} = require('../../utils/pantry-form')

const STATUS_OPTIONS = [
  { label: '正常', value: 'active' },
  { label: '已开封', value: 'opened' },
  { label: '已用完', value: 'empty' },
  { label: '已丢弃', value: 'discarded' }
]

const DETAIL_STATUS_META = {
  active: {
    label: '正常',
    className: 'detail-status'
  },
  opened: {
    label: '已开封',
    className: 'detail-status'
  },
  expiring: {
    label: '即将过期',
    className: 'detail-status'
  },
  expired: {
    label: '已过期',
    className: 'detail-status'
  },
  empty: {
    label: '已用完',
    className: 'detail-status'
  },
  discarded: {
    label: '已丢弃',
    className: 'detail-status'
  }
}

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildNotesCount(form = {}) {
  return String((form.notes || '').length)
}

function getStatusIndex(value = 'active') {
  const index = STATUS_OPTIONS.findIndex((item) => item.value === normalizeText(value))
  return index >= 0 ? index : 0
}

function buildPageCopy(isEdit = false) {
  return {
    submitButtonLabel: isEdit ? '保存库存' : '添加库存',
    loadingTitle: isEdit ? '正在加载库存信息...' : '正在准备库存表单...'
  }
}

function getDetailStatusMeta(form = {}, statusOptions = [], statusIndex = 0) {
  const actualStatus = normalizeText(form.actualStatus)
  const storedStatus = normalizeText(form.status)
  const status = DETAIL_STATUS_META[actualStatus] ? actualStatus : storedStatus
  return DETAIL_STATUS_META[status] || {
    label: statusOptions[statusIndex] || STATUS_OPTIONS[0].label,
    className: 'detail-status'
  }
}

function buildDetailViewData(form = {}, statusOptions = [], statusIndex = 0) {
  const quantity = normalizeText(form.quantity) || '1'
  const unit = normalizeText(form.unit)
  const expirationDateText = normalizeText(form.expirationDate) || '未设置'
  const notesText = normalizeText(form.notes)
  const statusMeta = getDetailStatusMeta(form, statusOptions, statusIndex)
  return {
    detailNameText: normalizeText(form.name) || '未命名库存',
    detailCategoryText: normalizeText(form.category) || '未设置',
    detailLocationText: normalizeText(form.location) || '未设置',
    detailStatusText: statusMeta.label,
    detailStatusClass: statusMeta.className,
    detailQuantityText: unit ? `${quantity} ${unit}` : quantity,
    detailProductionDateText: normalizeText(form.productionDate) || '未设置',
    detailShelfLifeText: normalizeText(form.shelfLifeMonths) ? `${normalizeText(form.shelfLifeMonths)} 个月` : '未设置',
    detailExpirationDateText: expirationDateText,
    detailHeroExpirationText: expirationDateText === '未设置' ? '未设到期' : `到期 ${expirationDateText}`,
    detailOpenedDateText: normalizeText(form.openedDate) || '未设置',
    detailHasNotes: Boolean(notesText),
    detailNotesText: notesText,
    detailNotesDisplayText: notesText || '暂无备注'
  }
}

function findPreviousPageByRoute(route = '') {
  if (typeof getCurrentPages !== 'function') {
    return null
  }

  const pages = getCurrentPages()
  if (!Array.isArray(pages) || pages.length < 2) {
    return null
  }

  for (let index = pages.length - 2; index >= 0; index -= 1) {
    const page = pages[index] || null
    if (!page) {
      continue
    }
    if ((page.route || '') === route) {
      return page
    }
  }

  return null
}

function markPantryPageForRefresh() {
  const pantryPage = findPreviousPageByRoute('pages/pantry/index')
  if (!pantryPage || typeof pantryPage.markNeedsRefreshOnNextShow !== 'function') {
    return false
  }

  pantryPage.markNeedsRefreshOnNextShow()
  return true
}

Page({
  data: {
    themeKey: 'default',
    themeStyle: '',
    loading: true,
    submitting: false,
    deleting: false,
    isEdit: false,
    loadErrorMessage: '',
    pantryItemId: '',
    activeSpaceId: '',
    today: getTodayDate(),
    notesCount: '0',
    submitButtonLabel: '添加库存',
    loadingTitle: '正在准备库存表单...',
    categoryOptions: ['未设置'],
    locationOptions: ['未设置'],
    statusOptions: STATUS_OPTIONS.map((item) => item.label),
    showUnitSelector: false,
    unitDraft: '',
    unitOptionItems: buildUnitOptionItems(''),
    categoryIndex: 0,
    locationIndex: 0,
    statusIndex: 0,
    showEditModal: false,
    editForm: createEmptyPantryForm(),
    detailCategoryText: '未设置',
    detailLocationText: '未设置',
    detailStatusText: STATUS_OPTIONS[0].label,
    detailNameText: '未命名库存',
    detailQuantityText: '1',
    detailProductionDateText: '未设置',
    detailShelfLifeText: '未设置',
    detailExpirationDateText: '未设置',
    detailHeroExpirationText: '未设到期',
    detailOpenedDateText: '未设置',
    detailHasNotes: false,
    detailNotesText: '',
    detailNotesDisplayText: '暂无备注',
    form: createEmptyPantryForm()
  },

  async onLoad(options) {
    syncPageTheme(this)
    const pantryItemId = options && options.pantryItemId ? options.pantryItemId : ''
    const activeSpaceId = getActiveSpaceId()

    this.setData({
      pantryItemId,
      isEdit: Boolean(pantryItemId),
      activeSpaceId,
      loadErrorMessage: '',
      ...buildPageCopy(Boolean(pantryItemId))
    })

    if (!activeSpaceId) {
      this.setData({ loading: false })
      return
    }
    await this.bootstrapEditor(activeSpaceId, pantryItemId)
  },

  async bootstrapEditor(spaceId, pantryItemId) {
    this.setData({
      loading: true,
      loadErrorMessage: ''
    })

    try {
      const service = createPantryService()
      const [categoryResult, locationResult, itemResult] = await Promise.all([
        service.listPantryCategories(spaceId),
        service.listPantryLocations(spaceId),
        pantryItemId
          ? service.getPantryItem(spaceId, pantryItemId)
          : Promise.resolve({ item: createEmptyPantryForm() })
      ])
      const matched = itemResult.item || {}
      const form = {
        name: matched.name || '',
        category: matched.category || '',
        quantity: matched.quantity || '1',
        unit: matched.unit || '',
        location: matched.location || '',
        productionDate: matched.productionDate || '',
        shelfLifeMonths: matched.shelfLifeMonths || '',
        openedDate: matched.openedDate || '',
        status: matched.storedStatus || matched.status || 'active',
        actualStatus: matched.status || matched.storedStatus || 'active',
        expirationDate: matched.expirationDate || '',
        notes: matched.notes || ''
      }
      const categoryOptions = buildManagerOptionLabels(categoryResult.items || [], form.category)
      const locationOptions = buildManagerOptionLabels(locationResult.items || [], form.location)

      this.setData({
        loading: false,
        loadErrorMessage: '',
        notesCount: buildNotesCount(form),
        categoryOptions,
        locationOptions,
        categoryIndex: getPickerIndex(categoryOptions, form.category),
        locationIndex: getPickerIndex(locationOptions, form.location),
        showUnitSelector: false,
        unitDraft: normalizeText(form.unit),
        unitOptionItems: buildUnitOptionItems(form.unit),
        statusIndex: getStatusIndex(form.status),
        showEditModal: false,
        editForm: createEmptyPantryForm(),
        ...buildDetailViewData(form, this.data.statusOptions, getStatusIndex(form.status)),
        form
      })
    } catch (error) {
      this.setData({
        loading: false,
      loadErrorMessage: getErrorMessage(error),
      form: createEmptyPantryForm()
    })
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    const nextValue = event.detail.value
    const nextForm = {
      ...this.data.form,
      [field]: nextValue
    }
    this.setData({
      [`form.${field}`]: nextValue,
      unitDraft: field === 'unit' ? normalizeText(nextValue) : this.data.unitDraft,
      unitOptionItems: field === 'unit' ? buildUnitOptionItems(nextValue) : this.data.unitOptionItems,
      notesCount: buildNotesCount(nextForm)
    })
  },

  handleCategorySelect(event) {
    const nextIndex = Number(event.detail.value)
    const nextForm = {
      ...this.data.form,
      category: getPickerValue(this.data.categoryOptions, nextIndex)
    }
    this.setData({
      categoryIndex: nextIndex,
      form: nextForm,
      notesCount: buildNotesCount(nextForm)
    })
  },

  clearCategory() {
    const nextForm = {
      ...this.data.form,
      category: ''
    }
    this.setData({
      form: nextForm,
      ...buildPickerUpdates(this.data.categoryOptions, '', 'categoryIndex')
    })
  },

  handleLocationSelect(event) {
    const nextIndex = Number(event.detail.value)
    const nextForm = {
      ...this.data.form,
      location: getPickerValue(this.data.locationOptions, nextIndex)
    }
    this.setData({
      locationIndex: nextIndex,
      form: nextForm,
      notesCount: buildNotesCount(nextForm)
    })
  },

  clearLocation() {
    const nextForm = {
      ...this.data.form,
      location: ''
    }
    this.setData({
      form: nextForm,
      ...buildPickerUpdates(this.data.locationOptions, '', 'locationIndex')
    })
  },

  openUnitSelector() {
    this.setData({
      showUnitSelector: true,
      unitDraft: normalizeText(this.data.form.unit),
      unitOptionItems: buildUnitOptionItems(this.data.form.unit)
    })
  },

  closeUnitSelector() {
    this.setData({
      showUnitSelector: false,
      unitDraft: normalizeText(this.data.form.unit),
      unitOptionItems: buildUnitOptionItems(this.data.form.unit)
    })
  },

  handleUnitDraftInput(event) {
    const value = event && event.detail ? event.detail.value : ''
    this.setData({
      unitDraft: value,
      unitOptionItems: buildUnitOptionItems(value)
    })
  },

  handleUnitOptionTap(event) {
    const unit = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.unit || ''
      : ''
    const nextForm = {
      ...this.data.form,
      unit
    }
    this.setData({
      showUnitSelector: false,
      form: nextForm,
      unitDraft: normalizeText(unit),
      unitOptionItems: buildUnitOptionItems(unit)
    })
  },

  confirmUnitSelector() {
    const nextUnit = normalizeText(this.data.unitDraft)
    this.setData({
      showUnitSelector: false,
      form: {
        ...this.data.form,
        unit: nextUnit
      },
      unitDraft: nextUnit,
      unitOptionItems: buildUnitOptionItems(nextUnit)
    })
  },

  clearUnit() {
    this.setData({
      showUnitSelector: false,
      form: {
        ...this.data.form,
        unit: ''
      },
      unitDraft: '',
      unitOptionItems: buildUnitOptionItems('')
    })
  },

  handleUsageStatusSelect(event) {
    const nextIndex = Number(event.detail.value)
    const nextStatus = STATUS_OPTIONS[nextIndex] ? STATUS_OPTIONS[nextIndex].value : 'active'
    const nextForm = {
      ...this.data.form,
      status: nextStatus
    }
    this.setData({
      statusIndex: nextIndex,
      form: nextForm
    })
  },

  adjustStepperField(field, delta, minimum = 0, emptyWhenZero = false) {
    const usesDecimalStep = field === 'quantity'
    const current = usesDecimalStep
      ? normalizeDecimalStepperValue(this.data.form[field], minimum, minimum, 1)
      : normalizeStepperValue(this.data.form[field], minimum, minimum)
    const nextValue = Math.max(minimum, current + delta)
    const normalizedValue = emptyWhenZero && nextValue === 0
      ? ''
      : usesDecimalStep
        ? formatStepperValue(nextValue, 1)
        : String(nextValue)
    let nextForm = {
      ...this.data.form,
      [field]: normalizedValue
    }
    if (field === 'shelfLifeMonths') {
      nextForm = {
        ...nextForm,
        expirationDate: resolveExpirationDate(nextForm)
      }
    }
    this.setData({
      form: nextForm
    })
  },

  decrementQuantity() {
    this.adjustStepperField('quantity', -0.5, 0.5, false)
  },

  incrementQuantity() {
    this.adjustStepperField('quantity', 0.5, 0.5, false)
  },

  decrementShelfLifeMonths() {
    this.adjustStepperField('shelfLifeMonths', -1, 0, true)
  },

  incrementShelfLifeMonths() {
    this.adjustStepperField('shelfLifeMonths', 1, 0, true)
  },

  handleProductionDateChange(event) {
    const nextForm = {
      ...this.data.form,
      productionDate: event.detail.value
    }
    this.setData({
      form: {
        ...nextForm,
        expirationDate: resolveExpirationDate(nextForm)
      }
    })
  },

  handleExpirationDateChange(event) {
    const nextForm = {
      ...this.data.form,
      expirationDate: event.detail.value
    }
    this.setData({
      form: nextForm
    })
  },

  clearExpirationDate() {
    const nextForm = {
      ...this.data.form,
      expirationDate: ''
    }
    this.setData({
      form: nextForm
    })
  },

  handleOpenedDateChange(event) {
    const nextForm = {
      ...this.data.form,
      openedDate: event.detail.value
    }
    this.setData({
      form: nextForm
    })
  },

  clearOpenedDate() {
    const nextForm = {
      ...this.data.form,
      openedDate: ''
    }
    this.setData({
      form: nextForm
    })
  },

  openEditModal() {
    if (!this.data.isEdit || this.data.loading || this.data.loadErrorMessage) {
      return
    }

    this.setData({
      showEditModal: true,
      editForm: {
        ...createEmptyPantryForm(),
        ...this.data.form
      }
    })
  },

  closeEditModal() {
    this.setData({
      showEditModal: false
    })
  },

  handleEditFormChange(event) {
    this.setData({
      editForm: event && event.detail && event.detail.form
        ? event.detail.form
        : createEmptyPantryForm()
    })
  },

  async submitEditModal(event) {
    if (
      !this.data.isEdit ||
      this.data.submitting ||
      !this.data.activeSpaceId ||
      this.data.loading ||
      this.data.loadErrorMessage
    ) {
      return
    }

    const nextForm = event && event.detail && event.detail.form
      ? event.detail.form
      : this.data.editForm

    this.setData({ submitting: true })

    try {
      const result = await createPantryService().updatePantryItem(
        this.data.activeSpaceId,
        this.data.pantryItemId,
        nextForm
      )
      const form = {
        ...createEmptyPantryForm(),
        ...(result.item || nextForm),
        status: (result.item && (result.item.storedStatus || result.item.status)) || nextForm.status || 'active',
        actualStatus: (result.item && (result.item.status || result.item.storedStatus)) || nextForm.status || 'active'
      }
      const categoryOptions = buildManagerOptionLabels(this.data.categoryOptions || [], form.category)
      const locationOptions = buildManagerOptionLabels(this.data.locationOptions || [], form.location)
      const statusIndex = getStatusIndex(form.status)

      this.setData({
        submitting: false,
        showEditModal: false,
        notesCount: buildNotesCount(form),
        categoryOptions,
        locationOptions,
        categoryIndex: getPickerIndex(categoryOptions, form.category),
        locationIndex: getPickerIndex(locationOptions, form.location),
        statusIndex,
        editForm: createEmptyPantryForm(),
        ...buildDetailViewData(form, this.data.statusOptions, statusIndex),
        form
      })
      markPantryPageForRefresh()
      wx.showToast({
        title: '已更新库存',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
      this.setData({ submitting: false })
    }
  },

  async submit() {
    if (
      this.data.submitting ||
      !this.data.activeSpaceId ||
      this.data.loading ||
      (this.data.isEdit && this.data.loadErrorMessage)
    ) {
      return
    }

    this.setData({ submitting: true })

    try {
      const service = createPantryService()
      if (this.data.isEdit) {
        await service.updatePantryItem(
          this.data.activeSpaceId,
          this.data.pantryItemId,
          this.data.form
        )
      } else {
        await service.createPantryItem(this.data.activeSpaceId, this.data.form)
      }
      markPantryPageForRefresh()

      wx.showToast({
        title: this.data.isEdit ? '已更新库存' : '已添加库存',
        icon: 'success'
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  async removeItem() {
    if (
      !this.data.isEdit ||
      this.data.deleting ||
      this.data.loading ||
      this.data.loadErrorMessage
    ) {
      return
    }

    const modalResult = await wx.showModal({
      title: '移出库存',
      content: '确认删除这个库存项吗？',
      confirmColor: '#b44343'
    })
    if (!modalResult.confirm) {
      return
    }

    this.setData({ deleting: true })

    try {
      await createPantryService().deletePantryItem(
        this.data.activeSpaceId,
        this.data.pantryItemId
      )
      markPantryPageForRefresh()
      wx.showToast({
        title: '已移出库存',
        icon: 'success'
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({ deleting: false })
    }
  },

  goBack() {
    wx.navigateBack()
  }
})
