import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

function getStyleBlock(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))
  return match ? match[0] : ''
}

describe('meal-plan edit template', () => {
  it('renders grouped editor cards with searchable recipe selection and fixed footer actions', () => {
    const template = readFileSync('miniprogram/pages/meal-plan-edit/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/meal-plan-edit/index.wxss', 'utf8')

    expect(template).toContain('meal-plan-editor')
    expect(template).toContain('editor-section')
    expect(template).toContain('recipe-search')
    expect(template).toContain('recipe-selector__overlay')
    expect(template).toContain('bindinput="handleRecipeSearchInput"')
    expect(template).toContain('bindtap="openRecipeSelector"')
    expect(template).toContain('bindtap="handleRecipeOptionSelect"')
    expect(template).toContain('bottom-actions')
    expect(template.includes('份数（可覆盖）')).toBe(false)
    expect(template.includes('servingsOverride')).toBe(false)
    expect(template).toContain('catchtouchmove="noop"')
    expect(styles).toMatch(/\.editor-section,\s*\.state-card\s*\{[\s\S]*border-radius:\s*3\d+rpx;/)
    expect(styles).toMatch(/\.bottom-actions\s*\{[\s\S]*position:\s*fixed;/)
  })

  it('uses neutral form frames and pale theme buttons instead of orange surfaces', () => {
    const styles = readFileSync('miniprogram/pages/meal-plan-edit/index.wxss', 'utf8')
    const template = readFileSync('miniprogram/pages/meal-plan-edit/index.wxml', 'utf8')

    expect(styles).not.toContain('rgba(197, 106, 61')
    expect(styles).toMatch(/\.picker-value,\s*\.field-input,\s*\.field-textarea,\s*\.recipe-selector__search-input,\s*\.recipe-search\s*\{[\s\S]*border:\s*1rpx solid var\(--border-soft,/)
    expect(styles).toMatch(/\.recipe-card\s*\{[\s\S]*background:\s*#f7f9fd;/)
    expect(styles).toMatch(/\.section-button--soft\s*\{[\s\S]*--td-button-default-bg-color:\s*var\(--surface-muted,/)
    expect(styles).toMatch(/\.footer-submit-btn\s*\{[\s\S]*--td-button-primary-bg-color:\s*var\(--surface-muted,/)
    expect(template).toContain('recipe-selector__close')
  })

  it('does not paint a page-level background on the editor page', () => {
    const styles = readFileSync('miniprogram/pages/meal-plan-edit/index.wxss', 'utf8')
    const pageStyles = getStyleBlock(styles, '.meal-plan-edit-page')

    expect(pageStyles).not.toMatch(/background:/)
  })
})
