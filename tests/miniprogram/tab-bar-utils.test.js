import { describe, expect, it, vi } from 'vitest'
import { syncCurrentTabBar } from '../../miniprogram/utils/tab-bar'

describe('tab bar utilities', () => {
  it('refreshes the custom tab bar theme while syncing selected state', () => {
    const setSelected = vi.fn()
    const refreshTheme = vi.fn()
    const page = {
      getTabBar: () => ({
        setSelected,
        refreshTheme
      })
    }

    syncCurrentTabBar(page, '/pages/pantry/index')

    expect(setSelected).toHaveBeenCalledWith('/pages/pantry/index')
    expect(refreshTheme).toHaveBeenCalledTimes(1)
  })
})
