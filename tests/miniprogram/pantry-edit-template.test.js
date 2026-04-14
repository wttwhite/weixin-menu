import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('pantry edit template', () => {
  it('does not block selecting past expiration dates in date picker', () => {
    const template = readFileSync('miniprogram/pages/pantry-edit/index.wxml', 'utf8')
    expect(template.includes('start="{{today}}"')).toBe(false)
  })

  it('uses a sectioned editor layout with fixed bottom actions', () => {
    const template = readFileSync('miniprogram/pages/pantry-edit/index.wxml', 'utf8')

    expect(template).toContain('editor-shell')
    expect(template).toContain('bottom-actions')
    expect(template).toContain('footer-close-button')
    expect(template).toContain('footer-submit-button')
    expect(template).toContain('基本信息')
    expect(template).toContain('库存信息')
    expect(template).toContain('bindchange="handleCategorySelect"')
    expect(template).toContain('bindchange="handleLocationSelect"')
    expect(template).toContain('bindchange="handleUsageStatusSelect"')
    expect(template).toContain('quantity-stepper')
    expect(template).toContain('bindtap="incrementQuantity"')
    expect(template).toContain('bindtap="incrementShelfLifeMonths"')
    expect(template).toContain('bindchange="handleProductionDateChange"')
    expect(template).toContain('bindchange="handleExpirationDateChange"')
    expect(template).toContain('bindchange="handleOpenedDateChange"')
    expect(template).toContain('过期日期')
    expect(template).toContain('bindtap="clearCategory"')
    expect(template).toContain('bindtap="clearLocation"')
    expect(template).toContain('bindtap="clearExpirationDate"')
    expect(template).toContain('bindtap="clearOpenedDate"')
  })

  it('keeps notes textarea and delete action compact instead of full width', () => {
    const styles = readFileSync('miniprogram/pages/pantry-edit/index.wxss', 'utf8')

    expect(styles).toMatch(/\.field-textarea--notes\s*\{[\s\S]*min-height:\s*8\d?rpx;/)
    expect(styles).toMatch(/\.delete-button\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.delete-button\s*\{[\s\S]*align-self:\s*flex-start;/)
    expect(styles).toMatch(/\.edit-page\s*\{[\s\S]*overflow-x:\s*hidden;/)
    expect(styles).toMatch(/\.field-input--inline\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.stepper-button\s*\{[\s\S]*width:\s*4\d?rpx;/)
    expect(styles).toMatch(/\.stepper-button::after\s*\{[\s\S]*border:\s*none;/)
    expect(styles).toMatch(/\.field-picker-row\s*\{[\s\S]*display:\s*flex;/)
    expect(styles).toMatch(/\.field-clear\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.bottom-actions\s*\{[\s\S]*position:\s*fixed;/)
  })
})
