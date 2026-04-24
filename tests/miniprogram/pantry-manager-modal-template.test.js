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
})
