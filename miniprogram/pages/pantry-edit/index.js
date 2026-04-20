const { createPantryService } = require('../../services/pantry')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const {
  buildManagerOptionLabels,
  buildPickerUpdates,
  createEmptyPantryForm,
  getPickerIndex,
  getPickerValue,
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

Page({
  data: {
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
    categoryIndex: 0,
    locationIndex: 0,
    statusIndex: 0,
    form: createEmptyPantryForm()
  },

  async onLoad(options) {
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
        statusIndex: getStatusIndex(form.status),
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
    const current = normalizeStepperValue(this.data.form[field], minimum, minimum)
    const nextValue = Math.max(minimum, current + delta)
    const normalizedValue = emptyWhenZero && nextValue === 0 ? '' : String(nextValue)
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
    this.adjustStepperField('quantity', -1, 1, false)
  },

  incrementQuantity() {
    this.adjustStepperField('quantity', 1, 1, false)
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
