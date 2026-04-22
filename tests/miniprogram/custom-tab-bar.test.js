import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

function createComponentInstance(componentConfig) {
  const instance = {
    data: { ...(componentConfig.data || {}) },
    setData(nextData) {
      this.data = {
        ...this.data,
        ...nextData
      }
    }
  }

  Object.keys(componentConfig.methods || {}).forEach((key) => {
    instance[key] = componentConfig.methods[key].bind(instance)
  })

  if (
    componentConfig.lifetimes &&
    typeof componentConfig.lifetimes.attached === 'function'
  ) {
    componentConfig.lifetimes.attached.call(instance)
  }

  return instance
}

async function loadComponent() {
  let capturedComponent = null
  global.Component = (config) => {
    capturedComponent = config
  }

  await import('../../miniprogram/custom-tab-bar/index.js')
  return capturedComponent
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Component
  delete global.getCurrentPages
  delete global.wx
})

describe('custom tab bar', () => {
  it('uses a full-width docked layout instead of a floating inset shell', () => {
    const styles = readFileSync('miniprogram/custom-tab-bar/index.wxss', 'utf8')
    const template = readFileSync('miniprogram/custom-tab-bar/index.wxml', 'utf8')

    expect(styles).toMatch(/\.tabbar-shell\s*\{[\s\S]*left:\s*0;/)
    expect(styles).toMatch(/\.tabbar-shell\s*\{[\s\S]*right:\s*0;/)
    expect(styles).toMatch(/\.tabbar-shell\s*\{[\s\S]*bottom:\s*0;/)
    expect(template).toContain('tabbar-item__pill')
    expect(template).toContain('tabbar-item__glow')
    expect(styles).toContain('var(--surface-bg')
    expect(styles).toContain('var(--surface-muted')
    expect(styles).toContain('var(--brand')
    expect(styles).toContain('var(--brand-strong')
    expect(styles).toMatch(/\.tabbar-surface\s*\{[\s\S]*border-radius:\s*32rpx;/)
    expect(styles).toMatch(/\.tabbar-item__pill\s*\{[\s\S]*border-radius:\s*999rpx;/)
    expect(styles).toMatch(/\.tabbar-item--active[\s\S]*\.tabbar-item__pill/)
    expect(template.includes('selectedIconPath')).toBe(false)
  })

  it('selects the current tab from the active page route on attach', async () => {
    global.getCurrentPages = () => [
      {
        route: 'pages/shopping/index'
      }
    ]
    global.wx = {
      switchTab: vi.fn()
    }

    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig)

    expect(instance.data.selected).toBe('/pages/shopping/index')
  })

  it('switches tab when tapping another tab item', async () => {
    global.getCurrentPages = () => [
      {
        route: 'pages/recipes/index'
      }
    ]
    const switchTab = vi.fn()
    global.wx = {
      switchTab
    }

    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig)
    instance.handleSwitchTab({
      currentTarget: {
        dataset: {
          path: '/pages/profile/index'
        }
      }
    })

    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/profile/index'
    })
    expect(instance.data.selected).toBe('/pages/profile/index')
  })

  it('allows the current page to force-sync selected state explicitly', async () => {
    global.getCurrentPages = () => [
      {
        route: 'pages/recipes/index'
      }
    ]
    global.wx = {
      switchTab: vi.fn()
    }

    const componentConfig = await loadComponent()
    const instance = createComponentInstance(componentConfig)
    instance.setSelected('/pages/pantry/index')

    expect(instance.data.selected).toBe('/pages/pantry/index')
  })
})
