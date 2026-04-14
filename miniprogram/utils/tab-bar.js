function switchToTab(url) {
  if (typeof wx !== 'undefined' && typeof wx.switchTab === 'function') {
    return wx.switchTab({ url })
  }

  if (typeof wx !== 'undefined' && typeof wx.reLaunch === 'function') {
    return wx.reLaunch({ url })
  }

  throw new Error('当前环境不支持 tabBar 页面跳转')
}

function syncCurrentTabBar(page, selectedPath) {
  if (!page || typeof page.getTabBar !== 'function') {
    return
  }

  const tabBar = page.getTabBar()
  if (!tabBar || typeof tabBar.setSelected !== 'function') {
    return
  }

  tabBar.setSelected(selectedPath)
}

module.exports = {
  switchToTab,
  syncCurrentTabBar
}
