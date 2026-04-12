function createStorageService(options = {}) {
  const cloudSdk = options.cloudSdk || require('wx-server-sdk')

  return {
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
