import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

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

    expect(template).toMatch(/<view class="management-card__more" bindtap="openSpaceManager">/)
    expect(template).toMatch(/<view class="action-pill action-pill--random" bindtap="handleRandomPick">/)
    expect(template).toMatch(/<view class="action-pill action-pill--create" bindtap="goCreate">/)
    expect(template).toMatch(/<view class="cart-primary" bindtap="handlePlanSelectedRecipes">/)
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

    expect(styles.includes('.management-card__more')).toBe(true)
    expect(styles.includes('flex: none;')).toBe(true)
    expect(styles.includes('width: auto;')).toBe(true)
    expect(styles).toMatch(/\.action-pill\s*\{[\s\S]*font-size:\s*24rpx;/)
    expect(styles).toMatch(/\.action-pill--random\s*\{[\s\S]*background:/)
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

  it('pulls the management card upward instead of leaving a large empty banner gap', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles).toMatch(/\.management-card\s*\{[\s\S]*margin-top:\s*-\d+rpx;/)
    expect(styles.includes('margin-top: -20rpx;')).toBe(false)
    expect(styles.includes('margin-top: -82rpx;')).toBe(false)
  })

  it('keeps the date readable against the hero background with a contrasting pill', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles).toMatch(/\.hero-banner__date\s*\{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.\d+\)/)
    expect(styles.includes('border-radius: 999rpx;')).toBe(true)
  })

  it('uses larger selected recipe tags in the add-to-plan modal', () => {
    const styles = readFileSync('miniprogram/pages/recipes/index.wxss', 'utf8')

    expect(styles).toMatch(/\.plan-modal__tag\s*\{[\s\S]*font-size:\s*28rpx;/)
  })
})
