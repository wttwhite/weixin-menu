const { createRecipeService } = require('../../services/recipe')
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

    this.setData({
      submitting: true
    })

    try {
      const service = createRecipeService()
      if (this.data.isEdit) {
        await service.updateRecipe(this.data.activeSpaceId, this.data.recipeId, this.data.form)
      } else {
        await service.createRecipe(this.data.activeSpaceId, this.data.form)
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

  goBack() {
    wx.navigateBack()
  }
})
