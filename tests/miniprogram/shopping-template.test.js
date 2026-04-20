import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('shopping page template', () => {
  it('uses the market action panel hero and removes the space-switch action', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')

    expect(template).toContain('MARKET ACTION PANEL')
    expect(template).toContain('采购清单')
    expect(template.includes('切换空间')).toBe(false)
    expect(template.includes('bindtap="openSpace"')).toBe(false)
  })

  it('renders status tabs, shopping list cards, and inline modals', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')

    expect(template).toContain('shopping-status-tabs')
    expect(template).toContain('handleStatusFilterChange')
    expect(template).toContain('statusTabs')
    expect(template).toContain('shopping-list-card')
    expect(template).toContain('录入库存')
    expect(template).toContain('showListModal')
    expect(template).toContain('showPantryEntryModal')
    expect(template).toContain('bindtap="openCreateListModal"')
  })
})
