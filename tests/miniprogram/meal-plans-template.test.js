import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('meal-plans page template', () => {
  it('renders hero, month calendar, and inventory check modal structure', () => {
    const template = readFileSync('miniprogram/pages/meal-plans/index.wxml', 'utf8')

    expect(template).toContain('plans-hero')
    expect(template).toContain('calendar-panel')
    expect(template).toContain('calendar-grid')
    expect(template).toContain('bindtap="goPrevMonth"')
    expect(template).toContain('bindtap="goNextMonth"')
    expect(template).toContain('bindtap="goToday"')
    expect(template).toContain('bindtap="openInventoryCheck"')
    expect(template).toContain('inventory-modal')
    expect(template).toContain('generateShoppingList')
  })

  it('uses a full-page layout with calendar cells and modal cards instead of a floating fab list', () => {
    const styles = readFileSync('miniprogram/pages/meal-plans/index.wxss', 'utf8')

    expect(styles).toMatch(/\.meal-plans-page\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.calendar-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(7,/)
    expect(styles).toMatch(/\.calendar-cell--selected\s*\{/)
    expect(styles).toMatch(/\.inventory-modal__summary\s*\{[\s\S]*display:\s*grid;/)
    expect(styles).not.toMatch(/\.fab-add\s*\{[\s\S]*position:\s*fixed;/)
  })
})
