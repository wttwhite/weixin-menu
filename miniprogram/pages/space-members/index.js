const { createMembersService } = require('../../services/members')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

function decorateMembers(members = [], openid = '') {
  return (members || []).map((member) => ({
    ...member,
    id: member.openid || member._id || '',
    name: member.nickName || member.name || member.openid || '匿名成员',
    roleLabel: member.role === 'owner' ? '创建者' : '成员',
    isCurrentUser: member.openid === openid
  }))
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    members: [],
    role: '',
    inviteCode: '',
    errorMessage: '',
    currentOpenid: ''
  },

  onShow() {
    this.loadMembers()
  },

  async onPullDownRefresh() {
    await this.loadMembers()
    wx.stopPullDownRefresh()
  },

  async loadMembers() {
    const requestedSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId: requestedSpaceId,
      currentOpenid: ''
    })

    if (!requestedSpaceId) {
      this.setData({
        loading: false,
        members: [],
        role: '',
        inviteCode: ''
      })
      return
    }

    try {
      const session = await createMembersService().bootstrapSession(requestedSpaceId)
      const resolvedSpaceId = session.activeSpaceId || requestedSpaceId
      const currentOpenid = session.openid || ''
      const result = await createMembersService().listMembers(resolvedSpaceId)
      const members = decorateMembers(result.members || [], currentOpenid)
      const activeSpace = (session.spaces || []).find((item) => item.spaceId === resolvedSpaceId || item.id === resolvedSpaceId)
      const app = typeof getApp === 'function' ? getApp() : null
      if (app && typeof app.setActiveSpaceId === 'function') {
        app.setActiveSpaceId(resolvedSpaceId)
      }
      this.setData({
        loading: false,
        activeSpaceId: resolvedSpaceId,
        members,
        role: session.role || '',
        inviteCode: (activeSpace && activeSpace.inviteCode) || '',
        currentOpenid
      })
    } catch (error) {
      this.setData({
        loading: false,
        errorMessage: getErrorMessage(error),
        members: [],
        role: '',
        inviteCode: ''
      })
    }
  },

  async handleRemoveMember(event) {
    const memberOpenid = event.currentTarget.dataset.memberOpenid
    if (!memberOpenid || this.data.role !== 'owner') {
      return
    }

    const modal = await wx.showModal({
      title: '移除成员',
      content: '移除后该成员将失去当前空间访问权限，确认继续？',
      confirmColor: '#b44343'
    })
    if (!modal.confirm) {
      return
    }

    try {
      await createMembersService().removeMember(this.data.activeSpaceId, memberOpenid)
      await this.loadMembers()
      wx.showToast({
        title: '成员已移除',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async handleRotateInviteCode() {
    if (this.data.role !== 'owner') {
      return
    }

    try {
      const result = await createMembersService().rotateInviteCode(this.data.activeSpaceId)
      this.setData({
        inviteCode: result.inviteCode || ''
      })
      wx.showToast({
        title: '邀请码已刷新',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  }
})
