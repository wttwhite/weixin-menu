function normalizePath(path = '') {
  if (typeof path !== 'string') {
    return ''
  }

  return path.startsWith('/') ? path : `/${path}`
}

function resolveCurrentPath() {
  if (typeof getCurrentPages !== 'function') {
    return ''
  }

  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  return currentPage && currentPage.route ? normalizePath(currentPage.route) : ''
}

Component({
  data: {
    selected: '',
    themeStyle: '',
    list: [
      {
        pagePath: '/pages/recipes/index',
        text: '菜谱',
        iconPath: '/images/icons/home.png',
        selectedIconPath: '/images/icons/home-active.png'
      },
      {
        pagePath: '/pages/pantry/index',
        text: '库存',
        iconPath: '/images/icons/goods.png',
        selectedIconPath: '/images/icons/goods-active.png'
      },
      {
        pagePath: '/pages/meal-plans/index',
        text: '计划',
        iconPath: '/images/icons/examples.png',
        selectedIconPath: '/images/icons/examples-active.png'
      },
      {
        pagePath: '/pages/shopping/index',
        text: '采购',
        iconPath: '/images/icons/business.png',
        selectedIconPath: '/images/icons/business-active.png'
      },
      {
        pagePath: '/pages/profile/index',
        text: '我的',
        iconPath: '/images/icons/usercenter.png',
        selectedIconPath: '/images/icons/usercenter-active.png'
      }
    ]
  },

  lifetimes: {
    attached() {
      this.syncThemeFromApp()
      this.syncSelectedFromRoute()
    }
  },

  pageLifetimes: {
    show() {
      this.syncThemeFromApp()
      this.syncSelectedFromRoute()
    }
  },

  methods: {
    setSelected(path) {
      this.setData({
        selected: normalizePath(path)
      })
    },

    syncSelectedFromRoute() {
      this.setSelected(resolveCurrentPath())
    },

    syncThemeFromApp() {
      const app = typeof getApp === 'function' ? getApp() : null
      this.setData({
        themeStyle: app && app.globalData ? app.globalData.themeStyle || '' : ''
      })
    },

    refreshTheme() {
      this.syncThemeFromApp()
    },

    handleSwitchTab(event) {
      const path = normalizePath(event.currentTarget.dataset.path || '')
      if (!path || path === this.data.selected) {
        return
      }

      this.setSelected(path)

      if (typeof wx !== 'undefined' && typeof wx.switchTab === 'function') {
        wx.switchTab({
          url: path
        })
      }
    }
  }
})
