const { callCloud } = require('./cloud')
const { unwrapResponse } = require('./session')

function createBackupService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud

  return {
    async exportSpaceBackup(spaceId) {
      return unwrapResponse(
        await cloudCall('fileOps', {
          action: 'exportSpaceBackup',
          spaceId
        })
      )
    },

    async importSpaceBackup(spaceId, tempFileId) {
      return unwrapResponse(
        await cloudCall('fileOps', {
          action: 'importSpaceBackup',
          spaceId,
          tempFileId
        })
      )
    },

    async listBackupRecords(spaceId) {
      return unwrapResponse(
        await cloudCall('fileOps', {
          action: 'listBackupRecords',
          spaceId
        })
      )
    }
  }
}

module.exports = {
  createBackupService
}
