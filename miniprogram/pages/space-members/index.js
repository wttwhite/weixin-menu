const { createMembersService } = require('../../services/members')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { decorateSpaceMembers } = require('../../utils/member-view')
const { syncPageTheme } = require('../../utils/theme')

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
    activeSpaceId: '',
    members: [],
    role: '',
    inviteCode: '',
    errorMessage: '',
    currentOpenid: ''
  },

  onShow() {
    syncPageTheme(this)
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
      const members = decorateSpaceMembers(result.members || [], currentOpenid)
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
      this.setData({
        members: (this.data.members || []).filter((item) => item && item.openid !== memberOpenid)
      })
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

  async handleEditMember(event) {
    const dataset = event && event.currentTarget ? event.currentTarget.dataset || {} : {}
    const memberOpenid = dataset.memberOpenid || ''
    const currentName = dataset.name || ''
    if (!memberOpenid || this.data.role !== 'owner' || typeof wx.showModal !== 'function') {
      return
    }

    const modal = await wx.showModal({
      title: '编辑成员昵称',
      editable: true,
      placeholderText: '输入新的成员昵称',
      content: currentName,
      confirmText: '保存'
    })
    if (!modal.confirm) {
      return
    }

    const displayName = typeof modal.content === 'string' ? modal.content.trim() : ''
    if (!displayName) {
      return
    }

    try {
      await createMembersService().updateMemberDisplayName(this.data.activeSpaceId, memberOpenid, displayName)
      this.setData({
        members: (this.data.members || []).map((item) => {
          if (!item || item.openid !== memberOpenid) {
            return item
          }
          return {
            ...item,
            name: displayName,
            displayName
          }
        })
      })
      wx.showToast({
        title: '成员昵称已更新',
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
