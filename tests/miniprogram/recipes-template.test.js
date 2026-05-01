import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

function getStyleBlock(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`))
  return match ? match[1] : ''
}

describe('recipes page template styles', () => {
  it('lets the content region stretch above the plan bar instead of being overlapped by it', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles.includes('.recipes-page')).toBe(true)
    expect(styles.includes('display: flex;')).toBe(true)
    expect(styles.includes('flex-direction: column;')).toBe(true)
    expect(styles.includes('.channel-layout')).toBe(true)
    expect(styles.includes('flex: 1;')).toBe(true)
    expect(styles).not.toMatch(/\.cart-bar\s*\{[^}]*position:\s*fixed;/)
    expect(styles.includes('margin-top: auto;')).toBe(false)
    expect(styles.includes('padding: 14rpx 18rpx calc(env(safe-area-inset-bottom) + 16rpx);')).toBe(false)
    expect(styles).toMatch(/\.recipes-page\s*\{[\s\S]*padding:\s*14rpx 18rpx calc\(env\(safe-area-inset-bottom\) \+ 128rpx\);/)
    expect(styles).toMatch(/\.cart-bar\s*\{[\s\S]*margin-top:\s*18rpx;/)
  })

  it('uses non-button containers for compact utility actions and rail items', () => {
    const template = readFileSync('miniprogram/pages/recipes/index.wxml', 'utf8')

    expect(template).toMatch(/<view class="\{\{searchToggleClass\}\}" bindtap="toggleSearchPanel">/)
    expect(template).not.toContain('bindtap="openSpaceManager"')
    expect(template).toContain('class="{{searchPanelClass}}"')
    expect(template).toContain('data-field="recipeSearchQuery"')
    expect(template).toContain('bindinput="handleRecipeSearchInput"')
    expect(template).toContain('bindtap="clearRecipeSearch"')
    expect(template).toMatch(/<view class="action-pill action-pill--random" bindtap="handleRandomPick">/)
    expect(template).toMatch(/<view class="action-pill action-pill--create" bindtap="goCreate">/)
    expect(template).toMatch(/wx:if="\{\{selectedRecipesCount > 0\}}" class="cart-primary" bindtap="handlePlanSelectedRecipes"/)
    expect(template).toMatch(/wx:else class="cart-primary cart-primary--disabled"/)
    expect(template).toMatch(/<view class="cart-secondary" bindtap="clearSelectedRecipes">/)
    expect(template).toContain('showPlanModal')
    expect(template).toContain('plan-modal')
    expect(template).toContain('bindtap="submitPlanSelection"')
    expect(template).toMatch(/<view[\s\S]*class="\{\{item\.itemClass\}\}"[\s\S]*bindtap="handleSectionChange"/)
    expect(template).toMatch(/<view[\s\S]*class="\{\{item\.selectionClass\}\}"[\s\S]*bindtap="toggleRecipeSelection"[\s\S]*<text class="dish-add__symbol[\s\S]*">\{\{item\.selectionSymbol\}\}<\/text>/)
  })

  it('uses a static food banner image and removes the old recommendation headline copy', () => {
    const template = readFileSync('miniprogram/pages/recipes/index.wxml', 'utf8')

    expect(template.includes('food-hero-table.svg')).toBe(true)
    expect(template.includes('人气推荐 · 招牌热卖')).toBe(false)
    expect(template.includes('hero-banner__title')).toBe(false)
  })

  it('keeps utility actions content-sized instead of stretching them', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles.includes('.management-card__search')).toBe(true)
    expect(styles.includes('.management-card__search--active')).toBe(true)
    expect(styles.includes('.management-card__search-panel')).toBe(true)
    expect(styles.includes('flex: none;')).toBe(true)
    expect(styles.includes('width: auto;')).toBe(true)
    expect(styles).toMatch(/\.action-pill\s*\{[\s\S]*font-size:\s*24rpx;/)
    expect(styles).toMatch(/\.action-pill--random\s*\{[\s\S]*background:\s*linear-gradient\(135deg,\s*#fed7aa 0%,\s*#fb923c 55%,\s*#fdba74 100%\);/)
    expect(styles).toMatch(/\.action-pill--random\s*\{[\s\S]*color:\s*#7c2d12;/)
  })

  it('keeps left rail buttons inside the channel rail width', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles.includes('.rail-item')).toBe(true)
    expect(styles.includes('width: 100%;')).toBe(true)
    expect(styles.includes('box-sizing: border-box;')).toBe(true)
    expect(styles.includes('min-height: 80rpx;')).toBe(true)
    expect(styles.includes('white-space: normal;')).toBe(true)
    expect(styles.includes('height: 720rpx;')).toBe(false)
  })

  it('constrains left and right recipe columns to scroll independently', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const template = readFileSync('miniprogram/pages/recipes/index.wxml', 'utf8')

    expect(styles).toMatch(/page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.recipes-page\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.recipes-page\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.channel-layout\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.channel-rail\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-rail__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.channel-surface\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.channel-surface__scroll\s*\{[\s\S]*min-height:\s*0;/)
    expect(template).toMatch(/channel-rail__scroll[\s\S]*scroll-y/)
    expect(template).toMatch(/channel-surface__scroll[\s\S]*scroll-y/)
  })

  it('centers the add and selected check symbol inside the recipe selection button', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles).toMatch(/\.dish-add\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/)
    expect(styles).toMatch(/\.dish-add__symbol\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*line-height:\s*1;/)
  })

  it('uses the theme color recipe selection button with white add and check symbols', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const addButtonStyles = getStyleBlock(styles, '.dish-add')
    const selectedButtonStyles = getStyleBlock(styles, '.dish-add--selected')

    expect(addButtonStyles).toMatch(/background:\s*var\(--brand,\s*#4f7d8a\);/)
    expect(addButtonStyles).toMatch(/color:\s*#fff;/)
    expect(selectedButtonStyles).toMatch(/background:\s*var\(--brand,\s*#4f7d8a\);/)
    expect(selectedButtonStyles).toMatch(/color:\s*#fff;/)
  })

  it('uses a 37rpx servings count on recipe cards', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const servingsStyles = getStyleBlock(styles, '.dish-servings')

    expect(servingsStyles).toMatch(/font-size:\s*37rpx;/)
  })

  it('uses the requested vertical spacing around the recipe surface and cart summary', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const managementCardStyles = getStyleBlock(styles, '.management-card')
    const surfaceHeadStyles = getStyleBlock(styles, '.surface-head')
    const cartCountStyles = getStyleBlock(styles, '.cart-count')

    expect(managementCardStyles).toMatch(/margin-top:\s*-90rpx;/)
    expect(surfaceHeadStyles).toMatch(/margin-top:\s*10rpx;/)
    expect(surfaceHeadStyles).toMatch(/align-items:\s*center;/)
    expect(cartCountStyles).toMatch(/font-size:\s*26rpx;/)
    expect(styles.includes('margin-top: -20rpx;')).toBe(false)
    expect(styles.includes('margin-top: -82rpx;')).toBe(false)
  })

  it('uses the requested translucent channel rail background', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const channelRailStyles = getStyleBlock(styles, '.channel-rail')

    expect(channelRailStyles).toMatch(/background:\s*rgba\(230,\s*236,\s*244,\s*0\.8\);/)
  })

  it('keeps the date readable against the hero background with a contrasting pill', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles).toMatch(/\.hero-banner__date\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.\d+\)/)
    expect(styles.includes('border-radius: 999rpx;')).toBe(true)
  })

  it('uses larger selected recipe tags in the add-to-plan modal', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const template = readFileSync('miniprogram/pages/recipes/index.wxml', 'utf8')

    expect(styles).toMatch(/\.plan-modal__tag\s*\{[\s\S]*font-size:\s*28rpx;/)
    expect(template).toMatch(/class="plan-modal__tag-remove"[\s\S]*bindtap="removePlanModalRecipe"/)
  })

  it('uses themed add-to-plan buttons and keeps meal type choices on one row', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')
    const template = readFileSync('miniprogram/pages/recipes/index.wxml', 'utf8')

    expect(styles).toMatch(/\.cart-primary\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.cart-primary--disabled\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);[\s\S]*opacity:\s*0\.68;[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.plan-modal__date-chip--active\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.plan-modal__meal-chip--active\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.plan-modal__primary\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.plan-modal__primary--disabled\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);[\s\S]*opacity:\s*0\.68;[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.plan-modal__meal-types\s*\{[\s\S]*flex-wrap:\s*nowrap;/)
    expect(styles).toMatch(/\.plan-modal__meal-chip\s*\{[\s\S]*flex:\s*1;/)
    expect(template).toMatch(/wx:if="\{\{selectedRecipesCount > 0\}}" class="plan-modal__primary" bindtap="submitPlanSelection"/)
    expect(template).toMatch(/wx:else class="plan-modal__primary plan-modal__primary--disabled"/)
  })

  it('removes orange button shadows and uses a pale neutral selected-recipe tag', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles).not.toContain('rgba(197, 106, 61')
    expect(styles).not.toContain('rgba(255, 180, 87')
    expect(styles).toMatch(/\.action-pill--create\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);/)
    expect(styles).toMatch(/\.action-pill--create\s*\{[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.cart-primary\s*\{[\s\S]*background:\s*var\(--brand,\s*#4f7d8a\);/)
    expect(styles).toMatch(/\.cart-primary\s*\{[\s\S]*color:\s*#fff;/)
    expect(styles).toMatch(/\.action-pill--create\s*\{[\s\S]*box-shadow:\s*none;/)
    expect(styles).toMatch(/\.dish-add\s*\{[\s\S]*box-shadow:\s*none;/)
    expect(styles).toMatch(/\.plan-modal__tag\s*\{[\s\S]*background:\s*var\(--surface-muted,\s*#f3f4f7\);/)
  })
})
