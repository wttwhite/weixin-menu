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

    expect(styles).toMatch(/\.tabbar-shell\s*\{[\s\S]*left:\s*0;/)
    expect(styles).toMatch(/\.tabbar-shell\s*\{[\s\S]*right:\s*0;/)
    expect(styles).toMatch(/\.tabbar-shell\s*\{[\s\S]*bottom:\s*0;/)
    expect(styles.includes('padding: 0 0 env(safe-area-inset-bottom);')).toBe(false)
    expect(styles.includes('border-radius: 32rpx;')).toBe(false)
    expect(styles).toMatch(/\.tabbar-surface\s*\{[\s\S]*padding:\s*14rpx 18rpx calc\(env\(safe-area-inset-bottom\) \+ 10rpx\);/)
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
          path: '/pages/statistics/index'
        }
      }
    })

    expect(switchTab).toHaveBeenCalledWith({
      url: '/pages/statistics/index'
    })
    expect(instance.data.selected).toBe('/pages/statistics/index')
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
