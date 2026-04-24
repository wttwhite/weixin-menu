const { createStatisticsService } = require('../../services/statistics')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncCurrentTabBar } = require('../../utils/tab-bar')
const { syncPageTheme } = require('../../utils/theme')

function normalizeCount(value = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function buildHeroSummaryText() {
  return '当前空间共有 6 项核心指标可快速查看。'
}

function buildHeroChipItems(dashboard = {}) {
  return [
    {
      key: 'recipes',
      label: '菜谱',
      valueText: String(normalizeCount(dashboard.recipeCount))
    },
    {
      key: 'pantry',
      label: '库存',
      valueText: String(normalizeCount(dashboard.pantryCount))
    },
    {
      key: 'members',
      label: '成员',
      valueText: String(normalizeCount(dashboard.memberCount))
    }
  ]
}

function buildOverviewCards(dashboard = {}) {
  const recipeCount = normalizeCount(dashboard.recipeCount)
  const pantryCount = normalizeCount(dashboard.pantryCount)
  const upcomingExpirations = normalizeCount(dashboard.upcomingExpirations)
  const shoppingTotal = normalizeCount(dashboard.shoppingProgress && dashboard.shoppingProgress.total)
  const shoppingChecked = normalizeCount(dashboard.shoppingProgress && dashboard.shoppingProgress.checked)
  const memberCount = normalizeCount(dashboard.memberCount)

  return [
    { key: 'recipes', label: '菜谱总数', valueText: String(recipeCount), metaText: '当前空间菜谱存量' },
    { key: 'pantry', label: '库存总量', valueText: String(pantryCount), metaText: '全部库存条目' },
    { key: 'expiring', label: '临期库存', valueText: String(upcomingExpirations), metaText: '未来 3 天需关注' },
    { key: 'shoppingPending', label: '待采购项', valueText: String(Math.max(shoppingTotal - shoppingChecked, 0)), metaText: '仍需采购处理' },
    { key: 'shoppingDone', label: '已完成采购', valueText: String(shoppingChecked), metaText: '已勾选采购项' },
    { key: 'members', label: '空间成员', valueText: String(memberCount), metaText: '当前协作人数' }
  ]
}

function buildShoppingProgressView(dashboard = {}) {
  const total = normalizeCount(dashboard.shoppingProgress && dashboard.shoppingProgress.total)
  const checked = normalizeCount(dashboard.shoppingProgress && dashboard.shoppingProgress.checked)
  const percent = normalizeCount(dashboard.shoppingProgress && dashboard.shoppingProgress.percent)
  return {
    title: '采购执行进度',
    metaText: `${checked} / ${total} 项已完成`,
    percentText: `${percent}%`,
    widthStyle: `width: ${percent}%;`
  }
}

function buildInsightItems(dashboard = {}) {
  const pantryCount = normalizeCount(dashboard.pantryCount)
  const upcomingExpirations = normalizeCount(dashboard.upcomingExpirations)
  const memberCount = normalizeCount(dashboard.memberCount)
  const recentBackup = dashboard.recentBackup || {}
  const expiringRate = pantryCount > 0 ? Math.round((upcomingExpirations / pantryCount) * 100) : 0

  return [
    {
      key: 'backup',
      label: '最近备份',
      valueText: recentBackup.status === 'available' ? recentBackup.updatedAt || '最近已备份' : '暂无备份',
      descText: recentBackup.status === 'available' ? '建议继续保持周期性备份。' : '建议尽快创建首个备份。'
    },
    {
      key: 'expiringRate',
      label: '临期占比',
      valueText: `${expiringRate}%`,
      descText: upcomingExpirations ? `共有 ${upcomingExpirations} 项库存需要近期处理。` : '当前没有临期库存压力。'
    },
    {
      key: 'collaboration',
      label: '协作状态',
      valueText: `${memberCount} 人协作`,
      descText: memberCount > 1 ? '空间内已有多人共同维护数据。' : '目前主要由单人维护。'
    }
  ]
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
    activeSpaceId: '',
    errorMessage: '',
    dashboard: {
      recipeCount: 0,
      pantryCount: 0,
      upcomingExpirations: 0,
      shoppingProgress: {
        total: 0,
        checked: 0,
        percent: 0
      },
      memberCount: 0,
      recentBackup: {
        status: 'not-available',
        updatedAt: ''
      }
    },
    heroSummaryText: buildHeroSummaryText(),
    heroChipItems: buildHeroChipItems(),
    overviewCards: buildOverviewCards(),
    shoppingProgressTitle: '采购执行进度',
    shoppingProgressMetaText: '0 / 0 项已完成',
    shoppingProgressPercentText: '0%',
    shoppingProgressWidthStyle: 'width: 0%;',
    insightItems: buildInsightItems()
  },

  onShow() {
    syncPageTheme(this)
    syncCurrentTabBar(this, '/pages/statistics/index')
    return this.loadDashboard()
  },

  async onPullDownRefresh() {
    await this.loadDashboard()
    wx.stopPullDownRefresh()
  },

  async loadDashboard() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false
      })
      return
    }

    try {
      const dashboard = await createStatisticsService().getStatisticsDashboard(activeSpaceId)
      const shoppingProgressView = buildShoppingProgressView(dashboard)
      this.setData({
        loading: false,
        dashboard,
        heroSummaryText: buildHeroSummaryText(dashboard),
        heroChipItems: buildHeroChipItems(dashboard),
        overviewCards: buildOverviewCards(dashboard),
        shoppingProgressTitle: shoppingProgressView.title,
        shoppingProgressMetaText: shoppingProgressView.metaText,
        shoppingProgressPercentText: shoppingProgressView.percentText,
        shoppingProgressWidthStyle: shoppingProgressView.widthStyle,
        insightItems: buildInsightItems(dashboard)
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getErrorMessage(error)
      })
    }
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  },

  openMembers() {
    wx.navigateTo({
      url: '/pages/space-members/index'
    })
  },

  openBackup() {
    wx.navigateTo({
      url: '/pages/backup/index'
    })
  }
})
