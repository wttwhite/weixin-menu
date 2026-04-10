const DEFAULT_EXPIRING_SOON_DAYS = 3
const { isValidIsoDate } = require('../utils/time')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDate(value) {
  const text = normalizeText(value)
  return isValidIsoDate(text) ? text : ''
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
  const quantity = normalizeText(input.quantity) || '1'
  const unit = normalizeText(input.unit)
  const location = normalizeText(input.location)
  const notes = normalizeText(input.notes)
  const expirationDate = normalizeDate(input.expirationDate)

  return {
    name,
    category,
    quantity,
    unit,
    location,
    notes,
    expirationDate,
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
  normalizePantryItemWrite
}
