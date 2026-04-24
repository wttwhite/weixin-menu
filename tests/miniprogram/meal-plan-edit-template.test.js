import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('meal-plan edit template', () => {
  it('renders grouped editor cards with searchable recipe selection and fixed footer actions', () => {
    const template = readFileSync('miniprogram/pages/meal-plan-edit/index.wxml', 'utf8')
    const styles = readFileSync('miniprogram/pages/meal-plan-edit/index.wxss', 'utf8')

    expect(template).toContain('meal-plan-editor')
    expect(template).toContain('editor-section')
    expect(template).toContain('recipe-search')
    expect(template).toContain('recipe-selector__overlay')
    expect(template).toContain('bindinput="handleRecipeSearchInput"')
    expect(template).toContain('bindtap="openRecipeSelector"')
    expect(template).toContain('bindtap="handleRecipeOptionSelect"')
    expect(template).toContain('bottom-actions')
    expect(styles).toMatch(/\.meal-plan-edit-page\s*\{[\s\S]*background:/)
    expect(styles).toMatch(/\.editor-section,\s*\.state-card\s*\{[\s\S]*border-radius:\s*3\d+rpx;/)
    expect(styles).toMatch(/\.bottom-actions\s*\{[\s\S]*position:\s*fixed;/)
  })
})
