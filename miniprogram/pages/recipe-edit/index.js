const { createRecipeService } = require('../../services/recipe')
const { createUploadService } = require('../../services/upload')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

function createEmptyIngredient() {
  return {
    name: '',
    quantity: '',
    unit: '',
    preparation: '',
    notes: ''
  }
}

function createEmptyStep() {
  return {
    title: '',
    content: '',
    durationMinutes: '',
    tips: ''
  }
}

function createEmptyForm() {
  return {
    name: '',
    summary: '',
    category: '',
    cuisine: '',
    difficulty: '',
    recommendationScore: '',
    servings: '',
    prepTimeMinutes: '',
    cookTimeMinutes: '',
    notes: '',
    sourceName: '',
    sourceUrl: '',
    isFavorite: false,
    tagIds: [],
    images: [],
    ingredients: [createEmptyIngredient()],
    steps: [createEmptyStep()]
  }
}

function normalizeRows(rows, factory) {
  const safeRows = Array.isArray(rows) && rows.length ? rows : [factory()]
  return safeRows.map((row) => ({ ...factory(), ...(row || {}) }))
}

function buildTagViewItems(tags = [], selectedTagIds = []) {
  return (tags || []).map((tag) => ({
    ...tag,
    selected: selectedTagIds.indexOf(tag._id) !== -1
  }))
}

function normalizeImageItems(images = []) {
  return (images || [])
    .map((item) => ({
      _id: item && item._id ? item._id : '',
      imageRole: item && item.imageRole ? item.imageRole : 'gallery',
      uploadStatus: item && item.uploadStatus ? item.uploadStatus : 'confirmed',
      fileId: item && item.fileId ? item.fileId : '',
      cloudPath: item && item.cloudPath ? item.cloudPath : '',
      localPath: item && item.localPath ? item.localPath : ''
    }))
    .filter((item) => item._id)
}

function removeArrayValue(values = [], value) {
  return (values || []).filter((item) => item !== value)
}

Page({
  data: {
    loading: true,
    isBootstrapping: false,
    hasBootstrapped: false,
    submitting: false,
    deleting: false,
    activeSpaceId: '',
    recipeId: '',
    isEdit: false,
    loadErrorMessage: '',
    availableTags: [],
    tagViewItems: [],
    newTagName: '',
    cancelledPendingImageIds: [],
    form: createEmptyForm()
  },

  onLoad(options) {
    const recipeId = options && options.recipeId ? options.recipeId : ''
    this.setData({
      recipeId,
      isEdit: Boolean(recipeId),
      hasBootstrapped: false
    })
  },

  onShow() {
    if (this.data.isBootstrapping) {
      return
    }
    const currentActiveSpaceId = getActiveSpaceId()
    const hasSpaceChanged =
      this.data.hasBootstrapped &&
      currentActiveSpaceId !== this.data.activeSpaceId
    const shouldRetryAfterFailure = Boolean(this.data.loadErrorMessage)
    const shouldRetryAfterMissingSpace = !this.data.activeSpaceId && Boolean(currentActiveSpaceId)
    if (hasSpaceChanged) {
      this.setData({
        hasBootstrapped: false,
        loadErrorMessage: '',
        availableTags: [],
        tagViewItems: [],
        cancelledPendingImageIds: [],
        form: createEmptyForm()
      })
    }
    if (
      this.data.hasBootstrapped &&
      !hasSpaceChanged &&
      !shouldRetryAfterFailure &&
      !shouldRetryAfterMissingSpace
    ) {
      return
    }
    this.bootstrap(currentActiveSpaceId)
  },

  async bootstrap(activeSpaceIdInput = '') {
    const activeSpaceId = activeSpaceIdInput || getActiveSpaceId()
    this.setData({
      activeSpaceId,
      loading: true,
      isBootstrapping: true,
      hasBootstrapped: true,
      loadErrorMessage: ''
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        isBootstrapping: false
      })
      return
    }

    try {
      const service = createRecipeService()
      const tagResult = await service.listRecipeTags(activeSpaceId)
      const nextData = {
        loading: false,
        isBootstrapping: false,
        availableTags: tagResult.items || []
      }

      if (this.data.isEdit && this.data.recipeId) {
        const detail = await service.getRecipeDetail(activeSpaceId, this.data.recipeId)
        const item = detail.item || {}
        const availableTagIdSet = new Set((nextData.availableTags || []).map((tag) => tag._id))
        const filteredTagIds = (Array.isArray(item.tagIds) ? item.tagIds : []).filter((tagId) =>
          availableTagIdSet.has(tagId)
        )
        nextData.form = {
          ...createEmptyForm(),
          ...item,
          tagIds: filteredTagIds,
          images: normalizeImageItems(item.images || []),
          ingredients: normalizeRows(item.ingredients, createEmptyIngredient),
          steps: normalizeRows(item.steps, createEmptyStep)
        }
      }

      const selectedTagIds = nextData.form ? nextData.form.tagIds : this.data.form.tagIds
      nextData.tagViewItems = buildTagViewItems(nextData.availableTags, selectedTagIds)
      this.setData(nextData)
    } catch (error) {
      this.setData({
        loading: false,
        isBootstrapping: false,
        loadErrorMessage: getErrorMessage(error),
        tagViewItems: [],
        cancelledPendingImageIds: [],
        form: createEmptyForm()
      })
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  handleSwitchFavorite(event) {
    this.setData({
      'form.isFavorite': Boolean(event.detail.value)
    })
  },

  handleIngredientInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.ingredients[${index}].${field}`]: event.detail.value
    })
  },

  handleStepInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.steps[${index}].${field}`]: event.detail.value
    })
  },

  addIngredientRow() {
    this.setData({
      form: {
        ...this.data.form,
        ingredients: this.data.form.ingredients.concat(createEmptyIngredient())
      }
    })
  },

  removeIngredientRow(event) {
    const index = Number(event.currentTarget.dataset.index)
    const ingredients = this.data.form.ingredients.filter((item, currentIndex) => currentIndex !== index)
    this.setData({
      'form.ingredients': ingredients.length ? ingredients : [createEmptyIngredient()]
    })
  },

  addStepRow() {
    this.setData({
      form: {
        ...this.data.form,
        steps: this.data.form.steps.concat(createEmptyStep())
      }
    })
  },

  removeStepRow(event) {
    const index = Number(event.currentTarget.dataset.index)
    const steps = this.data.form.steps.filter((item, currentIndex) => currentIndex !== index)
    this.setData({
      'form.steps': steps.length ? steps : [createEmptyStep()]
    })
  },

  handleTagToggle(event) {
    const tagId = event.detail.tagId
    if (!tagId) {
      return
    }

    const currentTagIds = this.data.form.tagIds || []
    const exists = currentTagIds.indexOf(tagId) !== -1
    const nextTagIds = exists
      ? currentTagIds.filter((id) => id !== tagId)
      : currentTagIds.concat(tagId)
    this.setData({
      'form.tagIds': nextTagIds,
      tagViewItems: buildTagViewItems(this.data.availableTags, nextTagIds)
    })
  },

  handleNewTagInput(event) {
    this.setData({
      newTagName: event.detail.value
    })
  },

  async createTag() {
    if (!this.data.newTagName.trim()) {
      return
    }

    try {
      const result = await createRecipeService().createRecipeTag(this.data.activeSpaceId, {
        name: this.data.newTagName
      })
      const newTagId = result.item ? result.item._id : ''
      this.setData({
        newTagName: '',
        availableTags: this.data.availableTags.concat(result.item || {})
      })
      const nextTagIds = newTagId
          ? this.data.form.tagIds.concat(newTagId)
          : this.data.form.tagIds
      this.setData({
        'form.tagIds': nextTagIds,
        tagViewItems: buildTagViewItems(this.data.availableTags, nextTagIds)
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async submit() {
    if (
      this.data.submitting ||
      this.data.loading ||
      this.data.loadErrorMessage ||
      !this.data.activeSpaceId
    ) {
      return
    }

    const hasUploadingImages = (this.data.form.images || []).some(
      (item) => item && item.uploadStatus === 'uploading'
    )
    if (hasUploadingImages) {
      wx.showToast({
        title: '图片仍在上传，请稍候再保存',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })

    try {
      const confirmedImages = (this.data.form.images || []).filter(
        (item) => item && item.uploadStatus === 'confirmed' && item._id
      )
      const payload = {
        ...this.data.form,
        images: confirmedImages,
        coverImageId:
          confirmedImages.some((item) => item._id === this.data.form.coverImageId)
            ? this.data.form.coverImageId
            : null
      }
      const service = createRecipeService()
      if (this.data.isEdit) {
        await service.updateRecipe(this.data.activeSpaceId, this.data.recipeId, payload)
      } else {
        await service.createRecipe(this.data.activeSpaceId, payload)
      }

      wx.showToast({
        title: this.data.isEdit ? '已更新菜谱' : '已创建菜谱',
        icon: 'success'
      })
      wx.navigateBack()
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
  },

  handleImagePendingAdd(event) {
    const pending = event.detail && event.detail.item ? event.detail.item : null
    if (!pending || !pending._id) {
      return
    }

    this.setData({
      form: {
        ...this.data.form,
        images: (this.data.form.images || []).concat(pending)
      }
    })
  },

  async handleImageUploaded(event) {
    const localId = event.detail && event.detail.localId ? event.detail.localId : ''
    const uploadedItem = event.detail && event.detail.item ? event.detail.item : null
    if (!localId || !uploadedItem || !uploadedItem._id) {
      return
    }

    const cancelledPendingImageIds = this.data.cancelledPendingImageIds || []
    const isCancelled = cancelledPendingImageIds.indexOf(localId) !== -1
    if (isCancelled) {
      try {
        await createUploadService().discardRecipeImage(this.data.activeSpaceId, uploadedItem._id)
      } catch (error) {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
      } finally {
        this.setData({
          cancelledPendingImageIds: removeArrayValue(cancelledPendingImageIds, localId)
        })
      }
      return
    }

    const nextImages = (this.data.form.images || []).map((item) => {
      if (item._id !== localId) {
        return item
      }
      return {
        ...uploadedItem
      }
    })

    const nextCoverImageId =
      uploadedItem.imageRole === 'cover'
        ? uploadedItem._id
        : this.data.form.coverImageId

    this.setData({
      form: {
        ...this.data.form,
        images: nextImages,
        coverImageId: nextCoverImageId
      }
    })
  },

  handleImageUploadError(event) {
    const localId = event.detail && event.detail.localId ? event.detail.localId : ''
    if (!localId) {
      return
    }

    this.setData({
      form: {
        ...this.data.form,
        images: (this.data.form.images || []).filter((item) => item._id !== localId)
      },
      cancelledPendingImageIds: removeArrayValue(this.data.cancelledPendingImageIds || [], localId)
    })
  },

  async handleImageRemove(event) {
    const imageId = event.detail && event.detail.imageId ? event.detail.imageId : ''
    if (!imageId) {
      return
    }

    const images = this.data.form.images || []
    const targetImage = images.find((item) => item._id === imageId)
    if (!targetImage) {
      return
    }

    if (targetImage.uploadStatus === 'uploading') {
      this.setData({
        cancelledPendingImageIds: (this.data.cancelledPendingImageIds || []).concat(imageId)
      })
    } else {
      try {
        const uploadService = createUploadService()
        if (targetImage.uploadStatus === 'confirmed') {
          await uploadService.deleteRecipeImage(this.data.activeSpaceId, imageId)
        } else {
          await uploadService.discardRecipeImage(this.data.activeSpaceId, imageId)
        }
      } catch (error) {
        wx.showToast({
          title: getErrorMessage(error),
          icon: 'none'
        })
        return
      }
    }

    const nextImages = images.filter((item) => item._id !== imageId)
    const nextCoverImageId =
      this.data.form.coverImageId === imageId
        ? (nextImages.find((item) => item.imageRole === 'cover' && item.uploadStatus === 'confirmed') || {})._id || null
        : this.data.form.coverImageId

    this.setData({
      form: {
        ...this.data.form,
        images: nextImages,
        coverImageId: nextCoverImageId
      }
    })
  },

  async removeRecipe() {
    if (!this.data.isEdit || this.data.deleting || this.data.loading || this.data.loadErrorMessage) {
      return
    }

    const result = await wx.showModal({
      title: '删除菜谱',
      content: '确认删除这道菜谱吗？',
      confirmColor: '#b44343'
    })
    if (!result.confirm) {
      return
    }

    this.setData({
      deleting: true
    })
    try {
      await createRecipeService().deleteRecipe(this.data.activeSpaceId, this.data.recipeId)
      wx.showToast({
        title: '已删除菜谱',
        icon: 'success'
      })
      wx.navigateBack()
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({
        deleting: false
      })
    }
  },

  async cleanupCreateDraftImagesBeforeExit(options = {}) {
    const shouldBlockOnUploading = options.blockOnUploading !== false
    const showFailureToast = options.showFailureToast !== false
    const images = this.data.form.images || []
    const hasUploadingImages = images.some((item) => item && item.uploadStatus === 'uploading')
    if (hasUploadingImages && shouldBlockOnUploading) {
      wx.showToast({
        title: '图片仍在上传，请稍候再退出',
        icon: 'none'
      })
      return false
    }

    const confirmedImages = images.filter((item) => item && item.uploadStatus === 'confirmed' && item._id)
    if (!confirmedImages.length) {
      return true
    }

    const uploadService = createUploadService()
    for (const image of confirmedImages) {
      try {
        await uploadService.discardRecipeImage(this.data.activeSpaceId, image._id)
      } catch (error) {
        if (showFailureToast) {
          wx.showToast({
            title: getErrorMessage(error),
            icon: 'none'
          })
        }
        return false
      }
    }

    this.setData({
      form: {
        ...this.data.form,
        images: [],
        coverImageId: null
      }
    })
    return true
  },

  async onUnload() {
    if (this.data.isEdit) {
      return
    }
    await this.cleanupCreateDraftImagesBeforeExit({
      blockOnUploading: false,
      showFailureToast: false
    })
  },

  async goBack() {
    if (!this.data.isEdit) {
      const cleaned = await this.cleanupCreateDraftImagesBeforeExit()
      if (!cleaned) {
        return
      }
    }
    wx.navigateBack()
  }
})
