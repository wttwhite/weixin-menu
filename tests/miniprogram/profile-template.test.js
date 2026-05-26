import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

function getStyleBlock(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))
  return match ? match[0] : ''
}

describe('profile page template', () => {
  it('renders profile hero, space card, grouped actions, and management modals', () => {
    const template = readFileSync('miniprogram/pages/profile/index.wxml', 'utf8')

    expect(template).toContain('profile-page')
    expect(template).toContain('profile-hero')
    expect(template).toContain('profile-hero__title-row')
    expect(template).toContain('profile-hero__edit-trigger')
    expect(template).toContain('profile-hero__edit-icon')
    expect(template).toContain('space-card')
    expect(template).toContain('bindtap="handleEditDisplayName"')
    expect(template).toContain('bindtap="handleRenameSpace"')
    expect(template).toContain('bindtap="openMembers"')
    expect(template).toContain('bindtap="openRecipeCategoryManager"')
    expect(template).toContain('bindtap="openPantryCategoryManager"')
    expect(template).toContain('bindtap="openPantryLocationManager"')
    expect(template).toContain('bindtap="openThemeModal"')
    expect(template).toContain('bindtap="openBackup"')
    expect(template).toContain('bindtap="openStatistics"')
    expect(template.includes('bindtap="handleGenerateRecipeSamples"')).toBe(false)
    expect(template.includes('随机生成 30 个测试菜谱')).toBe(false)
    expect(template).toContain('recipe-category-manager-modal')
    expect(template).toContain('pantry-manager-modal')
    expect(template).toContain('bind:dragstart="handlePantryManagerDragStart"')
    expect(template).toContain('bind:dragmove="handlePantryManagerDragMove"')
    expect(template).toContain('bind:dragend="handlePantryManagerDragEnd"')
    expect(template.includes('class="manager-modal"')).toBe(false)
    expect(template.includes('showManagerModal')).toBe(false)
    expect(template).toContain('theme-modal')
    expect(template).toContain('theme-chip__swatches')
  })

  it('uses grouped management cards and theme chips instead of a dense icon wall', () => {
    const styles = readFileSync('miniprogram/pages/profile/index.wxss', 'utf8')

    expect(styles).toMatch(/\.profile-page\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.profile-page\s*\{[\s\S]*padding:\s*28rpx 24rpx calc\(env\(safe-area-inset-bottom\) \+ 160rpx\);/)
    expect(styles).toMatch(/\.profile-hero__title-row\s*\{[\s\S]*display:\s*flex;/)
    expect(styles).toMatch(/\.profile-hero__title-text\s*\{[\s\S]*word-break:\s*break-all;/)
    expect(styles).toMatch(/\.theme-chip__swatches\s*\{[\s\S]*display:\s*flex;/)
    expect(styles).toMatch(/\.theme-chip__swatch\s*\{[\s\S]*width:\s*22rpx;/)
    expect(styles).toMatch(/\.profile-section\s*\{/)
    expect(styles).toMatch(/\.action-row\s*\{[\s\S]*display:\s*flex;/)
    expect(styles).toMatch(/\.theme-modal\s*\{[\s\S]*align-items:\s*center;/)
    expect(styles).toMatch(/\.theme-modal__panel\s*\{[\s\S]*border-radius:\s*34rpx;/)
    expect(styles).toMatch(/\.theme-chip--active\s*\{/)
    expect(styles.includes('.manager-modal')).toBe(false)
    expect(styles).not.toMatch(/grid-template-columns:\s*repeat\(5,/)
  })

  it('uses a theme-driven airy hero background instead of the old dark block', () => {
    const styles = readFileSync('miniprogram/pages/profile/index.wxss', 'utf8')

    expect(styles).toContain('var(--hero-soft-start')
    expect(styles).toContain('var(--hero-soft-end')
    expect(styles).toContain('var(--hero-soft-text')
    expect(styles).toContain('var(--hero-soft-subtle')
    expect(styles).not.toContain('rgba(35, 49, 39, 0.92)')
    expect(styles).not.toContain('rgba(78, 109, 88, 0.84)')
  })

  it('does not paint a page-level background on profile page', () => {
    const styles = readFileSync('miniprogram/pages/profile/index.wxss', 'utf8')
    const pageStyles = getStyleBlock(styles, '.profile-page')

    expect(pageStyles).not.toMatch(/background:/)
  })
})
