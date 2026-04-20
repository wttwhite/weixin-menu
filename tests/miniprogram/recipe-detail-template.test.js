import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recipe detail template', () => {
  it('renders hero, action row, steps card, gallery card, and close button', () => {
    const template = readFileSync('miniprogram/pages/recipe-detail/index.wxml', 'utf8')

    expect(template.includes('class="hero-card"')).toBe(true)
    expect(template.includes('class="action-row"')).toBe(true)
    expect(template).toMatch(/class="[^"]*action-button[^"]*action-button--edit[^"]*"/)
    expect(template).toMatch(/class="[^"]*action-button[^"]*action-button--delete[^"]*"/)
    expect(template.includes('class="card-title">制作步骤')).toBe(true)
    expect(template.includes('class="card-title">菜谱图集')).toBe(true)
    expect(template).toMatch(/class="[^"]*footer-close-button[^"]*"/)
  })

  it('includes a dedicated share button', () => {
    const template = readFileSync('miniprogram/pages/recipe-detail/index.wxml', 'utf8')

    expect(template.includes('open-type="share"')).toBe(true)
  })
})
