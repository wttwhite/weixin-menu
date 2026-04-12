const { createUploadService } = require('../../services/upload')

function createLocalImageId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

Component({
  properties: {
    label: {
      type: String,
      value: ''
    },
    items: {
      type: Array,
      value: []
    },
    spaceId: {
      type: String,
      value: ''
    },
    recipeId: {
      type: String,
      value: ''
    },
    imageRole: {
      type: String,
      value: 'gallery'
    },
    maxCount: {
      type: Number,
      value: 10
    },
    disabled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    uploading: false
  },

  methods: {
    async chooseAndUpload() {
      if (this.data.uploading || this.properties.disabled || !this.properties.spaceId) {
        return
      }

      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera']
      })
      const files = result && Array.isArray(result.tempFiles) ? result.tempFiles : []
      if (!files.length) {
        return
      }

      const file = files[0]
      const localId = createLocalImageId()
      this.triggerEvent('pendingadd', {
        item: {
          _id: localId,
          imageRole: this.properties.imageRole,
          localPath: file.tempFilePath,
          uploadStatus: 'uploading'
        }
      })

      this.setData({
        uploading: true
      })
      try {
        const uploaded = await createUploadService().uploadRecipeImage({
          spaceId: this.properties.spaceId,
          recipeId: this.properties.recipeId || '',
          imageRole: this.properties.imageRole,
          filePath: file.tempFilePath,
          fileName: file.fileName || '',
          fileSize: file.size || 0,
          mimeType: file.type || ''
        })
        this.triggerEvent('uploaded', {
          localId,
          item: {
            ...uploaded,
            localPath: file.tempFilePath
          }
        })
      } catch (error) {
        const message = (error && error.message) || '图片上传失败，请重试'
        wx.showToast({
          title: message,
          icon: 'none'
        })
        this.triggerEvent('uploaderror', {
          localId,
          message
        })
      } finally {
        this.setData({
          uploading: false
        })
      }
    },

    handleRemove(event) {
      const imageId = event.currentTarget.dataset.imageId
      if (!imageId) {
        return
      }
      this.triggerEvent('remove', {
        imageId
      })
    }
  }
})
