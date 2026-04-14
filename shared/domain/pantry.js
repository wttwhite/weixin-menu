const DEFAULT_EXPIRING_SOON_DAYS = 3
const { isValidIsoDate } = require('../utils/time')
const VALID_USAGE_STATUS = new Set(['normal', 'opened', 'used-up', 'discarded'])

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDate(value) {
  const text = normalizeText(value)
  return isValidIsoDate(text) ? text : ''
}

function normalizeUsageStatus(value, fallback = 'normal') {
  const text = normalizeText(value)
  if (VALID_USAGE_STATUS.has(text)) {
    return text
  }
  return fallback
}

function normalizePositiveIntegerText(value, fallback = '1') {
  const text = normalizeText(value)
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }
  return String(Math.floor(parsed))
}

function normalizeOptionalPositiveIntegerText(value) {
  const text = normalizeText(value)
  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return ''
  }
  return String(Math.floor(parsed))
}

function addMonthsToIsoDate(date, monthsText) {
  const source = normalizeDate(date)
  const months = normalizeOptionalPositiveIntegerText(monthsText)
  if (!source || !months) {
    return ''
  }

  const [yearText, monthText, dayText] = source.split('-')
  const year = Number(yearText)
  const monthIndex = Number(monthText) - 1
  const day = Number(dayText)
  const offsetMonths = Number(months)
  const nextMonthIndex = monthIndex + offsetMonths
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

function resolveExpirationDate(input = {}) {
  const derived = addMonthsToIsoDate(input.productionDate, input.shelfLifeMonths)
  if (derived) {
    return derived
  }
  return normalizeDate(input.expirationDate)
}

function getRelativeDayCount(expirationDate, now) {
  const current = normalizeDate(now)
  const target = normalizeDate(expirationDate)
  if (!current || !target) {
    return null
  }

  const start = new Date(`${current}T00:00:00Z`)
  const end = new Date(`${target}T00:00:00Z`)
  const diff = end.getTime() - start.getTime()
  return Math.round(diff / 86400000)
}

function derivePantryStatus(input = {}) {
  const expirationDate = normalizeDate(input.expirationDate)
  if (!expirationDate) {
    return 'fresh'
  }

  const relativeDays = getRelativeDayCount(expirationDate, input.now)
  if (relativeDays === null) {
    return 'fresh'
  }

  if (relativeDays < 0) {
    return 'expired'
  }

  if (relativeDays <= DEFAULT_EXPIRING_SOON_DAYS) {
    return 'expiring-soon'
  }

  return 'fresh'
}

function normalizePantryItemWrite(input = {}) {
  const name = normalizeText(input.name)
  const category = normalizeText(input.category)
  const quantity = normalizePositiveIntegerText(input.quantity, '1')
  const unit = normalizeText(input.unit)
  const location = normalizeText(input.location)
  const notes = normalizeText(input.notes)
  const productionDate = normalizeDate(input.productionDate)
  const shelfLifeMonths = normalizeOptionalPositiveIntegerText(input.shelfLifeMonths)
  const openedDate = normalizeDate(input.openedDate)
  const expirationDate = resolveExpirationDate({
    productionDate,
    shelfLifeMonths,
    expirationDate: input.expirationDate
  })
  const usageStatus = normalizeUsageStatus(input.usageStatus, 'normal')

  return {
    name,
    category,
    quantity,
    unit,
    location,
    notes,
    productionDate,
    shelfLifeMonths,
    openedDate,
    expirationDate,
    usageStatus,
    status: derivePantryStatus({
      expirationDate,
      now: input.now
    })
  }
}

function matchesPantryFilters(item = {}, filters = {}) {
  const category = normalizeText(filters.category)
  const location = normalizeText(filters.location)
  const status = normalizeText(filters.status)

  if (category && normalizeText(item.category) !== category) {
    return false
  }

  if (location && normalizeText(item.location) !== location) {
    return false
  }

  if (status && normalizeText(item.status) !== status) {
    return false
  }

  return true
}

module.exports = {
  derivePantryStatus,
  matchesPantryFilters,
  normalizePantryItemWrite,
  normalizeUsageStatus
}
