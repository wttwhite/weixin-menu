const { callCloud } = require('./cloud')
const { unwrapResponse } = require('./session')

function createMembersService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async bootstrapSession(preferredSpaceId = '') {
      return unwrapResponse(
        await cloudCall('memberOps', {
          action: 'bootstrap',
          preferredSpaceId
        })
      )
    },

    async initCollections() {
      return unwrapResponse(
        await cloudCall('memberOps', {
          action: 'initCollections'
        })
      )
    },

    async listMembers(spaceId) {
      return unwrapResponse(
        await cloudCall('memberOps', {
          action: 'listMembers',
          spaceId
        })
      )
    },

    async removeMember(spaceId, memberOpenid) {
      return unwrapResponse(
        await cloudCall('memberOps', {
          action: 'removeMember',
          spaceId,
          memberOpenid
        })
      )
    },

    async rotateInviteCode(spaceId) {
      return unwrapResponse(
        await cloudCall('memberOps', {
          action: 'rotateInviteCode',
          spaceId
        })
      )
    }
  }
}

module.exports = {
  createMembersService
}
