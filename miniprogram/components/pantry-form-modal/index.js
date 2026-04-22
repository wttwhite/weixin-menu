const {
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
    statusOptions: STATUS_OPTIONS.map((item) => item.label),
    statusIndex: 0,
    notesCount: '0'
  },

  observers: {
    'visible, value, categoryOptions, locationOptions': function (visible, value, categoryOptions, locationOptions) {
      if (!visible) {
        return
      }

      const form = cloneForm(value)
      this.setData({
        today: getTodayDate(),
        form,
        categoryIndex: getPickerIndex(categoryOptions || [], form.category),
        locationIndex: getPickerIndex(locationOptions || [], form.location),
        statusIndex: getStatusIndex(form.status),
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
      this.setData({
        form: nextForm,
        notesCount: buildNotesCount(nextForm),
        categoryIndex: getPickerIndex(this.data.categoryOptions || [], nextForm.category),
        locationIndex: getPickerIndex(this.data.locationOptions || [], nextForm.location),
        statusIndex: getStatusIndex(nextForm.status)
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

    handleCategorySelect(event) {
      const nextIndex = Number(event.detail.value)
      this.updateForm({
        ...this.data.form,
        category: getPickerValue(this.data.categoryOptions || [], nextIndex)
      })
    },

    clearCategory() {
      this.updateForm({
        ...this.data.form,
        category: ''
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
      const nextIndex = Number(event.detail.value)
      const nextStatus = STATUS_OPTIONS[nextIndex] ? STATUS_OPTIONS[nextIndex].value : 'active'
      this.updateForm({
        ...this.data.form,
        status: nextStatus
      })
    },

    adjustStepperField(field, delta, minimum = 0, emptyWhenZero = false) {
      const current = normalizeStepperValue(this.data.form[field], minimum, minimum)
      const nextValue = Math.max(minimum, current + delta)
      const normalizedValue = emptyWhenZero && nextValue === 0 ? '' : String(nextValue)
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
