const ACTIVE_SPACE_ID_KEY = 'activeSpaceId'
const fallbackStorage = {}

function hasWxStorage() {
  return typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
}

function getStorageSync(key) {
  if (hasWxStorage()) {
    return wx.getStorageSync(key)
  }

  return fallbackStorage[key]
}

function setStorageSync(key, value) {
  if (hasWxStorage()) {
    wx.setStorageSync(key, value)
    return
  }

  fallbackStorage[key] = value
}

function removeStorageSync(key) {
  if (hasWxStorage()) {
    wx.removeStorageSync(key)
    return
  }

  delete fallbackStorage[key]
}

function createStorage() {
  return {
    getActiveSpaceId() {
      return getStorageSync(ACTIVE_SPACE_ID_KEY) || ''
    },
    setActiveSpaceId(activeSpaceId) {
      if (activeSpaceId) {
        setStorageSync(ACTIVE_SPACE_ID_KEY, activeSpaceId)
        return activeSpaceId
      }

      removeStorageSync(ACTIVE_SPACE_ID_KEY)
      return ''
    },
    clearActiveSpaceId() {
      removeStorageSync(ACTIVE_SPACE_ID_KEY)
    }
  }
}

module.exports = {
  ACTIVE_SPACE_ID_KEY,
  createStorage
}
