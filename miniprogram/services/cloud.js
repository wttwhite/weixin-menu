function callCloud(name, data, options = {}) {
  if (
    typeof wx === 'undefined' ||
    !wx.cloud ||
    typeof wx.cloud.callFunction !== 'function'
  ) {
    throw new Error('当前微信版本不支持云函数调用，请升级微信后重试')
  }

  return wx.cloud.callFunction({
    name,
    data,
    config: options.config
  })
}

module.exports = {
  callCloud
}
