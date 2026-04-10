function getAppSafe() {
  if (typeof getApp !== 'function') {
    return null
  }

  return getApp()
}

function getActiveSpaceId() {
  const app = getAppSafe()
  if (!app || !app.globalData) {
    return ''
  }

  return app.globalData.activeSpaceId || ''
}

function setActiveSpaceId(activeSpaceId) {
  const app = getAppSafe()
  if (!app || typeof app.setActiveSpaceId !== 'function') {
    return ''
  }

  app.setActiveSpaceId(activeSpaceId || '')
  return activeSpaceId || ''
}

module.exports = {
  getActiveSpaceId,
  setActiveSpaceId
}
