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
  })

  it('serializes theme css variables for runtime page styling', () => {
    const style = buildThemeStyle('fresh-green')

    expect(style).toContain('--page-bg')
    expect(style).toContain('--brand')
    expect(style).toContain('#56a36c')
  })

  it('exposes three selectable theme options and persists the chosen key in storage', () => {
    const options = getThemeOptions()
    const storage = createStorage()

    storage.setThemeKey('amber')

    expect(options.map((item) => item.key)).toEqual(['default', 'fresh-green', 'amber'])
    expect(storage.getThemeKey()).toBe('amber')
  })
})
