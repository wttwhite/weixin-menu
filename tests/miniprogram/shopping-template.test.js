import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('shopping page template', () => {
  it('uses the market action panel hero and removes the space-switch action', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')

    expect(template).toContain('MARKET ACTION PANEL')
    expect(template).toContain('采购清单')
    expect(template.includes('切换空间')).toBe(false)
    expect(template.includes('bindtap="openSpace"')).toBe(false)
  })

  it('renders status tabs, shopping list cards, and inline modals', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')

    expect(template).toContain('shopping-status-tabs')
    expect(template).toContain('handleStatusFilterChange')
    expect(template).toContain('statusTabs')
    expect(template).toContain('shopping-list-card')
    expect(template).toContain('录入库存')
    expect(template).toContain('计划生成')
    expect(template.includes('同步计划')).toBe(false)
    expect(template).not.toContain('生成计划项')
    expect(template).toContain('toggleShoppingListItems')
    expect(template).toMatch(/shopping-list-card__subhead[\s\S]*bindtap="toggleShoppingListItems"/)
    expect(template).toContain('showDraftCategorySelector')
    expect(template).toContain('bindtap="openDraftCategorySelector"')
    expect(template).toContain('selectDraftCategoryOption')
    expect(template).toContain('listItemCategoryOptions')
    expect(template).toContain('showListModal')
    expect(template).toContain('showPantryEntryModal')
    expect(template).toContain('pantry-form-modal')
    expect(template).toContain('shopping-modal__body')
    expect(template).toContain('shopping-modal__header')
    expect(template).toContain('shopping-modal__close-icon')
    expect(template).toContain('category-selector__close')
    expect(template).toContain('submit-label="保存"')
    expect(template).toContain('bindtap="openCreateListModal"')
    expect(template.includes('handleListItemDraftCategoryChange')).toBe(false)
    expect(template.includes('从计划生成')).toBe(false)
    expect(template.includes('保存并勾选')).toBe(false)
  })

  it('keeps enough bottom padding so shopping content is not covered by the tab bar', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-page\s*\{[\s\S]*padding:\s*20rpx 16rpx calc\(env\(safe-area-inset-bottom\) \+ 12\d?rpx\);/)
  })

  it('removes background styling from the outer shopping page wrapper and locks modal touch scroll', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')
    const shoppingPageBlock = styles.match(/\.shopping-page\s*\{[^}]*\}/)

    expect(styles).toMatch(/page\s*\{[\s\S]*background:\s*transparent;/)
    expect(shoppingPageBlock ? shoppingPageBlock[0] : '').not.toMatch(/background:/)
    expect(template).toContain('class="shopping-modal__overlay" catchtap="closeListModal" catchtouchmove="noop"')
    expect(template).toContain('class="shopping-modal" catchtap="noop"')
  })

  it('uses theme variables across the shopping page instead of fixed page colors', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toContain('var(--surface-bg')
    expect(styles).toContain('var(--surface-muted')
    expect(styles).toContain('var(--brand')
    expect(styles).toContain('var(--brand-strong')
    expect(styles).toContain('var(--text-primary')
    expect(styles).toContain('var(--text-secondary')
    expect(styles).toContain('var(--danger')
    expect(styles).toContain('var(--success')
    expect(styles).toContain('var(--border-soft')
    expect(styles).toMatch(/\.shopping-modal\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.shopping-modal__body\s*\{[\s\S]*flex:\s*1;[\s\S]*min-height:\s*0;/)
  })

  it('uses pale gray shopping item rows instead of themed item backgrounds', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-item-row\s*\{[\s\S]*background:\s*#f9fafc;/)
  })

  it('uses a pale gray background for shopping list card icons', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-list-card__icon\s*\{[\s\S]*background:\s*#f4f5f8;/)
  })

  it('uses pale gray progress tracks and grouped generated source labels', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-list-card__progress-track\s*\{[\s\S]*background:\s*#f4f5f8;/)
    expect(styles).toMatch(/\.shopping-item-list__generated-bar\s*\{[\s\S]*background:\s*#fff3c4;[\s\S]*color:\s*#9a5d18;/)
  })

  it('uses status-colored labels and inventory entry actions', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-list-card__status--open\s*\{[\s\S]*background:\s*#dbeafe;[\s\S]*color:\s*#2563eb;/)
    expect(styles).toMatch(/\.shopping-list-card__status--completed\s*\{[\s\S]*background:\s*#dcfce7;[\s\S]*color:\s*#16803c;/)
    expect(styles).toMatch(/\.shopping-list-card__status--archived\s*\{[\s\S]*background:\s*#f4f5f8;[\s\S]*color:\s*#7a808d;/)
    expect(styles).toMatch(/\.shopping-item-row__record\s*\{[\s\S]*background:\s*#eaf5eb;[\s\S]*color:\s*#237542;/)
    expect(styles).toMatch(/\.shopping-item-row__record--checked\s*\{[\s\S]*background:\s*#f4f5f8;[\s\S]*color:\s*#a0a8b4;/)
  })

  it('uses grouped shopping items, line icons, blue progress for open, and compact checked boxes', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(template).toContain('shopping-list-card__action shopping-list-card__action--edit')
    expect(template).toContain('shopping-list-card__element-icon shopping-list-card__element-icon--edit')
    expect(template).toContain('shopping-list-card__element-icon shopping-list-card__element-icon--delete')
    expect(template).toContain('shopping-list-card__element-edit-box')
    expect(template).toContain('shopping-list-card__element-edit-pencil')
    expect(template).not.toContain('shopping-list-card__element-edit-pencil-tip')
    expect(template).toContain('shopping-list-card__element-delete-handle')
    expect(template).toContain('shopping-list-card__element-delete-lid')
    expect(template).toContain('shopping-list-card__element-delete-body')
    expect(template).toContain('shopping-list-card__element-delete-line')
    expect(template).not.toContain('<t-icon class="shopping-list-card__action-icon"')
    expect(styles).toMatch(/\.shopping-list-card__action\s*\{[\s\S]*border:\s*0;[\s\S]*box-shadow:\s*none;[\s\S]*background:\s*transparent;/)
    expect(styles).toMatch(/\.shopping-list-card__actions\s*\{[\s\S]*gap:\s*0;/)
    expect(styles).toMatch(/\.shopping-list-card__action--edit\s*\{[\s\S]*color:\s*#606266;/)
    expect(styles).toMatch(/\.shopping-list-card__action--danger\s*\{[\s\S]*color:\s*#f56c6c;/)
    expect(styles).not.toContain('shopping-list-card__element-icon--edit::before')
    expect(styles).not.toContain('shopping-list-card__element-icon--delete::after')
    expect(styles).toMatch(/\.shopping-list-card__element-edit-box\s*\{[\s\S]*left:\s*3rpx;[\s\S]*bottom:\s*4rpx;[\s\S]*width:\s*30rpx;[\s\S]*height:\s*30rpx;[\s\S]*border:\s*3rpx solid currentColor;/)
    expect(styles).toMatch(/\.shopping-list-card__element-edit-pencil\s*\{[\s\S]*right:\s*8rpx;[\s\S]*top:\s*16rpx;[\s\S]*border:\s*3rpx solid currentColor;/)
    expect(styles).not.toContain('shopping-list-card__element-edit-pencil-tip')
    expect(styles).toMatch(/\.shopping-list-card__element-delete-handle\s*\{[\s\S]*top:\s*9rpx;[\s\S]*border:\s*3rpx solid currentColor;/)
    expect(styles).toMatch(/\.shopping-list-card__element-delete-lid\s*\{[\s\S]*top:\s*17rpx;/)
    expect(styles).toMatch(/\.shopping-list-card__element-delete-line\s*\{[\s\S]*display:\s*none;/)
    expect(template).toContain('wx:for="{{item.manualItems}}"')
    expect(template).toContain('wx:if="{{item.generatedItems.length}}" class="shopping-item-list__generated-bar"')
    expect(template).toContain('{{item.generatedSummaryText}}')
    expect(template).toContain('wx:for="{{item.generatedItems}}"')
    expect(template).not.toContain('shopping-item-row__source')
    expect(template).toContain('class="{{shoppingItem.recordClass}}"')
    expect(template).toContain('color="#3b82f6"')
    expect(styles).toMatch(/\.shopping-list-card\s*\{[\s\S]*background:\s*#fbfcfe;/)
    expect(styles).toMatch(/\.shopping-list-card__progress-fill--open\s*\{[\s\S]*background:\s*#3b82f6;/)
    expect(styles).toMatch(/\.shopping-list-card__progress-fill--completed\s*\{[\s\S]*background:\s*#22c55e;/)
    expect(styles).toMatch(/\.shopping-list-card__progress-fill--archived\s*\{[\s\S]*background:\s*#cbd5e1;/)
    expect(styles).toMatch(/\.shopping-item-row checkbox\s*\{[\s\S]*transform:\s*scale\(0\.72\);/)
    expect(styles).toMatch(/\.shopping-item-row__name--checked\s*\{[\s\S]*color:\s*#b8c0cc;/)
    expect(styles).toMatch(/\.shopping-item-row\s*\{[\s\S]*min-height:\s*80rpx;/)
    expect(styles).toMatch(/\.shopping-item-row__record\s*\{[\s\S]*height:\s*50rpx;/)
    expect(styles).toMatch(/\.shopping-list-card__subhead-indicator\s*\{[\s\S]*color:\s*#111827;/)
  })

  it('uses lighter copy hierarchy in shopping cards', () => {
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(styles).toMatch(/\.shopping-section-head__eyebrow\s*\{[\s\S]*letter-spacing:\s*8rpx;/)
    expect(styles).toMatch(/\.shopping-section-head__title\s*\{[\s\S]*font-size:\s*39rpx;/)
    expect(styles).toMatch(/\.shopping-create-btn\s*\{[\s\S]*height:\s*70rpx;/)
    expect(styles).toMatch(/\.shopping-list-card__date\s*\{[\s\S]*color:\s*#c0c4cc;/)
    expect(styles).toMatch(/\.shopping-list-card__progress-text\s*\{[\s\S]*color:\s*#909399;/)
    expect(styles).toMatch(/\.shopping-item-list__generated-bar\s*\{[\s\S]*font-weight:\s*400;/)
    expect(styles).toMatch(/\.shopping-item-row__name\s*\{[\s\S]*font-size:\s*28rpx;[\s\S]*font-weight:\s*400;/)
  })

  it('uses a scrollable compact shopping modal form with aligned manual item controls', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(template).toMatch(/shopping-modal__body[\s\S]*scroll-y="true"[\s\S]*show-scrollbar="\{\{true\}\}"[\s\S]*enhanced="\{\{true\}\}"[\s\S]*bounces="\{\{false\}\}"/)
    expect(template).toContain('shopping-draft-row__quantity-stepper')
    expect(template).toContain('bindtap="decrementListItemDraftQuantity"')
    expect(template).toContain('bindtap="incrementListItemDraftQuantity"')
    expect(template).toMatch(/shopping-draft-row__remove[\s\S]*bindtap="removeListItemDraft"/)
    expect(styles).toMatch(/\.shopping-modal__textarea\s*\{[\s\S]*min-height:\s*66rpx;/)
    expect(styles).toMatch(/\.shopping-modal__body-content\s*\{[\s\S]*padding-bottom:\s*36rpx;/)
    expect(styles).toMatch(/\.shopping-draft-row__fields\s*\{[\s\S]*row-gap:\s*16rpx;/)
    expect(styles).toMatch(/\.shopping-draft-row__remove\s*\{[\s\S]*grid-row:\s*1 \/ 3;[\s\S]*align-self:\s*center;/)
    expect(styles).toMatch(/\.shopping-draft-row__remove\s*\{[\s\S]*background:\s*#ffe8e8;[\s\S]*color:\s*#d14b4b;/)
    expect(styles).toMatch(/\.shopping-modal__add-row\s*\{[\s\S]*border-radius:\s*999rpx;/)
  })

  it('locks page scroll behind the shopping modal and keeps modal form colors neutral', () => {
    const template = readFileSync('miniprogram/pages/shopping/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/shopping/index.wxss', 'utf8')

    expect(template).toContain('<page-meta page-style="{{showListModal ? \'overflow: hidden;\' : \'\'}}" />')
    expect(styles).toMatch(/\.shopping-modal__close-icon\s*\{[\s\S]*background:\s*#f4f5f8;[\s\S]*color:\s*#4b5563;/)
    expect(styles).toMatch(/\.shopping-modal__title\s*\{[\s\S]*color:\s*#1f2937;/)
    expect(styles).toMatch(/\.shopping-modal__field-label,[\s\S]*\.shopping-modal__subhead\s*\{[\s\S]*color:\s*#374151;/)
    expect(styles).toMatch(/\.shopping-draft-row__input\s*\{[\s\S]*height:\s*70rpx;[\s\S]*color:\s*#27323f;/)
    expect(styles).toMatch(/\.shopping-draft-row__input--placeholder\s*\{[\s\S]*color:\s*#9ca3af;/)
    expect(styles).toMatch(/\.shopping-draft-row__quantity-stepper\s*\{[\s\S]*height:\s*70rpx;/)
    expect(styles).toMatch(/\.shopping-draft-row__stepper-btn\s*\{[\s\S]*height:\s*70rpx;[\s\S]*background:\s*#f4f5f8;[\s\S]*color:\s*#4b5563;/)
    expect(styles).toMatch(/\.shopping-draft-row__stepper-input\s*\{[\s\S]*height:\s*70rpx;[\s\S]*color:\s*#27323f;/)
    expect(styles).toMatch(/\.shopping-modal__add-row\s*\{[\s\S]*color:\s*var\(--brand,/)
    expect(styles).toMatch(/\.shopping-modal__close\s*\{[\s\S]*background:\s*#f4f5f8;[\s\S]*color:\s*#111827;/)
  })
})
