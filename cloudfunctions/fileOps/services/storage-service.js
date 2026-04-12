function createStorageService(options = {}) {
  const cloudSdk = options.cloudSdk || require('wx-server-sdk')

  return {
    async downloadFile(fileId) {
      if (!fileId) {
        return Buffer.alloc(0)
      }
      const result = await cloudSdk.downloadFile({
        fileID: fileId
      })
      if (result && result.fileContent) {
        return Buffer.from(result.fileContent)
      }
      return Buffer.alloc(0)
    },

    async uploadBuffer({ cloudPath, buffer }) {
      const result = await cloudSdk.uploadFile({
        cloudPath,
        fileContent: buffer
      })
      return {
        fileId: result.fileID,
        cloudPath
      }
    },

    async deleteFile(fileId) {
      if (!fileId) {
        return
      }
      await cloudSdk.deleteFile({
        fileList: [fileId]
      })
    }
  }
}

module.exports = {
  createStorageService
}
