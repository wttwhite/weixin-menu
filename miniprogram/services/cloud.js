function callCloud(name, data, options = {}) {
  return wx.cloud.callFunction({
    name,
    data,
    config: options.config
  })
}

module.exports = {
  callCloud
}
