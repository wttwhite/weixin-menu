import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('space-members template', () => {
  it('shows the active space name in the hero and removes raw member ids from cards', () => {
    const template = readFileSync('miniprogram/pages/space-members/index.wxml', 'utf8')

    expect(template).toContain("{{activeSpaceName || '尚未选择空间'}}")
    expect(template.includes('{{activeSpaceId')).toBe(false)
    expect(template.includes('member-card__id')).toBe(false)
  })
})
