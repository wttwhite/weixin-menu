import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recipe detail template', () => {
  it('renders hero, action row, steps card, gallery card, and close button', () => {
    const template = readFileSync('miniprogram/pages/recipe-detail/index.wxml', 'utf8')

    expect(template.includes('class="hero-card"')).toBe(true)
    expect(template.includes('class="hero-copy-panel"')).toBe(true)
    expect(template.includes('class="action-row"')).toBe(true)
    expect(template).toMatch(/t-class="[^"]*action-button[^"]*action-button--edit[^"]*"/)
    expect(template).toMatch(/t-class="[^"]*action-button[^"]*action-button--delete[^"]*"/)
    expect(template.includes('class="card-title">制作步骤')).toBe(true)
    expect(template.includes('class="card-title">菜谱图集')).toBe(true)
    expect(template).toMatch(/class="[^"]*footer-close-button[^"]*"/)
  })

  it('includes a dedicated share button', () => {
    const template = readFileSync('miniprogram/pages/recipe-detail/index.wxml', 'utf8')

    expect(template.includes('open-type="share"')).toBe(true)
  })

  it('uses per-text contrast backgrounds instead of one large dark hero copy block', () => {
    const styles = readFileSync('miniprogram/pages/recipe-detail/index.wxss', 'utf8')
    const heroCopyPanelBlock = styles.match(/\.hero-copy-panel\s*\{[^}]*\}/)

    expect(styles).toMatch(/\.hero-copy-panel\s*\{[\s\S]*display:\s*grid;/)
    expect(styles).toMatch(/\.hero-copy-panel\s*\{[\s\S]*justify-items:\s*start;/)
    expect(heroCopyPanelBlock ? heroCopyPanelBlock[0] : '').not.toMatch(/background:\s*rgba\(/)
    expect(styles).toMatch(/\.hero-title\s*\{[\s\S]*background:\s*rgba\(/)
    expect(styles).toMatch(/\.hero-summary\s*\{[\s\S]*background:\s*rgba\(/)
    expect(styles).toMatch(/\.hero-metric\s*\{[\s\S]*background:\s*rgba\(/)
  })

  it('uses a theme-colored share button with auto width instead of the default native button width', () => {
    const styles = readFileSync('miniprogram/pages/recipe-detail/index.wxss', 'utf8')

    expect(styles).toMatch(/button\.hero-share\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/button\.hero-share\s*\{[\s\S]*margin-left:\s*0;/)
    expect(styles).toMatch(/button\.hero-share\s*\{[\s\S]*margin-right:\s*0;/)
    expect(styles).toMatch(/button\.hero-share\s*\{[\s\S]*background:/)
  })

  it('keeps the detail page within the viewport width on mobile', () => {
    const styles = readFileSync('miniprogram/pages/recipe-detail/index.wxss', 'utf8')

    expect(styles).toMatch(/\.detail-page\s*\{[\s\S]*box-sizing:\s*border-box;/)
    expect(styles).toMatch(/\.detail-page\s*\{[\s\S]*overflow-x:\s*hidden;/)
    expect(styles).toMatch(/\.t-button\.action-btn\s*\{[\s\S]*flex:\s*1;[\s\S]*width:\s*auto;[\s\S]*min-width:\s*0;/)
    expect(styles).toMatch(/\.card-head\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto;/)
    expect(styles).toMatch(/\.card-head__left\s*\{[\s\S]*flex:\s*1;[\s\S]*min-width:\s*0;/)
    expect(styles).toMatch(/\.card-head__meta\s*\{[\s\S]*flex:\s*none;/)
    expect(styles).toMatch(/\.card-title\s*\{[\s\S]*min-width:\s*0;/)
    expect(styles).toMatch(/\.card-head__meta\s*\{[\s\S]*text-align:\s*right;/)
  })
})
