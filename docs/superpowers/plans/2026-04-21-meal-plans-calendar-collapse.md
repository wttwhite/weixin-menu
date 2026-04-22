# Meal Plans Calendar Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the meal-plans calendar default to a single selected week, expand to the full month on demand, and animate the transition smoothly.

**Architecture:** Extract pure calendar helpers for month-grid generation, adjacent-month fillers, and collapsed/expanded presentation math. Keep `pages/meal-plans/index` as the orchestrator that derives page state from helper output, then update the WXML/WXSS to use a viewport-based animation instead of swapping separate week/month DOM trees.

**Tech Stack:** WeChat mini program page files, CommonJS helper module, Vitest

---

## File Structure

- Create: `miniprogram/pages/meal-plans/calendar.js`
- Modify: `miniprogram/pages/meal-plans/index.js`
- Modify: `miniprogram/pages/meal-plans/index.wxml`
- Modify: `miniprogram/pages/meal-plans/index.wxss`
- Create: `tests/miniprogram/meal-plans-calendar.test.js`
- Modify: `tests/miniprogram/meal-plan-page-flow.test.js`
- Modify: `tests/miniprogram/meal-plans-template.test.js`

### Task 1: Add Failing Calendar Helper Tests

**Files:**
- Create: `tests/miniprogram/meal-plans-calendar.test.js`
- Create: `miniprogram/pages/meal-plans/calendar.js`

- [ ] **Step 1: Write failing helper tests for cross-month fillers and collapsed presentation math**

```js
expect(buildCalendarItems('2026-04', '2026-04-21', '2026-04-21', {})).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ date: '2026-03-29', isOutsideMonth: true }),
    expect.objectContaining({ date: '2026-05-09', isOutsideMonth: true })
  ])
)

expect(buildCalendarPresentation(calendarItems, '2026-04-21', false)).toEqual(
  expect.objectContaining({
    rowCount: 6,
    rowIndex: 3,
    visibleRowCount: 1
  })
)
```

- [ ] **Step 2: Run the new helper test to verify failure**

Run: `npx vitest run tests/miniprogram/meal-plans-calendar.test.js`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Implement the minimal calendar helper module**

Create `miniprogram/pages/meal-plans/calendar.js` with pure helpers for:

- month parsing and month shifting
- full month grid generation with previous/next month filler days
- collapsed/expanded row calculations

- [ ] **Step 4: Re-run the helper test to verify pass**

Run: `npx vitest run tests/miniprogram/meal-plans-calendar.test.js`
Expected: PASS

### Task 2: Add Failing Page Flow And Template Tests

**Files:**
- Modify: `tests/miniprogram/meal-plan-page-flow.test.js`
- Modify: `tests/miniprogram/meal-plans-template.test.js`

- [ ] **Step 1: Write failing assertions for default collapsed state and toggle affordance**

Add checks that:

- `page.data.isCalendarExpanded` defaults to `false`
- collapsed state exposes one visible row and a non-zero row offset when the selection is in later weeks
- `toggleCalendarExpanded()` switches the page to expanded state
- template includes `calendar-panel__viewport`
- template includes `bindtap="toggleCalendarExpanded"`
- styles include transitions for the viewport and toggle icon

- [ ] **Step 2: Run the page/template tests to verify failure**

Run: `npx vitest run tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js`
Expected: FAIL because the page does not yet expose the new state or markup.

- [ ] **Step 3: Implement the minimal page state wiring**

Update `miniprogram/pages/meal-plans/index.js` so `syncCalendarView()` uses the helper module and writes:

- `isCalendarExpanded`
- `calendarRowCount`
- `calendarViewportStyle`
- `calendarGridStyle`

Also add `toggleCalendarExpanded()` and cross-month date selection handling.

- [ ] **Step 4: Update WXML and WXSS for the viewport-based transition**

Render the new viewport wrapper, footer toggle, rotated arrow, and outside-month day styling.

- [ ] **Step 5: Re-run the page/template tests to verify pass**

Run: `npx vitest run tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js`
Expected: PASS

### Task 3: Run Final Verification

**Files:**
- Modify: `miniprogram/pages/meal-plans/calendar.js`
- Modify: `miniprogram/pages/meal-plans/index.js`
- Modify: `miniprogram/pages/meal-plans/index.wxml`
- Modify: `miniprogram/pages/meal-plans/index.wxss`
- Modify: `tests/miniprogram/meal-plan-page-flow.test.js`
- Modify: `tests/miniprogram/meal-plans-template.test.js`
- Modify: `tests/miniprogram/meal-plans-calendar.test.js`

- [ ] **Step 1: Run the focused meal-plans tests**

Run: `npx vitest run tests/miniprogram/meal-plans-calendar.test.js tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js`
Expected: PASS

- [ ] **Step 2: Run the full Vitest suite**

Run: `npx vitest run`
Expected: PASS
