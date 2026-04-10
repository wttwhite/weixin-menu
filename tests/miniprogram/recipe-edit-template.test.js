import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('recipe edit template', () => {
  it('includes recommendationScore field in form controls', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('data-field="recommendationScore"')).toBe(true)
  })

  it('does not expose inline global tag-delete controls in recipe editor chips', () => {
    const template = readFileSync('miniprogram/pages/recipe-edit/index.wxml', 'utf8')
    expect(template.includes('bindremove="deleteTag"')).toBe(false)
    expect(template.includes('removable="{{true}}"')).toBe(false)
  })
})
