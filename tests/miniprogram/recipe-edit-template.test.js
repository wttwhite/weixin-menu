import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recipe edit template', () => {
  it('includes recommendationScore field in form controls', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('class="edit-page" style="{{themeStyle}}"')).toBe(true)
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
    expect(template).toContain('>★</text>')
  })

  it('removes the notes-and-source section from the editor form', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('备注与来源')).toBe(false)
    expect(template.includes('data-field="sourceName"')).toBe(false)
    expect(template.includes('data-field="sourceUrl"')).toBe(false)
    expect(template.includes('data-field="servings"')).toBe(false)
    expect(template.includes('data-field="prepTimeMinutes"')).toBe(false)
    expect(template.includes('subsection-title">标签')).toBe(false)
    expect(template.includes('bindtap="createTag"')).toBe(false)
  })

  it('keeps description textarea compact and delete action content-sized', () => {
    const styles = readFileSync('miniprogram/pages/recipe-edit/index.wxss', 'utf8')
    const uploaderStyles = readFileSync('miniprogram/components/image-uploader/index.wxss', 'utf8')
    expect(styles).toMatch(/\.field-textarea--hero\s*\{[\s\S]*min-height:\s*8\d?rpx;/)
    expect(styles).toMatch(/\.field-textarea--step\s*\{[\s\S]*min-height:\s*1\d\d?rpx;/)
    expect(styles).toMatch(/\.delete-button\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.delete-button\s*\{[\s\S]*align-self:\s*flex-start;/)
    expect(styles).toMatch(/\.row-card__pill\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.rating-row\s*\{[\s\S]*align-items:\s*center;/)
    expect(styles).toMatch(/\.rating-row\s*\{[\s\S]*flex-wrap:\s*nowrap;/)
    expect(styles).toMatch(/\.rating-row__stars\s*\{[\s\S]*align-items:\s*center;/)
    expect(styles).toMatch(/\.rating-row__stars\s*\{[\s\S]*white-space:\s*nowrap;/)
    expect(styles).toMatch(/\.editor-section__head\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;/)
    expect(styles).toMatch(/\.description-row\s*\{[\s\S]*display:\s*flex;/)
    expect(styles).toMatch(/\.description-row\s+\.form-row__label\s*\{[\s\S]*display:\s*flex;/)
    expect(styles).toMatch(/\.description-row\s+\.form-row__label\s*\{[\s\S]*align-items:\s*center;/)
    expect(styles).toMatch(/\.description-row\s+\.form-row__label\s*\{[\s\S]*justify-content:\s*flex-end;/)
    expect(styles).toMatch(/\.description-row\s+\.form-row__label\s*\{[\s\S]*min-height:\s*8\d?rpx;/)
    expect(styles).toMatch(/\.description-row__main\s*\{[\s\S]*flex:\s*1;/)
    expect(styles).toMatch(/\.field-input--plain\s*\{[\s\S]*color:\s*#27323f;/)
    expect(styles).toMatch(/\.section-button--soft\s*\{[\s\S]*width:\s*auto;/)
    expect(styles).toMatch(/\.section-button--soft\s*\{[\s\S]*align-self:\s*center;/)
    expect(styles).toMatch(/\.section-button--soft\s*\{[\s\S]*--td-button-height:\s*6\d?rpx;/)
    expect(styles).toMatch(/\.section-button--soft\s*\{[\s\S]*--td-button-font-size:\s*2[24]rpx;/)
    expect(styles).toMatch(/\.subsection-hint\s*\{[\s\S]*margin-bottom:\s*1\d?rpx;/)
    expect(styles).toMatch(/\.editor-section--danger\s*\{/)
    expect(styles).toMatch(/\.editor-section__title\s*\{[\s\S]*font-size:\s*44rpx;/)
    expect(styles).toMatch(/\.editor-section--last\s+\.subsection-title\s*\{[\s\S]*margin-top:\s*2\d?rpx;/)
    expect(styles).toMatch(/\.editor-section--last\s+\.subsection-hint\s*\{[\s\S]*margin-top:\s*1\d?rpx;/)
    expect(styles).toMatch(/\.editor-section--last\s+\.subsection-hint\s*\{[\s\S]*margin-bottom:\s*1\d?rpx;/)
    expect(styles).toMatch(/\.editor-section--last\s+\.detail-grid\s*\{[\s\S]*margin-top:\s*1\d?rpx;/)
    expect(styles).toMatch(/\.editor-section--last\s+\.field-switch\s*\{[\s\S]*margin-top:\s*2\d?rpx;/)
    expect(uploaderStyles).toMatch(/\.uploader__entry-icon\s*\{[\s\S]*line-height:\s*1;/)
    expect(uploaderStyles).toMatch(/\.uploader__entry--camera\s+\.uploader__entry-icon\s*\{[\s\S]*transform:\s*translateY\(-\d+rpx\);/)
  })

  it('uses a left-right layout for description and removes extra step tips input', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')

    expect(template).toContain('description-row')
    expect(template).toContain('description-row__main')
    expect(template).toContain('description-row__field-wrap')
    expect(template.includes('description-head')).toBe(false)
    expect(template.includes('补充提示（可选）')).toBe(false)
    expect(template.includes('data-field="tips"')).toBe(false)
    expect(template).toContain('placeholder-class="field-placeholder"')
    expect(template).toContain('危险操作')
  })

  it('shows create-mode loading copy instead of recipe-detail loading copy', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('{{loadingTitle}}')).toBe(true)
  })

  it('uses a fallback navigation title for the recipe form page config', () => {
    const pageConfig = readFileSync('miniprogram/pages/recipe-edit/index.json', 'utf8')
    expect(pageConfig.includes('"navigationBarTitleText": "菜谱表单"')).toBe(true)
  })
})
