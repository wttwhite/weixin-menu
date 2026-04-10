let hasInitialized = false

function getCloudSdk(cloudSdk) {
  return cloudSdk || require('wx-server-sdk')
}

function ensureCloudInit(cloudSdk) {
  if (hasInitialized) {
    return
  }

  cloudSdk.init({
    env: cloudSdk.DYNAMIC_CURRENT_ENV
  })
  hasInitialized = true
}

function createContext(event = {}, options = {}) {
  if (options.skipCloudInit) {
    return {
      openid: event.openid || '',
      appid: '',
      unionid: '',
      preferredSpaceId: event.preferredSpaceId || null
    }
  }

  const cloudSdk = getCloudSdk(options.cloudSdk)
  ensureCloudInit(cloudSdk)
  const wxContext = options.wxContext || cloudSdk.getWXContext()

  return {
    openid: wxContext.OPENID || event.openid || '',
    appid: wxContext.APPID || '',
    unionid: wxContext.UNIONID || '',
    preferredSpaceId: event.preferredSpaceId || null
  }
}

module.exports = {
  createContext,
  ensureCloudInit
}
