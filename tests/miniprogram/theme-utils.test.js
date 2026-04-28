import { describe, expect, it } from 'vitest'
import { createStorage } from '../../miniprogram/utils/storage'
import {
  buildThemeStyle,
  getThemeOptions,
  resolveThemeKey
} from '../../miniprogram/utils/theme'

describe('theme utilities', () => {
  it('falls back to the default theme for unknown keys', () => {
    expect(resolveThemeKey('')).toBe('default')
    expect(resolveThemeKey('not-exists')).toBe('default')
    expect(resolveThemeKey('fresh-green')).toBe('fresh-green')
    expect(resolveThemeKey('tech-blue')).toBe('tech-blue')
  })

  it('serializes theme css variables for runtime page styling', () => {
    const style = buildThemeStyle('fresh-green')
    const techBlueStyle = buildThemeStyle('tech-blue')

    expect(style).toContain('--page-bg')
    expect(style).toContain('--brand')
    expect(style).toContain('--brand: #2e7d32;')
    expect(style).toContain('--brand-strong: #1b5e20;')
    expect(techBlueStyle).toContain('--hero-soft-start: #dcecff;')
  })

  it('exposes all selectable theme options and persists the chosen key in storage', () => {
    const options = getThemeOptions()
    const storage = createStorage()

    storage.setThemeKey('tech-blue')

    expect(options.map((item) => item.key)).toEqual([
      'default',
      'fresh-green',
      'amber',
      'tech-blue',
      'sea-salt-blue',
      'sakura-pink',
      'muted-gray-purple'
    ])
    expect(options[0].swatches).toHaveLength(3)
    expect(storage.getThemeKey()).toBe('tech-blue')
  })
})
