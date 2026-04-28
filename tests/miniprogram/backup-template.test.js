import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('backup page template', () => {
  it('uses a user-facing backup title instead of rendering the raw space id', () => {
    const template = readFileSync('miniprogram/pages/backup/index.wxml', 'utf8')

    expect(template).toContain('数据备份')
    expect(template.includes('{{activeSpaceId')).toBe(false)
  })
})
