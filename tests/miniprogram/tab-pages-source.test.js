import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('tab pages source wiring', () => {
  const cases = [
    ['miniprogram/pages/recipes/index.js', "/pages/recipes/index"],
    ['miniprogram/pages/pantry/index.js', "/pages/pantry/index"],
    ['miniprogram/pages/meal-plans/index.js', "/pages/meal-plans/index"],
    ['miniprogram/pages/shopping/index.js', "/pages/shopping/index"],
    ['miniprogram/pages/statistics/index.js', "/pages/statistics/index"]
  ]

  it('syncs the custom tab bar selected state from each tab page onShow', () => {
    for (const [filePath, pagePath] of cases) {
      const source = readFileSync(filePath, 'utf8')
      expect(source.includes('syncCurrentTabBar')).toBe(true)
      expect(source.includes(`syncCurrentTabBar(this, '${pagePath}')`)).toBe(true)
    }
  })
})
