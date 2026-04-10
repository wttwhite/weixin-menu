const { createSessionService } = require('../../services/session')
const { getErrorMessage } = require('../../utils/error')
const { setActiveSpaceId } = require('../../utils/app-session')

Page({
  data: {
    inviteCode: '',
    submitting: false
  },

  handleCodeInput(event) {
    this.setData({
      inviteCode: (event.detail.value || '').toUpperCase()
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
      const result = await createSessionService().joinSpace(this.data.inviteCode)
      setActiveSpaceId(result.activeSpaceId)
      wx.showToast({
        title: '已加入空间',
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
