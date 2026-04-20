function createEmptyPantryForm() {
  return {
    name: '',
    category: '',
    quantity: '1',
    unit: '',
    location: '',
    productionDate: '',
    shelfLifeMonths: '',
    openedDate: '',
    status: 'active',
    handledType: '',
    handledAt: '',
    expirationDate: '',
    notes: ''
  }
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStepperValue(value, minimum = 0, fallback = 0) {
  const parsed = Number(normalizeText(value))
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.max(minimum, Math.floor(parsed))
}

function addMonthsToIsoDate(date, monthsText) {
  const source = normalizeText(date)
  const months = normalizeStepperValue(monthsText, 0, 0)
  if (!source || !months) {
    return ''
  }

  const [yearText, monthText, dayText] = source.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const day = Number(dayText)
  const nextMonthIndex = monthIndex + months
  const targetYear = year + Math.floor(nextMonthIndex / 12)
  const normalizedTargetMonthIndex = nextMonthIndex % 12
  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedTargetMonthIndex + 1, 0)).getUTCDate()
  const targetDay = Math.min(day, daysInTargetMonth)

  return [
    String(targetYear).padStart(4, '0'),
    String(normalizedTargetMonthIndex + 1).padStart(2, '0'),
    String(targetDay).padStart(2, '0')
  ].join('-')
}

function resolveExpirationDate(form = {}) {
  const derived = addMonthsToIsoDate(form.productionDate, form.shelfLifeMonths)
  if (derived) {
    return derived
  }
  return normalizeText(form.expirationDate)
}

function buildManagerOptionLabels(items = [], currentValue = '') {
  const labels = ['未设置']
  ;(items || []).forEach((item) => {
    const name = normalizeText(item && item.name ? item.name : item)
    if (name && !labels.includes(name)) {
      labels.push(name)
    }
  })

  const normalizedCurrent = normalizeText(currentValue)
  if (normalizedCurrent && !labels.includes(normalizedCurrent)) {
    labels.push(normalizedCurrent)
  }

  return labels
}

function getPickerIndex(options = [], value = '') {
  const normalizedValue = normalizeText(value)
  if (!normalizedValue) {
    return 0
  }
  const index = (options || []).indexOf(normalizedValue)
  return index >= 0 ? index : 0
}

function getPickerValue(options = [], index = 0) {
  if (!Array.isArray(options) || index <= 0 || index >= options.length) {
    return ''
  }
  return options[index]
}

function buildPickerUpdates(options = [], value = '', indexKey = '') {
  return {
    [indexKey]: getPickerIndex(options, value)
  }
}

module.exports = {
  addMonthsToIsoDate,
  buildManagerOptionLabels,
  buildPickerUpdates,
  createEmptyPantryForm,
  getPickerIndex,
  getPickerValue,
  normalizeStepperValue,
  normalizeText,
  resolveExpirationDate
}
