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
    expect(template).toContain('计划生成')
    expect(template).toContain('生成计划项')
    expect(template).toContain('toggleShoppingListItems')
    expect(template).toMatch(/shopping-list-card__subhead[\s\S]*bindtap="toggleShoppingListItems"/)
    expect(template).toContain('handleListItemDraftCategoryChange')
    expect(template).toContain('listItemCategoryOptions')
    expect(template).toContain('showListModal')
    expect(template).toContain('showPantryEntryModal')
    expect(template).toContain('pantry-form-modal')
    expect(template).toContain('submit-label="保存"')
    expect(template).toContain('bindtap="openCreateListModal"')
    expect(template.includes('从计划生成')).toBe(false)
    expect(template.includes('保存并勾选')).toBe(false)
  })

  it('keeps enough bottom padding so shopping content is not covered by the tab bar', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-page\s*\{[\s\S]*padding:\s*20rpx 16rpx calc\(env\(safe-area-inset-bottom\) \+ 12\d?rpx\);/)
  })

  it('uses theme variables across the shopping page instead of fixed page colors', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toContain('var(--page-bg')
    expect(styles).toContain('var(--surface-bg')
    expect(styles).toContain('var(--surface-muted')
    expect(styles).toContain('var(--brand')
    expect(styles).toContain('var(--brand-strong')
    expect(styles).toContain('var(--text-primary')
    expect(styles).toContain('var(--text-secondary')
    expect(styles).toContain('var(--danger')
    expect(styles).toContain('var(--success')
    expect(styles).toContain('var(--border-soft')
  })
})
