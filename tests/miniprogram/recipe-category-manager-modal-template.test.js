import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recipe category manager modal', () => {
  it('uses a compact confirm button without fixed-width medium sizing', () => {
    const template = readFileSync('miniprogram/components/recipe-category-manager-modal/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/components/recipe-category-manager-modal/index.wxss', 'utf8')

    expect(template).toContain('category-modal__confirm')
    expect(template.includes('<t-button')).toBe(false)
    expect(styles).toMatch(/\.category-modal__confirm\s*\{[\s\S]*width:\s*184rpx;/)
    expect(styles).toMatch(/\.category-modal__confirm\s*\{[\s\S]*min-width:\s*0;/)
    expect(styles).toMatch(/\.category-modal__confirm\s*\{[\s\S]*flex:\s*none;/)
    expect(styles).toMatch(/\.category-modal__confirm\s*\{[\s\S]*height:\s*84rpx;/)
    expect(styles).toMatch(/\.category-modal__confirm\s*\{[\s\S]*font-size:\s*30rpx;/)
  })

  it('supports drag handle touch bindings and dragging styles', () => {
    const template = readFileSync('miniprogram/components/recipe-category-manager-modal/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/components/recipe-category-manager-modal/index.wxss', 'utf8')

    expect(template).toContain('class="category-modal__overlay" catchtap="handleClose" catchtouchmove="noop"')
    expect(template).toContain('class="category-modal" catchtap="noop" catchtouchmove="noop"')
    expect(template).toContain('<scroll-view wx:else scroll-y="true" class="category-modal__list">')
    expect(template).toContain('catchtouchstart="handleDragStart"')
    expect(template).toContain('catchtouchmove="handleDragMove"')
    expect(template).toContain('catchtouchend="handleDragEnd"')
    expect(template).toContain('catchtouchcancel="handleDragCancel"')
    expect(styles).toMatch(/\.category-modal__list\s*\{[\s\S]*max-height:\s*52vh;/)
    expect(styles).toMatch(/\.category-modal__item--dragging\s*\{/)
    expect(styles).toMatch(/\.category-modal__drag--active\s*\{/)
  })

  it('uses a neutral input surface and shared compact modal title treatment', () => {
    const styles = readFileSync('miniprogram/components/recipe-category-manager-modal/index.wxss', 'utf8')
    const inputBlock = styles.match(/\.category-modal__input\s*\{[^}]*\}/)
    const closeBlock = styles.match(/\.category-modal__close\s*\{[^}]*\}/)
    const itemBlock = styles.match(/\.category-modal__item\s*\{[^}]*\}/)

    expect(styles).toMatch(/\.category-modal__title\s*\{[\s\S]*font-size:\s*34rpx;/)
    expect(closeBlock ? closeBlock[0] : '').toContain('background: #f2f4f8;')
    expect(closeBlock ? closeBlock[0] : '').not.toContain('var(--surface-muted')
    expect(itemBlock ? itemBlock[0] : '').toContain('background: #f7f8fa;')
    expect(inputBlock ? inputBlock[0] : '').toContain('background: #fff;')
    expect(inputBlock ? inputBlock[0] : '').not.toContain('background: var(--surface-bg')
  })
})
