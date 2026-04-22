const { envList } = require('./envList')
const { createStorage } = require('./utils/storage')
const { buildThemeStyle, resolveThemeKey } = require('./utils/theme')

function resolveEnv() {
  const firstEnv = envList[0]
  if (firstEnv && typeof firstEnv.envId === 'string') {
    return firstEnv.envId
  }

  return ''
}

App({
  globalData: {
    env: resolveEnv(),
    activeSpaceId: '',
    themeKey: 'default',
    themeStyle: buildThemeStyle('default')
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('Please use WeChat base library 2.2.3 or above for cloud support')
      return
    }

    wx.cloud.init({
      env: this.globalData.env,
      traceUser: true
    })

    const storage = createStorage()
    const themeKey = resolveThemeKey(storage.getThemeKey())
    this.globalData.themeKey = themeKey
    this.globalData.themeStyle = buildThemeStyle(themeKey)
  },

  setActiveSpaceId(activeSpaceId) {
    this.globalData.activeSpaceId = activeSpaceId || ''
  },

  setTheme(themeKey) {
    const nextThemeKey = resolveThemeKey(themeKey)
    const storage = createStorage()
    storage.setThemeKey(nextThemeKey)
    this.globalData.themeKey = nextThemeKey
    this.globalData.themeStyle = buildThemeStyle(nextThemeKey)
    return {
      themeKey: nextThemeKey,
      themeStyle: this.globalData.themeStyle
    }
  }
})
