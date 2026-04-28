import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('pantry manager modal', () => {
  it('uses the pantry settings row layout with compact confirm button and drag handles', () => {
    const template = readFileSync('miniprogram/components/pantry-manager-modal/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/components/pantry-manager-modal/index.wxss', 'utf8')

    expect(template).toContain('class="pantry-manager-modal__overlay" catchtap="handleClose" catchtouchmove="noop"')
    expect(template).toContain('class="pantry-manager-modal" catchtap="noop" catchtouchmove="noop"')
    expect(template).toContain('pantry-manager-modal__confirm')
    expect(template).toContain('pantry-manager-modal__drag')
    expect(template).toContain('catchtouchstart="handleDragStart"')
    expect(template.includes('<t-button')).toBe(false)
    expect(styles).toMatch(/\.pantry-manager-modal__confirm\s*\{[\s\S]*width:\s*184rpx;/)
    expect(styles).toMatch(/\.pantry-manager-modal__confirm\s*\{[\s\S]*height:\s*84rpx;/)
    expect(styles).toMatch(/\.pantry-manager-modal__confirm\s*\{[\s\S]*font-size:\s*30rpx;/)
  })

  it('uses neutral input and category item backgrounds like the recipe category modal', () => {
    const styles = readFileSync('miniprogram/components/pantry-manager-modal/index.wxss', 'utf8')
    const inputBlock = styles.match(/\.pantry-manager-modal__input\s*\{[^}]*\}/)
    const itemBlock = styles.match(/\.pantry-manager-modal__item\s*\{[^}]*\}/)

    expect(inputBlock ? inputBlock[0] : '').toMatch(/background:\s*#fff;/)
    expect(inputBlock ? inputBlock[0] : '').not.toMatch(/background:\s*var\(--surface/)
    expect(itemBlock ? itemBlock[0] : '').toMatch(/background:\s*#f7f8fa;/)
    expect(itemBlock ? itemBlock[0] : '').not.toMatch(/background:\s*var\(--brand|background:\s*var\(--surface-bg/)
  })
})
