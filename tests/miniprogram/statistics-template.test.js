import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('statistics page template', () => {
  it('renders a richer analytics hero, metric grid, progress board, and insight cards', () => {
    const template = readFileSync('miniprogram/pages/statistics/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/statistics/index.wxss', 'utf8')

    expect(template).toContain('statistics-hero')
    expect(template).toContain('statistics-hero__kicker')
    expect(template).toContain('statistics-hero__title')
    expect(template).toContain('统计看板')
    expect(template.includes('{{activeSpaceId')).toBe(false)
    expect(template).toContain('statistics-hero__summary')
    expect(template).toContain('statistics-hero__chips')
    expect(template).toContain('statistics-metric-grid')
    expect(template).toContain('statistics-progress-card')
    expect(template).toContain('statistics-insight-list')
    expect(template).toContain('statistics-action-row')
    expect(template.includes('Dashboard')).toBe(false)

    expect(styles).toContain('var(--brand')
    expect(styles).toContain('var(--surface-bg')
    expect(styles).toContain('var(--text-primary')
    expect(styles).toMatch(/\.statistics-page\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.statistics-metric-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,/)
    expect(styles).toContain('.statistics-progress-card')
    expect(styles).toMatch(/\.statistics-metric-card,\s*\.statistics-progress-card,\s*\.statistics-insight-card,\s*\.statistics-action-row\s*\{[\s\S]*border-radius:\s*3\d+rpx;/)
  })

  it('uses the same theme-driven airy hero language instead of a fixed dark statistics banner', () => {
    const styles = readFileSync('miniprogram/pages/statistics/index.wxss', 'utf8')

    expect(styles).toContain('var(--hero-soft-start')
    expect(styles).toContain('var(--hero-soft-end')
    expect(styles).toContain('var(--hero-soft-text')
    expect(styles).toContain('var(--hero-soft-subtle')
    expect(styles).not.toContain('rgba(81, 56, 37, 0.95)')
    expect(styles).not.toContain('rgba(139, 103, 74, 0.88)')
  })
})
