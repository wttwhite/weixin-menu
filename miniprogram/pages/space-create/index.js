const { createSessionService } = require('../../services/session')
const { getErrorMessage } = require('../../utils/error')
const { setActiveSpaceId } = require('../../utils/app-session')

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

    this.setData({
      submitting: true
    })

    try {
      const result = await createSessionService().createSpace(this.data.name)
      setActiveSpaceId(result.activeSpaceId)
      wx.showToast({
        title: '空间创建成功',
        icon: 'success'
      })
      wx.reLaunch({
        url: '/pages/recipes/index'
      })
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
