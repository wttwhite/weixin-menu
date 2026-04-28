import { describe, expect, it } from 'vitest'

function unwrapModule(moduleNamespace) {
  return moduleNamespace.default || moduleNamespace
}

describe('meal-plans calendar helpers', () => {
  it('builds a fixed six-row month grid with adjacent-month filler dates', async () => {
    const calendar = unwrapModule(await import('../../miniprogram/pages/meal-plans/calendar.js'))
    const items = calendar.buildCalendarItems('2026-04', '2026-04-21', '2026-04-21', {})

    expect(items).toHaveLength(42)
    expect(items.slice(0, 4)).toEqual([
      expect.objectContaining({ date: '2026-03-29', label: '29', isOutsideMonth: true }),
      expect.objectContaining({ date: '2026-03-30', label: '30', isOutsideMonth: true }),
      expect.objectContaining({ date: '2026-03-31', label: '31', isOutsideMonth: true }),
      expect.objectContaining({ date: '2026-04-01', label: '1', isOutsideMonth: false })
    ])
    expect(items[items.length - 1]).toEqual(
      expect.objectContaining({ date: '2026-05-09', label: '9', isOutsideMonth: true })
    )
  })

  it('derives collapsed and expanded presentation state from the selected week row', async () => {
    const calendar = unwrapModule(await import('../../miniprogram/pages/meal-plans/calendar.js'))
    const items = calendar.buildCalendarItems('2026-04', '2026-04-21', '2026-04-21', {})

    expect(calendar.CALENDAR_ROW_GAP_RPX).toBe(10)
    expect(calendar.CALENDAR_COLLAPSED_ROW_CENTER_OFFSET_RPX).toBe(5)
    expect(calendar.buildCalendarPresentation(items, '2026-04-21', false)).toEqual(
      expect.objectContaining({
        rowCount: 6,
        rowIndex: 3,
        visibleRowCount: 1,
        viewportHeightRpx: 98,
        translateYRpx: 289
      })
    )

    expect(calendar.buildCalendarPresentation(items, '2026-04-27', false)).toEqual(
      expect.objectContaining({
        rowIndex: 4,
        viewportHeightRpx: 98,
        translateYRpx: 387
      })
    )

    expect(calendar.buildCalendarPresentation(items, '2026-05-05', false)).toEqual(
      expect.objectContaining({
        rowIndex: 5,
        viewportHeightRpx: 98,
        translateYRpx: 485
      })
    )

    expect(calendar.buildCalendarPresentation(items, '2026-04-21', true)).toEqual(
      expect.objectContaining({
        rowCount: 6,
        rowIndex: 3,
        visibleRowCount: 6,
        viewportHeightRpx: 578,
        translateYRpx: 0
      })
    )
  })
})
