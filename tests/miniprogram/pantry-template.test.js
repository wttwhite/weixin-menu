import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('pantry page settings modal', () => {
  it('renders a combined settings modal for category and location managers', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    expect(template).toContain('bindtap="openSettingsModal"')
    expect(template).toContain('库存配置')
    expect(template).toContain('分类管理')
    expect(template).toContain('位置管理')
    expect(template).toContain('{{managementStatusText}}')
    expect(template).toContain('{{managementCategoryCountText}}')
    expect(template).toContain('settings-modal__section settings-modal__section--category')
    expect(template).toContain('settings-modal__section settings-modal__section--location')
    expect(template).toContain('settings-modal__empty')
    expect(template).toContain('settings-modal__empty-illustration')
    expect(template).toContain('catchtouchstart="handleManagerDragStart"')
    expect(template).toContain('catchtouchmove="handleManagerDragMove"')
    expect(template).toContain('catchtouchend="handleManagerDragEnd"')
    expect(template).toContain('class="{{item.itemClass}}"')
    expect(template).toContain('class="{{item.dragClass}}"')
    expect(template.includes('action-pill--space')).toBe(false)
    expect(template.includes('bindtap="openManagementMenu"')).toBe(false)
  })

  it('places usage status next to the pantry name and only renders freshness badge when needed', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    expect(template).toMatch(/pantry-item__header[\s\S]*pantry-item__name[\s\S]*usageStatusLabel/)
    expect(template).toContain('wx:if="{{item.showStatusBadge}}"')
    expect(template).toContain('{{item.usageActionIcon}}')
    expect(template).toContain('{{item.deleteActionIcon}}')
    expect(template.includes('rail-item__count')).toBe(false)
    expect(template.includes('search-card__hint')).toBe(false)
  })

  it('prevents outer page scroll and constrains left/right panels to scroll internally', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    // page element fills available viewport below nav bar — NOT 100vh
    expect(styles).toMatch(/page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).not.toMatch(/\.pantry-page\s*\{[\s\S]*height:\s*100vh;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*overflow:\s*hidden;/)

    // channel-layout is a flex row that fills remaining space
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*overflow:\s*hidden;/)

    // left rail: flex column with internal scroll-view
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(template).toMatch(/channel-rail__scroll[\s\S]*scroll-y/)

    // right surface: flex column with internal scroll-view
    expect(styles).toMatch(/\.channel-surface\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(template).toMatch(/channel-surface__scroll[\s\S]*scroll-y/)
  })

  it('allocates two-thirds of the settings modal to categories and one-third to locations', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')

    expect(styles).toMatch(/page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*padding:\s*14rpx 18rpx calc\(env\(safe-area-inset-bottom\) \+ 16rpx\);/)
    expect(styles).toMatch(/\.settings-modal__content\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.settings-modal__section--category\s*\{[\s\S]*flex:\s*2;/)
    expect(styles).toMatch(/\.settings-modal__section--location\s*\{[\s\S]*flex:\s*1;[\s\S]*min-height:\s*70rpx;/)
    expect(styles).toMatch(/\.settings-modal__confirm\s*\{[\s\S]*width:\s*92rpx;/)
    expect(styles).toMatch(/\.settings-modal__confirm\s*\{[\s\S]*max-width:\s*92rpx;/)
    expect(styles).toMatch(/\.settings-modal__confirm\s*\{[\s\S]*flex:\s*none;/)
    expect(styles).toMatch(/\.settings-modal__confirm\s*\{[\s\S]*font-size:\s*30rpx;/)
    expect(styles).toMatch(/\.settings-modal__confirm\s*\{[\s\S]*padding:\s*0;/)
    expect(styles).toMatch(/\.settings-modal__section--location\s+\.settings-modal__empty-illustration\s*\{[\s\S]*width:\s*7\d?rpx;/)
    expect(styles).toMatch(/\.settings-modal__section--location\s+\.settings-modal__empty-illustration\s*\{[\s\S]*height:\s*7\d?rpx;/)
    expect(styles).toMatch(/\.settings-modal__item\s*\{[\s\S]*transition:\s*transform/)
    expect(styles).toMatch(/\.settings-modal__item--dragging\s*\{/)
    expect(styles).toMatch(/\.pantry-item__actions\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.pantry-item__actions\s*\{[\s\S]*min-width:\s*0;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.channel-surface\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*align-items:\s*stretch;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.channel-surface\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*height:\s*auto;/)
    expect(styles).toMatch(/\.item-action\s*\{[\s\S]*width:\s*56rpx;/)
  })
})
