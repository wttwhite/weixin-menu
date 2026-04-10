import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('miniprogram app config', () => {
  it('registers pantry edit page for pantry create/edit navigation', () => {
    const raw = readFileSync('miniprogram/app.json', 'utf8')
    const appConfig = JSON.parse(raw)

    expect(Array.isArray(appConfig.pages)).toBe(true)
    expect(appConfig.pages).toContain('pages/pantry-edit/index')
  })
})
