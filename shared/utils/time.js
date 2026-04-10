const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function toIsoDate(input) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError('Invalid date input')
  }

  // Contract: output is always normalized to UTC date boundaries.
  return date.toISOString().slice(0, 10)
}

function isValidIsoDate(isoDate) {
  if (!ISO_DATE_REGEX.test(isoDate)) {
    return false
  }

  const parsed = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  return toIsoDate(parsed) === isoDate
}

function daysBetween(startIsoDate, endIsoDate) {
  if (!isValidIsoDate(startIsoDate) || !isValidIsoDate(endIsoDate)) {
    throw new TypeError('Invalid ISO date input for daysBetween')
  }

  // Contract: both inputs are interpreted as UTC-midnight ISO dates.
  const start = new Date(`${startIsoDate}T00:00:00.000Z`).getTime()
  const end = new Date(`${endIsoDate}T00:00:00.000Z`).getTime()
  return Math.round((end - start) / ONE_DAY_MS)
}

module.exports = {
  toIsoDate,
  isValidIsoDate,
  daysBetween
}
