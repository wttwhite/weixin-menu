import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recipe edit template', () => {
  it('includes recommendationScore field in form controls', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('data-field="recommendationScore"')).toBe(true)
  })

  it('does not expose inline global tag-delete controls in recipe editor chips', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('bindremove="deleteTag"')).toBe(false)
    expect(template.includes('removable="{{true}}"')).toBe(false)
  })

  it('renders grouped section cards and fixed bottom actions for close and save', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('class="editor-header"')).toBe(false)
    expect(template.includes('bindtap="goBack"')).toBe(true)
    expect(template.includes('class="editor-section"')).toBe(true)
    expect(template.includes('class="bottom-actions"')).toBe(true)
    expect(template).toMatch(/class="[^"]*footer-close-button[^"]*"/)
    expect(template).toMatch(/class="[^"]*footer-submit-button[^"]*"/)
  })

  it('uses a picker for recipe category and interactive chips for duration and recommendation', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('bindtap="openCategorySelector"')).toBe(true)
    expect(template.includes('class="category-selector__overlay"')).toBe(true)
    expect(template.includes('duration-chip')).toBe(true)
    expect(template.includes('bindtap="handleCookTimeOptionTap"')).toBe(true)
    expect(template.includes('recommendationStarItems')).toBe(true)
    expect(template.includes('bindtap="handleRecommendationTap"')).toBe(true)
  })

  it('removes the notes-and-source section from the editor form', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('备注与来源')).toBe(false)
    expect(template.includes('data-field="sourceName"')).toBe(false)
    expect(template.includes('data-field="sourceUrl"')).toBe(false)
  })

  it('keeps description textarea compact and delete action content-sized', () => {
    const styles = readFileSync('miniprogram/pages/recipe-edit/index.wxss', 'utf8')
    expect(styles).toMatch(/\.field-textarea--hero\s*\{[\s\S]*min-height:\s*8\d?rpx;/)
    expect(styles).toMatch(/\.delete-button\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.delete-button\s*\{[\s\S]*align-self:\s*flex-start;/)
    expect(styles).toMatch(/\.row-card__pill\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.rating-row\s*\{[\s\S]*align-items:\s*center;/)
    expect(styles).toMatch(/\.rating-row__stars\s*\{[\s\S]*align-items:\s*center;/)
  })

  it('shows create-mode loading copy instead of recipe-detail loading copy', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('{{loadingTitle}}')).toBe(true)
  })
})
