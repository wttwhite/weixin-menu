const { createSessionService } = require('../../services/session')
const { getErrorMessage } = require('../../utils/error')
const { setActiveSpaceId } = require('../../utils/app-session')
const { switchToTab } = require('../../utils/tab-bar')

Page({
  data: {
    name: '',
    submitting: false
  },

  handleNameInput(event) {
    this.setData({
      name: event.detail.value
    })
  },

  async submit() {
    if (this.data.submitting) {
      return
    }

    const name = (this.data.name || '').trim()
    if (!name) {
      wx.showToast({
        title: '请输入空间名称',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const result = await createSessionService().createSpace(name)
      setActiveSpaceId(result.activeSpaceId)
      wx.showToast({
        title: '空间创建成功',
        icon: 'success'
      })
      await switchToTab('/pages/recipes/index')
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        submitting: false
      })
    }
  }
})
