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

  it('reads mapped messages from the error.result shape', () => {
    expect(
      getErrorMessage({
        result: {
          code: 401,
          message: 'Missing current user'
        }
      })
    ).toBe('当前登录状态已失效，请重新进入小程序')
  })

  it('maps code-only not-found errors to Chinese copy', () => {
    expect(
      getErrorMessage({
        code: 404
      })
    ).toBe('没有找到对应的数据')
  })
})
