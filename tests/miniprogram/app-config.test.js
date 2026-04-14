import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('miniprogram app config', () => {
  it('registers pantry edit page for pantry create/edit navigation', () => {
    const raw = readFileSync('miniprogram/app.json', 'utf8')
    const appConfig = JSON.parse(raw)

    expect(Array.isArray(appConfig.pages)).toBe(true)
    expect(appConfig.pages).toContain('pages/pantry-edit/index')
  })

  it('defines a five-item tabBar for the main business pages', () => {
    const raw = readFileSync('miniprogram/app.json', 'utf8')
    const appConfig = JSON.parse(raw)

    expect(appConfig.tabBar).toBeTruthy()
    expect(appConfig.tabBar.custom).toBe(true)
    expect(Array.isArray(appConfig.tabBar.list)).toBe(true)
    expect(appConfig.tabBar.list.map((item) => item.pagePath)).toEqual([
      'pages/recipes/index',
      'pages/pantry/index',
      'pages/meal-plans/index',
      'pages/shopping/index',
      'pages/statistics/index'
    ])
  })
})
