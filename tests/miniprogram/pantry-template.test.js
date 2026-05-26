import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

function getStyleBlock(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`))
  return match ? match[0] : ''
}

describe('pantry page settings modal', () => {
  it('uses a shared pantry manager modal for category-only settings', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    expect(template).toContain('pantry-manager-modal')
    expect(template).toContain('visible="{{showSettingsModal}}"')
    expect(template).toContain('title="食材分类"')
    expect(template).toContain('bind:submit="submitCategoryManagerCreate"')
    expect(template).toContain('bind:rename="renameCategoryManagerItem"')
    expect(template).toContain('bind:delete="deleteCategoryManagerItem"')
    expect(template.includes('submitLocationManagerCreate')).toBe(false)
    expect(template.includes('renameLocationManagerItem')).toBe(false)
    expect(template.includes('deleteLocationManagerItem')).toBe(false)
  })

  it('renders a combined settings modal for category and location managers', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    expect(template).toContain('bindtap="openSettingsModal"')
    expect(template).toContain('pantry-form-modal')
    expect(template).toContain('showCreateModal')
    expect(template).toContain('status-readonly="{{true}}"')
    expect(template).toContain('management-card__search')
    expect(template).toContain('management-card__search-row')
    expect(template).toContain('floating-create-button')
    expect(template).toContain('食材分类')
    expect(template).toContain('{{managementStatusText}}')
    expect(template.includes('{{managementCategoryCountText}}')).toBe(false)
    expect(template.includes('位置管理')).toBe(false)
    expect(template.includes('settings-modal__section')).toBe(false)
    expect(template.includes('settings-modal__empty')).toBe(false)
    expect(template.includes('class="search-card"')).toBe(false)
    expect(template.includes('class="action-pill"')).toBe(false)
    expect(template.includes('catchtouchstart="handleManagerDragStart"')).toBe(false)
    expect(template.includes('action-pill--space')).toBe(false)
    expect(template.includes('bindtap="openManagementMenu"')).toBe(false)
  })

  it('places usage status next to the pantry name and only renders freshness badge when needed', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    expect(template).toContain('/images/pantry-management-hero.svg')
    expect(template.includes('{{managementCoverText}}')).toBe(false)
    expect(template).toMatch(/pantry-item__header[\s\S]*pantry-item__name[\s\S]*usageStatusLabel/)
    expect(template).toContain('wx:if="{{item.showStatusBadge}}"')
    expect(template).toContain('{{item.usageActionIcon}}')
    expect(template).toContain('catchtap="handleEditItem"')
    expect(template).toContain('name="edit-1"')
    expect(template).toContain('title="编辑库存"')
    expect(template).not.toContain('{{item.deleteActionIcon}}')
    expect(template).not.toContain('delete-line-icon')
    expect(template).toContain('rail-item__content')
    expect(template).toContain('rail-item__count')
    expect(template.includes('pantry-item__thumb')).toBe(false)
    expect(template.includes('search-card__hint')).toBe(false)
  })

  it('renders pantry quantity with inline expiration date and requested font sizes', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')

    expect(template).toContain('库存：{{item.quantityDisplay}}')
    expect(template).toContain('class="pantry-item__separator"')
    expect(template).toContain('class="{{item.expirationDateClass}}"')
    expect(template).not.toContain('class="pantry-item__date">{{item.dateLabel}}')
    expect(styles).toMatch(/\.pantry-item__name\s*\{[\s\S]*font-size:\s*32rpx;/)
    expect(styles).toMatch(/\.pantry-item__quantity\s*\{[\s\S]*font-size:\s*26rpx;/)
    expect(styles).toMatch(/\.pantry-item__separator\s*\{[\s\S]*margin:\s*0 8rpx;/)
    expect(styles).toMatch(/\.pantry-item__expiration--soon\s*\{[\s\S]*color:\s*#d6861d;/)
    expect(styles).toMatch(/\.pantry-item__expiration--expired\s*\{[\s\S]*color:\s*#d14b4b;/)
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

  it('disables internal pantry scrolling while the floating create button is being dragged', () => {
    const template = readFileSync('miniprogram/pages/pantry/index.wxml', 'utf8')

    expect(template).toMatch(/channel-rail__scroll[\s\S]*scroll-y="\{\{!floatingCreateScrollLocked\}\}"/)
    expect(template).toMatch(/channel-surface__scroll[\s\S]*scroll-y="\{\{showVisibleItems && !floatingCreateScrollLocked\}\}"/)
  })

  it('widens the category rail and keeps category stats inline without pantry thumbnails', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')

    expect(styles).toMatch(/page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.pantry-page\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.pantry-item__actions\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.pantry-item__actions\s*\{[\s\S]*min-width:\s*0;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.channel-surface\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*align-items:\s*stretch;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*width:\s*17\d?rpx;/)
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*background:\s*rgba\(230,\s*236,\s*244,\s*0\.8\);/)
    expect(styles).toMatch(/\.channel-surface\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*height:\s*auto;/)
    expect(styles).toMatch(/\.rail-item\s*\{[\s\S]*flex-direction:\s*row;/)
    expect(styles).toMatch(/\.rail-item\s*\{[\s\S]*white-space:\s*nowrap;/)
    expect(styles).toMatch(/\.rail-item__label\s*\{[\s\S]*white-space:\s*nowrap;/)
    expect(styles).toMatch(/\.rail-item__count\s*\{[\s\S]*white-space:\s*nowrap;/)
    expect(styles.includes('.pantry-item__thumb')).toBe(false)
  })

  it('uses a shorter pantry search box than before', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')

    expect(styles).toMatch(/\.search-box\s*\{[\s\S]*height:\s*72rpx;/)
    expect(styles).toMatch(/\.search-box\s*\{[\s\S]*border-radius:\s*999rpx;/)
    expect(styles).toMatch(/\.search-box__input\s*\{[\s\S]*height:\s*72rpx;/)
    expect(styles).toMatch(/\.search-box__clear\s*\{[\s\S]*width:\s*44rpx;/)
    expect(styles).toMatch(/\.management-card__more\s*\{(?:(?!padding:)[\s\S])*\}/)
    expect(styles).toMatch(/\.item-action--edit\s*\{[\s\S]*background:\s*#eef6ff;/)
    expect(styles).not.toContain('.delete-line-icon')
  })

  it('centers the pantry surface header vertically', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')

    expect(styles).toMatch(/\.surface-head\s*\{[\s\S]*align-items:\s*center;/)
  })

  it('does not paint a page-level pantry background', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')
    const pantryPageStyles = getStyleBlock(styles, '.pantry-page')

    expect(pantryPageStyles).not.toMatch(/background:/)
  })

  it('uses requested pantry list status colors', () => {
    const styles = readFileSync('miniprogram/pages/pantry/index.wxss', 'utf8')

    expect(getStyleBlock(styles, '.usage-badge--opened')).toMatch(/color:\s*#d6861d;/)
    expect(getStyleBlock(styles, '.freshness-badge--expiring-soon')).toMatch(/color:\s*#d6861d;/)
    expect(getStyleBlock(styles, '.usage-badge--used-up')).toMatch(/color:\s*#667084;/)
    expect(getStyleBlock(styles, '.usage-badge--discarded')).toMatch(/color:\s*#667084;/)
  })
})
