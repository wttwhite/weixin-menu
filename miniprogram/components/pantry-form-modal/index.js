const {
  buildUnitOptionItems,
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

const STATUS_DISPLAY_LABELS = {
  active: '正常',
  opened: '已开封',
  expiring: '即将过期',
  expired: '已过期',
  empty: '已用完',
  discarded: '已丢弃'
}

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function cloneForm(value = {}) {
  return {
    ...createEmptyPantryForm(),
    ...(value || {})
  }
}

function buildNotesCount(form = {}) {
  return String((form.notes || '').length)
}

function getStatusIndex(value = 'active') {
  const index = STATUS_OPTIONS.findIndex((item) => item.value === normalizeText(value))
  return index >= 0 ? index : 0
}

function getStatusDisplayText(form = {}, statusIndex = 0) {
  const actualStatus = normalizeText(form.actualStatus)
  if (STATUS_DISPLAY_LABELS[actualStatus]) {
    return STATUS_DISPLAY_LABELS[actualStatus]
  }

  const storedStatus = normalizeText(form.status)
  if (STATUS_DISPLAY_LABELS[storedStatus]) {
    return STATUS_DISPLAY_LABELS[storedStatus]
  }

  return STATUS_OPTIONS[statusIndex] ? STATUS_OPTIONS[statusIndex].label : STATUS_OPTIONS[0].label
}

function buildCategorySelectorItems(categoryOptions = [], selectedCategoryIndex = 0) {
  return (categoryOptions || [])
    .map((label, index) => ({
      index,
      label,
      disabled: index === 0,
      itemClass:
        index === selectedCategoryIndex
          ? 'category-selector__item category-selector__item--active'
          : 'category-selector__item'
    }))
    .filter((item) => !item.disabled)
}

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: '添加库存'
    },
    submitLabel: {
      type: String,
      value: '添加库存'
    },
    submitting: {
      type: Boolean,
      value: false
    },
    statusReadonly: {
      type: Boolean,
      value: false
    },
    value: {
      type: Object,
      value: {}
    },
    categoryOptions: {
      type: Array,
      value: ['未设置']
    },
    locationOptions: {
      type: Array,
      value: ['未设置']
    }
  },

  data: {
    today: getTodayDate(),
    form: createEmptyPantryForm(),
    categoryIndex: 0,
    locationIndex: 0,
    showCategorySelector: false,
    categorySelectorItems: [],
    showUnitSelector: false,
    unitDraft: '',
    unitOptionItems: buildUnitOptionItems(''),
    statusOptions: STATUS_OPTIONS.map((item) => item.label),
    statusIndex: 0,
    statusDisplayText: STATUS_OPTIONS[0].label,
    notesCount: '0'
  },

  observers: {
    'visible, value, categoryOptions, locationOptions': function (visible, value, categoryOptions, locationOptions) {
      if (!visible) {
        return
      }

      const form = cloneForm(value)
      const categoryIndex = getPickerIndex(categoryOptions || [], form.category)
      const statusIndex = getStatusIndex(form.status)
      this.setData({
        today: getTodayDate(),
        form,
        categoryIndex,
        locationIndex: getPickerIndex(locationOptions || [], form.location),
        showCategorySelector: false,
        categorySelectorItems: buildCategorySelectorItems(categoryOptions || [], categoryIndex),
        showUnitSelector: false,
        unitDraft: normalizeText(form.unit),
        unitOptionItems: buildUnitOptionItems(form.unit),
        statusIndex,
        statusDisplayText: getStatusDisplayText(form, statusIndex),
        notesCount: buildNotesCount(form)
      })
    }
  },

  methods: {
    noop() {},

    emitFormChange(nextForm = {}) {
      this.triggerEvent('change', {
        form: nextForm
      })
    },

    updateForm(nextForm = {}) {
      const categoryIndex = getPickerIndex(this.data.categoryOptions || [], nextForm.category)
      const statusIndex = getStatusIndex(nextForm.status)
      this.setData({
        form: nextForm,
        notesCount: buildNotesCount(nextForm),
        categoryIndex,
        locationIndex: getPickerIndex(this.data.locationOptions || [], nextForm.location),
        categorySelectorItems: buildCategorySelectorItems(this.data.categoryOptions || [], categoryIndex),
        unitDraft: normalizeText(nextForm.unit),
        unitOptionItems: buildUnitOptionItems(nextForm.unit),
        statusIndex,
        statusDisplayText: getStatusDisplayText(nextForm, statusIndex)
      })
      this.emitFormChange(nextForm)
    },

    handleInput(event) {
      const field = event && event.currentTarget && event.currentTarget.dataset
        ? event.currentTarget.dataset.field || ''
        : ''
      if (!field) {
        return
      }

      const nextValue = event.detail.value
      const nextForm = {
        ...this.data.form,
        [field]: nextValue
      }

      if (field === 'shelfLifeMonths') {
        nextForm.expirationDate = resolveExpirationDate(nextForm)
      }

      this.updateForm(nextForm)
    },

    openCategorySelector() {
      if (!Array.isArray(this.data.categoryOptions) || this.data.categoryOptions.length <= 1) {
        return
      }

      this.setData({
        showCategorySelector: true,
        categorySelectorItems: buildCategorySelectorItems(
          this.data.categoryOptions || [],
          this.data.categoryIndex
        )
      })
    },

    closeCategorySelector() {
      this.setData({
        showCategorySelector: false
      })
    },

    handleCategoryOptionTap(event) {
      const name = event && event.currentTarget && event.currentTarget.dataset
        ? event.currentTarget.dataset.name || ''
        : ''
      if (!name) {
        return
      }

      this.setData({
        showCategorySelector: false
      })
      this.updateForm({
        ...this.data.form,
        category: name
      })
    },

    clearCategory() {
      this.setData({
        showCategorySelector: false
      })
      this.updateForm({
        ...this.data.form,
        category: ''
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
      this.setData({
        showUnitSelector: false
      })
      this.updateForm({
        ...this.data.form,
        unit
      })
    },

    confirmUnitSelector() {
      this.setData({
        showUnitSelector: false
      })
      this.updateForm({
        ...this.data.form,
        unit: normalizeText(this.data.unitDraft)
      })
    },

    clearUnit() {
      this.setData({
        showUnitSelector: false,
        unitDraft: '',
        unitOptionItems: buildUnitOptionItems('')
      })
      this.updateForm({
        ...this.data.form,
        unit: ''
      })
    },

    handleLocationSelect(event) {
      const nextIndex = Number(event.detail.value)
      this.updateForm({
        ...this.data.form,
        location: getPickerValue(this.data.locationOptions || [], nextIndex)
      })
    },

    clearLocation() {
      this.updateForm({
        ...this.data.form,
        location: ''
      })
    },

    handleUsageStatusSelect(event) {
      if (this.properties.statusReadonly || this.data.statusReadonly) {
        return
      }

      const nextIndex = Number(event.detail.value)
      const nextStatus = STATUS_OPTIONS[nextIndex] ? STATUS_OPTIONS[nextIndex].value : 'active'
      this.updateForm({
        ...this.data.form,
        status: nextStatus
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
      const nextForm = {
        ...this.data.form,
        [field]: normalizedValue
      }

      if (field === 'shelfLifeMonths') {
        nextForm.expirationDate = resolveExpirationDate(nextForm)
      }

      this.updateForm(nextForm)
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

      this.updateForm({
        ...nextForm,
        expirationDate: resolveExpirationDate(nextForm)
      })
    },

    handleExpirationDateChange(event) {
      this.updateForm({
        ...this.data.form,
        expirationDate: event.detail.value
      })
    },

    clearExpirationDate() {
      this.updateForm({
        ...this.data.form,
        expirationDate: ''
      })
    },

    handleOpenedDateChange(event) {
      this.updateForm({
        ...this.data.form,
        openedDate: event.detail.value
      })
    },

    clearOpenedDate() {
      this.updateForm({
        ...this.data.form,
        openedDate: ''
      })
    },

    close() {
      this.triggerEvent('close')
    },

    submit() {
      if (this.data.submitting) {
        return
      }

      if (!normalizeText(this.data.form.name)) {
        wx.showToast({
          title: '请输入库存名称',
          icon: 'none'
        })
        return
      }

      this.triggerEvent('submit', {
        form: this.data.form
      })
    }
  }
})
