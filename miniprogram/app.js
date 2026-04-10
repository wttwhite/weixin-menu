const { envList } = require('./envList')

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
    session: null
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
  },

  setActiveSpaceId(activeSpaceId) {
    this.globalData.activeSpaceId = activeSpaceId || ''
  },

  setSession(session) {
    this.globalData.session = session || null
    this.setActiveSpaceId((session && session.activeSpaceId) || '')
  }
})
