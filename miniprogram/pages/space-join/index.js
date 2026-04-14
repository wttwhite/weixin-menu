const { createSessionService } = require('../../services/session')
const { getErrorMessage } = require('../../utils/error')
const { setActiveSpaceId } = require('../../utils/app-session')
const { switchToTab } = require('../../utils/tab-bar')

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

    const inviteCode = (this.data.inviteCode || '').trim().toUpperCase()
    if (!inviteCode) {
      wx.showToast({
        title: '请输入空间邀请码',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const result = await createSessionService().joinSpace(inviteCode)
      setActiveSpaceId(result.activeSpaceId)
      wx.showToast({
        title: '已加入空间',
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
