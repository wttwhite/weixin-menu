const CALENDAR_ROW_HEIGHT_RPX = 88
const CALENDAR_ROW_GAP_RPX = 10
const CALENDAR_TOTAL_ROWS = 6
const CALENDAR_COLLAPSED_OFFSET_COMPENSATION_RPX = 2

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function buildMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthKey(monthKey = '') {
  const [yearText, monthText] = normalizeText(monthKey).split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const now = new Date()
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1
    }
  }
  return { year, month }
}

function shiftMonthKey(monthKey = '', offset = 0) {
  const { year, month } = parseMonthKey(monthKey)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1))
  return buildMonthKey(next.getUTCFullYear(), next.getUTCMonth() + 1)
}

function formatMonthLabel(monthKey = '') {
  const { year, month } = parseMonthKey(monthKey)
  return `${year}年${month}月`
}

function resolveSelectedDate(monthKey = '', selectedDate = '', todayIso = '', planCounts = {}) {
  const normalizedSelectedDate = normalizeText(selectedDate)
  if (normalizedSelectedDate.startsWith(monthKey)) {
    return normalizedSelectedDate
  }
  if (normalizeText(todayIso).startsWith(monthKey)) {
    return normalizeText(todayIso)
  }

  const plannedDates = Object.keys(planCounts)
    .filter((date) => date.startsWith(monthKey))
    .sort()
  if (plannedDates.length) {
    return plannedDates[0]
  }

  return `${monthKey}-01`
}

function buildCalendarCell(date, label, selectedDate, todayIso, planCounts, isOutsideMonth) {
  const hasPlans = Boolean(planCounts[date])
  const isSelected = date === selectedDate
  const isToday = date === todayIso
  const classes = ['calendar-cell']

  if (hasPlans) {
    classes.push('calendar-cell--has-plans')
  }
  if (isToday) {
    classes.push('calendar-cell--today')
  }
  if (isOutsideMonth) {
    classes.push('calendar-cell--outside-month')
  }
  if (isSelected) {
    classes.push('calendar-cell--selected')
  }

  return {
    key: date,
    date,
    label: String(label),
    isBlank: false,
    isOutsideMonth,
    hasPlans,
    planCount: planCounts[date] || 0,
    showDot: hasPlans && !isOutsideMonth,
    itemClass: classes.join(' '),
    dotClass: isSelected ? 'calendar-cell__dot calendar-cell__dot--selected' : 'calendar-cell__dot'
  }
}

function buildCalendarItems(monthKey = '', selectedDate = '', todayIso = '', planCounts = {}) {
  const { year, month } = parseMonthKey(monthKey)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prevMonthKey = shiftMonthKey(monthKey, -1)
  const prevMonthDays = new Date(Date.UTC(year, month - 1, 0)).getUTCDate()
  const nextMonthKey = shiftMonthKey(monthKey, 1)
  const items = []

  for (let day = prevMonthDays - firstWeekday + 1; day <= prevMonthDays; day += 1) {
    if (firstWeekday === 0) {
      break
    }
    items.push(
      buildCalendarCell(
        `${prevMonthKey}-${String(day).padStart(2, '0')}`,
        day,
        selectedDate,
        todayIso,
        planCounts,
        true
      )
    )
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    items.push(
      buildCalendarCell(
        `${monthKey}-${String(day).padStart(2, '0')}`,
        day,
        selectedDate,
        todayIso,
        planCounts,
        false
      )
    )
  }

  const trailingCount = CALENDAR_TOTAL_ROWS * 7 - items.length
  for (let day = 1; day <= trailingCount; day += 1) {
    items.push(
      buildCalendarCell(
        `${nextMonthKey}-${String(day).padStart(2, '0')}`,
        day,
        selectedDate,
        todayIso,
        planCounts,
        true
      )
    )
  }

  return items
}

function buildCalendarPresentation(items = [], selectedDate = '', isExpanded = false) {
  const rowCount = Math.max(Math.ceil((items || []).length / 7), 1)
  const selectedIndex = Math.max(
    (items || []).findIndex((item) => item.date === selectedDate),
    0
  )
  const rowIndex = Math.floor(selectedIndex / 7)
  const visibleRowCount = isExpanded ? rowCount : 1
  const translateYRpx = isExpanded
    ? 0
    : Math.max(0, rowIndex * (CALENDAR_ROW_HEIGHT_RPX + CALENDAR_ROW_GAP_RPX) - CALENDAR_COLLAPSED_OFFSET_COMPENSATION_RPX)
  const viewportHeightRpx =
    visibleRowCount * CALENDAR_ROW_HEIGHT_RPX + Math.max(visibleRowCount - 1, 0) * CALENDAR_ROW_GAP_RPX

  return {
    rowCount,
    rowIndex,
    visibleRowCount,
    translateYRpx,
    viewportHeightRpx
  }
}

module.exports = {
  CALENDAR_ROW_HEIGHT_RPX,
  CALENDAR_ROW_GAP_RPX,
  CALENDAR_TOTAL_ROWS,
  shiftMonthKey,
  formatMonthLabel,
  resolveSelectedDate,
  buildCalendarItems,
  buildCalendarPresentation
}
