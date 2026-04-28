import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

function createComponentInstance(componentConfig, initialProps = {}) {
  const compositeObserver =
    componentConfig.observers &&
    componentConfig.observers['visible, value, categoryOptions, locationOptions']

  const syncCompositeObserver = function () {
    if (typeof compositeObserver !== 'function') {
      return
    }
    compositeObserver.call(
      this,
      this.properties.visible,
      this.properties.value,
      this.properties.categoryOptions,
      this.properties.locationOptions
    )
  }

  const instance = {
    data: {
      ...(componentConfig.data || {}),
      ...initialProps
    },
    properties: {
      visible: false,
      title: '添加库存',
      submitLabel: '添加库存',
      submitting: false,
      value: {},
      categoryOptions: ['未设置'],
      locationOptions: ['未设置'],
      ...initialProps
    },
    triggered: [],
    setData(nextData) {
      this.data = {
        ...this.data,
        ...nextData
      }
    },
    triggerEvent(name, detail) {
      this.triggered.push({ name, detail })
    },
    setProperty(key, value) {
      this.properties[key] = value
      this.data = {
        ...this.data,
        [key]: value
      }
      syncCompositeObserver.call(this)
    }
  }

  Object.keys(componentConfig.methods || {}).forEach((key) => {
    instance[key] = componentConfig.methods[key].bind(instance)
  })

  syncCompositeObserver.call(instance)
  return instance
}

async function loadComponent() {
  let capturedComponent = null
  global.Component = (config) => {
    capturedComponent = config
  }

  await import('../../miniprogram/components/pantry-form-modal/index.js')
  return capturedComponent
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Component
  delete global.wx
})

describe('pantry form modal', () => {
  it('uses a recipe-style category selector and fixed header structure', () => {
    const template = readFileSync('miniprogram/components/pantry-form-modal/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/components/pantry-form-modal/index.wxss', 'utf8')
    const arrowMatches = template.match(/category-picker__arrow/g) || []

    expect(template).toContain('pantry-form-modal__header')
    expect(template).toContain('pantry-form-modal__body')
    expect(template).toContain('pantry-form-modal__footer')
    expect(template).toContain('bindtap="openCategorySelector"')
    expect(template).toContain('showCategorySelector')
    expect(template).toContain('选择食材分类')
    expect(arrowMatches).toHaveLength(1)
    expect(styles).toMatch(/\.pantry-form-modal__overlay\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/)
    expect(styles).toMatch(/\.pantry-form-modal\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/)
    expect(styles).toMatch(/\.pantry-form-modal\s*\{[\s\S]*overflow:\s*hidden;/)
    expect(styles).toMatch(/\.pantry-form-modal__title\s*\{[\s\S]*font-size:\s*34rpx;/)
    expect(styles).toMatch(/\.pantry-form-modal__body\s*\{[\s\S]*flex:\s*1;[\s\S]*min-height:\s*0;/)
    expect(styles).toMatch(/\.pantry-form-modal__footer\s*\{[\s\S]*position:\s*relative;[\s\S]*left:\s*auto;[\s\S]*right:\s*auto;[\s\S]*bottom:\s*auto;/)
    expect(styles).toMatch(/\.category-selector__title,\s*\.unit-selector__title\s*\{[\s\S]*font-size:\s*34rpx;/)
  })

  it('keeps modal actions above the tab bar and gives nested selectors close buttons', () => {
    const template = readFileSync('miniprogram/components/pantry-form-modal/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/components/pantry-form-modal/index.wxss', 'utf8')

    expect(template).toContain('pantry-form-modal__close-icon')
    expect(template).toContain('class="category-selector__close" bindtap="closeCategorySelector"')
    expect(template).toContain('class="unit-selector__close" bindtap="closeUnitSelector"')
    expect(template).toMatch(/field-clear field-clear--inline[\s\S]*category-picker__arrow/)
    expect(styles).toMatch(/\.pantry-form-modal__overlay\s*\{[\s\S]*padding:\s*72rpx 20rpx calc\(env\(safe-area-inset-bottom\) \+ 150rpx\);/)
    expect(styles).toMatch(/\.pantry-form-modal__body\s*\{[\s\S]*height:\s*100%;/)
    expect(styles).toMatch(/\.pantry-form-modal__title\s*\{[\s\S]*font-size:\s*34rpx;/)
    expect(styles).toMatch(/\.category-selector__title,\s*\.unit-selector__title\s*\{[\s\S]*font-size:\s*34rpx;/)
    expect(styles).toMatch(/\.category-selector__item--active\s*\{[\s\S]*background:\s*var\(--surface-muted,\s*#f3f4f7\);/)
  })

  it('uses one consistent 10rpx top gap for pantry form controls', () => {
    const styles = readFileSync('miniprogram/components/pantry-form-modal/index.wxss', 'utf8')

    expect(styles).toMatch(/\.field-picker-row\s*\{[\s\S]*margin-top:\s*10rpx;/)
    expect(styles).toMatch(/\.field-picker-row\s+\.field-input,\s*\.field-picker-row\s+\.date-row__picker,\s*\.field-picker-row\s+\.category-picker__value\s*\{[\s\S]*margin-top:\s*0;/)
  })

  it('opens category selector from the field and emits selected category back to the page', async () => {
    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig, {
      visible: true,
      value: {
        name: 'Milk',
        category: 'dairy'
      },
      categoryOptions: ['未设置', 'dairy', 'dry'],
      locationOptions: ['未设置', 'fridge']
    })

    instance.openCategorySelector()
    expect(instance.data.showCategorySelector).toBe(true)
    expect(instance.data.categorySelectorItems).toEqual([
      expect.objectContaining({ label: 'dairy' }),
      expect.objectContaining({ label: 'dry' })
    ])

    instance.handleCategoryOptionTap({
      currentTarget: {
        dataset: {
          name: 'dry'
        }
      }
    })

    expect(instance.data.showCategorySelector).toBe(false)
    expect(instance.data.form.category).toBe('dry')
    expect(instance.triggered).toContainEqual({
      name: 'change',
      detail: {
        form: expect.objectContaining({
          category: 'dry'
        })
      }
    })
  })

  it('uses 0.5 quantity steps and supports quick-select plus custom unit input', async () => {
    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig, {
      visible: true,
      value: {
        name: 'Milk',
        quantity: '1',
        unit: ''
      },
      categoryOptions: ['未设置', 'dairy'],
      locationOptions: ['未设置', 'fridge']
    })

    instance.decrementQuantity()
    expect(instance.data.form.quantity).toBe('0.5')

    instance.incrementQuantity()
    expect(instance.data.form.quantity).toBe('1')

    instance.openUnitSelector()
    expect(instance.data.showUnitSelector).toBe(true)
    expect(instance.data.unitOptionItems).toEqual([
      expect.objectContaining({ label: '盒' }),
      expect.objectContaining({ label: '瓶' }),
      expect.objectContaining({ label: '袋' }),
      expect.objectContaining({ label: '包' })
    ])

    instance.handleUnitOptionTap({
      currentTarget: {
        dataset: {
          unit: '瓶'
        }
      }
    })
    expect(instance.data.form.unit).toBe('瓶')
    expect(instance.data.showUnitSelector).toBe(false)

    instance.openUnitSelector()
    instance.handleUnitDraftInput({
      detail: {
        value: '公斤'
      }
    })
    instance.confirmUnitSelector()

    expect(instance.data.form.unit).toBe('公斤')
    expect(instance.data.showUnitSelector).toBe(false)
    expect(instance.triggered).toContainEqual({
      name: 'change',
      detail: {
        form: expect.objectContaining({
          quantity: '1',
          unit: '公斤'
        })
      }
    })
  })
})
