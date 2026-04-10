const ONE_DAY_MS = 24 * 60 * 60 * 1000

function toIsoDate(input) {
  const date = input instanceof Date ? input : new Date(input)
  return date.toISOString().slice(0, 10)
}

function isValidIsoDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false
  }

  const parsed = new Date(`${isoDate}T00:00:00.000Z`)
  return toIsoDate(parsed) === isoDate
}

function daysBetween(startIsoDate, endIsoDate) {
  const start = new Date(`${startIsoDate}T00:00:00.000Z`).getTime()
  const end = new Date(`${endIsoDate}T00:00:00.000Z`).getTime()
  return Math.round((end - start) / ONE_DAY_MS)
}

module.exports = {
  toIsoDate,
  isValidIsoDate,
  daysBetween
}
