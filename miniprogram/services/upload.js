const { callCloud } = require('./cloud')

function unwrapResponse(response) {
  const result = response && response.result ? response.result : response
  if (!result || typeof result.code !== 'number') {
    return result || {}
  }

  if (result.code !== 0) {
    const error = new Error(result.message || 'Request failed')
    error.code = result.code
    error.data = result.data || null
    throw error
  }

  return result.data || {}
}

function defaultUploadFile(payload) {
  if (
    typeof wx === 'undefined' ||
    !wx.cloud ||
    typeof wx.cloud.uploadFile !== 'function'
  ) {
    throw new Error('当前微信版本不支持上传，请升级微信后重试')
  }

  return wx.cloud.uploadFile(payload)
}

async function safeDiscard(cloudCall, payload) {
  try {
    await cloudCall('fileOps', {
      action: 'discardRecipeImage',
      ...payload
    })
  } catch (error) {
    void error
  }
}

function createUploadService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud
  const uploadFile = dependencies.uploadFile || defaultUploadFile

  return {
    async uploadRecipeImage(params = {}) {
      const preparePayload = {
        action: 'prepareRecipeImageUpload',
        spaceId: params.spaceId,
        recipeId: params.recipeId || '',
        imageRole: params.imageRole || 'gallery',
        fileName: params.fileName || ''
      }
      if (params.stepId) {
        preparePayload.stepId = params.stepId
      }
      const prepare = unwrapResponse(
        await cloudCall('fileOps', preparePayload)
      )

      let uploadResult
      try {
        uploadResult = await uploadFile({
          cloudPath: prepare.cloudPath,
          filePath: params.filePath
        })
      } catch (error) {
        await safeDiscard(cloudCall, {
          spaceId: params.spaceId,
          imageId: prepare.imageId
        })
        throw new Error('图片上传失败，请重试')
      }

      try {
        const confirmPayload = {
          action: 'confirmRecipeImageUpload',
          spaceId: params.spaceId,
          imageId: prepare.imageId,
          uploadSessionId: prepare.uploadSessionId,
          fileId: uploadResult.fileID || '',
          fileSize: params.fileSize || 0,
          mimeType: params.mimeType || ''
        }
        if (params.stepId) {
          confirmPayload.stepId = params.stepId
        }
        const confirm = unwrapResponse(
          await cloudCall('fileOps', confirmPayload)
        )
        return confirm.item || null
      } catch (error) {
        await safeDiscard(cloudCall, {
          spaceId: params.spaceId,
          imageId: prepare.imageId
        })
        throw new Error('图片已上传但登记失败，请重试')
      }
    },

    async discardRecipeImage(spaceId, imageId) {
      return unwrapResponse(
        await cloudCall('fileOps', {
          action: 'discardRecipeImage',
          spaceId,
          imageId
        })
      )
    },

    async deleteRecipeImage(spaceId, imageId) {
      return unwrapResponse(
        await cloudCall('fileOps', {
          action: 'deleteRecipeImage',
          spaceId,
          imageId
        })
      )
    }
  }
}

async function uploadRecipeImage(params = {}, dependencies = {}) {
  return createUploadService(dependencies).uploadRecipeImage(params)
}

module.exports = {
  createUploadService,
  uploadRecipeImage
}
