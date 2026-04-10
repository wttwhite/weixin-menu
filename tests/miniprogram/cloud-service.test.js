import { describe, expect, it, vi } from 'vitest'
import { callCloud } from '../../miniprogram/services/cloud'

describe('callCloud', () => {
  it('calls wx.cloud.callFunction when available', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: { code: 0, data: { ok: true } }
    })
    global.wx = {
      cloud: {
        callFunction
      }
    }

    await callCloud('memberOps', { action: 'bootstrap' })

    expect(callFunction).toHaveBeenCalledWith({
      name: 'memberOps',
      data: { action: 'bootstrap' },
      config: undefined
    })

    delete global.wx
  })

  it('fails fast when cloud callFunction capability is unavailable', async () => {
    global.wx = {}

    expect(() => callCloud('memberOps', { action: 'bootstrap' })).toThrow(
      '当前微信版本不支持云函数调用，请升级微信后重试'
    )

    delete global.wx
  })
})
