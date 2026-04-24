import { beforeEach, describe, expect, it, vi } from 'vitest'

function createPageInstance(pageConfig) {
  const instance = {
    data: { ...(pageConfig.data || {}) },
    setData(nextData) {
      this.data = {
        ...this.data,
        ...nextData
      }
    }
  }

  Object.keys(pageConfig).forEach((key) => {
    if (key === 'data' || typeof pageConfig[key] !== 'function') {
      return
    }
    instance[key] = pageConfig[key].bind(instance)
  })

  return instance
}

async function loadPage(modulePath) {
  let capturedPage = null
  global.Page = (config) => {
    capturedPage = config
  }

  await import(modulePath)
  return createPageInstance(capturedPage)
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Page
  delete global.wx
  delete global.getApp
})

describe('statistics page flow', () => {
  it('builds richer derived metrics and insight cards from the dashboard payload', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          recipeCount: 12,
          pantryCount: 20,
          upcomingExpirations: 3,
          shoppingProgress: {
            total: 5,
            checked: 2,
            percent: 40
          },
          memberCount: 2,
          recentBackup: {
            status: 'available',
            updatedAt: '2026-04-21 10:00'
          }
        }
      }
    })
    const navigateTo = vi.fn()
    global.wx = {
      cloud: { callFunction },
      navigateTo,
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1',
        themeKey: 'default',
        themeStyle: '--page-bg: #f5f1e8;'
      }
    })

    const page = await loadPage('../../miniprogram/pages/statistics/index.js')
    await page.onShow()
    await flushAsyncWork()

    expect(page.data.overviewCards).toEqual([
      expect.objectContaining({ key: 'recipes', valueText: '12', label: '菜谱总数' }),
      expect.objectContaining({ key: 'pantry', valueText: '20', label: '库存总量' }),
      expect.objectContaining({ key: 'expiring', valueText: '3', label: '临期库存' }),
      expect.objectContaining({ key: 'shoppingPending', valueText: '3', label: '待采购项' }),
      expect.objectContaining({ key: 'shoppingDone', valueText: '2', label: '已完成采购' }),
      expect.objectContaining({ key: 'members', valueText: '2', label: '空间成员' })
    ])
    expect(page.data.heroSummaryText).toBe('当前空间共有 6 项核心指标可快速查看。')
    expect(page.data.shoppingProgressTitle).toBe('采购执行进度')
    expect(page.data.shoppingProgressMetaText).toBe('2 / 5 项已完成')
    expect(page.data.shoppingProgressWidthStyle).toBe('width: 40%;')
    expect(page.data.insightItems).toEqual([
      expect.objectContaining({ key: 'backup', valueText: '2026-04-21 10:00' }),
      expect.objectContaining({ key: 'expiringRate', valueText: '15%' }),
      expect.objectContaining({ key: 'collaboration', valueText: '2 人协作' })
    ])

    page.openMembers()
    page.openBackup()

    expect(navigateTo).toHaveBeenNthCalledWith(1, {
      url: '/pages/space-members/index'
    })
    expect(navigateTo).toHaveBeenNthCalledWith(2, {
      url: '/pages/backup/index'
    })
  })
})
