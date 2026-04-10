import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '../../miniprogram/utils/error'

describe('getErrorMessage', () => {
  it('turns SPACE_FORBIDDEN into a user-facing Chinese message', () => {
    expect(
      getErrorMessage({
        code: 403,
        message: 'SPACE_FORBIDDEN'
      })
    ).toBe('你没有权限访问这个空间')
  })

  it('falls back to the original message when there is no mapping', () => {
    expect(
      getErrorMessage({
        code: 1,
        message: 'Something failed'
      })
    ).toBe('Something failed')
  })
})
