const { createRecipeService } = require('../../services/recipe')
const { createUploadService } = require('../../services/upload')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncPageTheme } = require('../../utils/theme')
const DEFAULT_CATEGORY_LABEL = '请选择菜谱分类'
const COOK_DURATION_OPTIONS = Object.freeze([
  { label: '15分钟内', value: '15' },
  { label: '15-30分钟', value: '30' },
  { label: '30-45分钟', value: '45' },
  { label: '45-60分钟', value: '60' },
  { label: '1小时以上', value: '61' }
])

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

function buildCategoryOptions(items = [], currentCategory = '') {
  const names = Array.from(
    new Set(
      (items || [])
        .map((item) => (item && item.name ? String(item.name).trim() : ''))
        .filter(Boolean)
    )
  )
  if (currentCategory && !names.includes(currentCategory)) {
    names.push(currentCategory)
  }
  return [DEFAULT_CATEGORY_LABEL].concat(names)
}

function getCategoryIndex(options = [], category = '') {
  const index = (options || []).indexOf(category)
  return index >= 0 ? index : 0
}

function buildCookDurationOptions(selectedValue = '') {
  const selected = typeof selectedValue === 'string' ? selectedValue : String(selectedValue || '')
  return COOK_DURATION_OPTIONS.map((item) => ({
    ...item,
    selected: item.value === selected,
    itemClass: item.value === selected ? 'duration-chip duration-chip--selected' : 'duration-chip'
  }))
}

function buildRecommendationStarItems(score = '') {
  const parsed = Number(score)
  const normalized = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  return [1, 2, 3, 4, 5].map((value) => ({
    value,
    active: value <= normalized,
    itemClass: value <= normalized ? 'rating-star rating-star--active' : 'rating-star'
  }))
}

function buildCategorySelectorItems(categoryOptions = [], selectedCategoryIndex = 0) {
  return (categoryOptions || [])
    .map((label, index) => ({
      index,
      label,
      disabled: index === 0,
      itemClass:
        index === selectedCategoryIndex
          ? 'category-selector__item category-selector__item--active'
          : 'category-selector__item'
    }))
    .filter((item) => !item.disabled)
}

function buildIngredientViewItems(ingredients = []) {
  return normalizeRows(ingredients, createEmptyIngredient).map((item, index) => ({
    ...item,
    displayIndex: index + 1
  }))
}

function buildStepViewItems(steps = []) {
  return normalizeRows(steps, createEmptyStep).map((item, index) => ({
    ...item,
    displayIndex: index + 1,
    contentCount: String((item.content || '').length)
  }))
}

function buildEditorViewData(options = {}) {
  const form = options.form || createEmptyForm()
  const categoryOptions = options.categoryOptions || [DEFAULT_CATEGORY_LABEL]
  const selectedCategoryIndex =
    typeof options.selectedCategoryIndex === 'number' ? options.selectedCategoryIndex : 0
  const isEdit = Boolean(options.isEdit)
  const categoryLabel = categoryOptions[selectedCategoryIndex] || DEFAULT_CATEGORY_LABEL
  const recommendationScore = Number(form.recommendationScore)
  return {
    ingredientViewItems: buildIngredientViewItems(form.ingredients),
    stepViewItems: buildStepViewItems(form.steps),
    selectedCategoryLabel: categoryLabel,
    categoryPickerClass:
      selectedCategoryIndex === 0
        ? 'category-picker__value category-picker__value--placeholder'
        : 'category-picker__value',
    categorySelectorItems: buildCategorySelectorItems(categoryOptions, selectedCategoryIndex),
    summaryCount: String((form.summary || '').length),
    recommendationScoreLabel: `${Number.isFinite(recommendationScore) ? recommendationScore : 0}/5`,
    submitButtonLabel: isEdit ? '保存菜谱' : '创建菜谱'
  }
}

function resolvePageTitle(isEdit = false) {
  return isEdit ? '编辑菜谱' : '新增菜谱'
}

function normalizeInitialCategory(value = '') {
  if (typeof value !== 'string') {
    return ''
  }
  try {
    return decodeURIComponent(value).trim()
  } catch (error) {
    return value.trim()
  }
}

function removeArrayValue(values = [], value) {
  return (values || []).filter((item) => item !== value)
}

function getPreviousPage() {
  if (typeof getCurrentPages !== 'function') {
    return null
  }

  const pages = getCurrentPages()
  if (!Array.isArray(pages) || pages.length < 2) {
    return null
  }

  return pages[pages.length - 2] || null
}

function queueCreatedRecipeOnPreviousPage(recipe = {}) {
  if (!recipe || !recipe._id) {
    return false
  }

  const previousPage = getPreviousPage()
  if (!previousPage || typeof previousPage.queueCreatedRecipe !== 'function') {
    return false
  }

  previousPage.queueCreatedRecipe(recipe)
  return true
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
    isBootstrapping: false,
    hasBootstrapped: false,
    submitting: false,
    deleting: false,
    activeSpaceId: '',
    recipeId: '',
    isEdit: false,
    initialCategory: '',
    loadErrorMessage: '',
    availableTags: [],
    recipeCategories: [],
    categoryOptions: [DEFAULT_CATEGORY_LABEL],
    selectedCategoryIndex: 0,
    selectedCategoryLabel: DEFAULT_CATEGORY_LABEL,
    categoryPickerClass: 'category-picker__value category-picker__value--placeholder',
    categorySelectorItems: [],
    showCategorySelector: false,
    loadingTitle: '正在准备新菜谱...',
    summaryCount: '0',
    cookDurationOptions: buildCookDurationOptions(''),
    recommendationStarItems: buildRecommendationStarItems(''),
    recommendationScoreLabel: '0/5',
    tagViewItems: [],
    ingredientViewItems: buildIngredientViewItems(createEmptyForm().ingredients),
    stepViewItems: buildStepViewItems(createEmptyForm().steps),
    submitButtonLabel: '创建菜谱',
    newTagName: '',
    cancelledPendingImageIds: [],
    form: createEmptyForm()
  },

  onLoad(options) {
    const recipeId = options && options.recipeId ? options.recipeId : ''
    const isEdit = Boolean(recipeId)
    const initialCategory = isEdit ? '' : normalizeInitialCategory(options && options.category ? options.category : '')
    this.setData({
      recipeId,
      isEdit,
      initialCategory,
      loadingTitle: recipeId ? '正在加载菜谱信息...' : '正在准备新菜谱...',
      hasBootstrapped: false
    })
    if (typeof wx !== 'undefined' && typeof wx.setNavigationBarTitle === 'function') {
      wx.setNavigationBarTitle({
        title: resolvePageTitle(isEdit)
      })
    }
  },

  async onShow() {
    syncPageTheme(this)
    try {
      await this.handleOnShow()
    } catch (error) {
      void error
    }
  },

  async handleOnShow() {
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
        loading: true,
        isBootstrapping: true
      })
      if (!this.data.isEdit) {
        const cleaned = await this.cleanupCreateDraftImagesBeforeExit({
          blockOnUploading: false,
          showFailureToast: true
        })
        if (!cleaned) {
          this.setData({
            loading: false,
            isBootstrapping: false
          })
          return
        }
      }
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
    await this.bootstrap(currentActiveSpaceId)
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
      const [tagResult, categoryResult] = await Promise.all([
        service.listRecipeTags(activeSpaceId),
        service.listRecipeCategories(activeSpaceId)
      ])
      const nextData = {
        loading: false,
        isBootstrapping: false,
        availableTags: tagResult.items || [],
        recipeCategories: categoryResult.items || []
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

      if (!this.data.isEdit && this.data.initialCategory) {
        nextData.form = {
          ...(nextData.form || this.data.form || createEmptyForm()),
          category: this.data.initialCategory
        }
      }

      const selectedTagIds = nextData.form ? nextData.form.tagIds : this.data.form.tagIds
      const currentCategory = nextData.form ? nextData.form.category || '' : this.data.form.category || ''
      nextData.categoryOptions = buildCategoryOptions(nextData.recipeCategories, currentCategory)
      nextData.selectedCategoryIndex = getCategoryIndex(nextData.categoryOptions, currentCategory)
      nextData.cookDurationOptions = buildCookDurationOptions(
        nextData.form ? nextData.form.cookTimeMinutes : this.data.form.cookTimeMinutes
      )
      nextData.recommendationStarItems = buildRecommendationStarItems(
        nextData.form ? nextData.form.recommendationScore : this.data.form.recommendationScore
      )
      nextData.tagViewItems = buildTagViewItems(nextData.availableTags, selectedTagIds)
      Object.assign(
        nextData,
        buildEditorViewData({
          form: nextData.form || this.data.form,
          categoryOptions: nextData.categoryOptions,
          selectedCategoryIndex: nextData.selectedCategoryIndex,
          isEdit: this.data.isEdit
        })
      )
      this.setData(nextData)
    } catch (error) {
      const nextData = {
        loading: false,
        isBootstrapping: false,
        loadErrorMessage: getErrorMessage(error),
        recipeCategories: [],
        categoryOptions: [DEFAULT_CATEGORY_LABEL],
        selectedCategoryIndex: 0,
        cookDurationOptions: buildCookDurationOptions(''),
        recommendationStarItems: buildRecommendationStarItems(''),
        tagViewItems: [],
        cancelledPendingImageIds: [],
        form: createEmptyForm()
      }
      Object.assign(
        nextData,
        buildEditorViewData({
          form: nextData.form,
          categoryOptions: nextData.categoryOptions,
          selectedCategoryIndex: nextData.selectedCategoryIndex,
          isEdit: this.data.isEdit
        })
      )
      this.setData(nextData)
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    const nextData = {
      [`form.${field}`]: event.detail.value
    }
    if (field === 'recommendationScore') {
      nextData.recommendationStarItems = buildRecommendationStarItems(event.detail.value)
    }
    if (field === 'cookTimeMinutes') {
      nextData.cookDurationOptions = buildCookDurationOptions(event.detail.value)
    }
    if (field === 'summary' || field === 'recommendationScore' || field === 'cookTimeMinutes') {
      const nextForm = {
        ...this.data.form,
        [field]: event.detail.value
      }
      Object.assign(
        nextData,
        buildEditorViewData({
          form: nextForm,
          categoryOptions: this.data.categoryOptions,
          selectedCategoryIndex: this.data.selectedCategoryIndex,
          isEdit: this.data.isEdit
        })
      )
    }
    this.setData(nextData)
  },

  handleSwitchFavorite(event) {
    this.setData({
      'form.isFavorite': Boolean(event.detail.value)
    })
  },

  handleIngredientInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const ingredients = (this.data.form.ingredients || []).map((item, currentIndex) =>
      currentIndex === index
        ? {
            ...item,
            [field]: event.detail.value
          }
        : item
    )
    this.setData({
      'form.ingredients': ingredients,
      ingredientViewItems: buildIngredientViewItems(ingredients)
    })
  },

  handleStepInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const steps = (this.data.form.steps || []).map((item, currentIndex) =>
      currentIndex === index
        ? {
            ...item,
            [field]: event.detail.value
          }
        : item
    )
    this.setData({
      'form.steps': steps,
      stepViewItems: buildStepViewItems(steps)
    })
  },

  addIngredientRow() {
    const ingredients = this.data.form.ingredients.concat(createEmptyIngredient())
    this.setData({
      form: {
        ...this.data.form,
        ingredients
      },
      ingredientViewItems: buildIngredientViewItems(ingredients)
    })
  },

  removeIngredientRow(event) {
    const index = Number(event.currentTarget.dataset.index)
    const ingredients = this.data.form.ingredients.filter((item, currentIndex) => currentIndex !== index)
    this.setData({
      'form.ingredients': ingredients.length ? ingredients : [createEmptyIngredient()],
      ingredientViewItems: buildIngredientViewItems(ingredients.length ? ingredients : [createEmptyIngredient()])
    })
  },

  addStepRow() {
    const steps = this.data.form.steps.concat(createEmptyStep())
    this.setData({
      form: {
        ...this.data.form,
        steps
      },
      stepViewItems: buildStepViewItems(steps)
    })
  },

  removeStepRow(event) {
    const index = Number(event.currentTarget.dataset.index)
    const steps = this.data.form.steps.filter((item, currentIndex) => currentIndex !== index)
    this.setData({
      'form.steps': steps.length ? steps : [createEmptyStep()],
      stepViewItems: buildStepViewItems(steps.length ? steps : [createEmptyStep()])
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

  handleCategoryChange(event) {
    const selectedCategoryIndex = Number(event.detail.value)
    const nextForm = {
      ...this.data.form,
      category:
        selectedCategoryIndex > 0
          ? this.data.categoryOptions[selectedCategoryIndex]
          : ''
    }
    const nextData = {
      selectedCategoryIndex,
      form: nextForm
    }
    Object.assign(
      nextData,
      buildEditorViewData({
        form: nextForm,
        categoryOptions: this.data.categoryOptions,
        selectedCategoryIndex,
        isEdit: this.data.isEdit
      })
    )
    this.setData(nextData)
  },

  openCategorySelector() {
    if (!this.data.categorySelectorItems || !this.data.categorySelectorItems.length) {
      return
    }
    this.setData({
      showCategorySelector: true
    })
  },

  closeCategorySelector() {
    this.setData({
      showCategorySelector: false
    })
  },

  handleCategoryOptionTap(event) {
    const name = event.currentTarget.dataset.name || ''
    if (!name) {
      return
    }

    const selectedCategoryIndex = getCategoryIndex(this.data.categoryOptions, name)
    const nextForm = {
      ...this.data.form,
      category: name
    }
    const nextData = {
      selectedCategoryIndex,
      form: nextForm,
      showCategorySelector: false
    }
    Object.assign(
      nextData,
      buildEditorViewData({
        form: nextForm,
        categoryOptions: this.data.categoryOptions,
        selectedCategoryIndex,
        isEdit: this.data.isEdit
      })
    )
    this.setData(nextData)
  },

  handleCookTimeOptionTap(event) {
    const value = String(event.currentTarget.dataset.value || '')
    const nextForm = {
      ...this.data.form,
      cookTimeMinutes: value
    }
    this.setData({
      form: nextForm,
      cookDurationOptions: buildCookDurationOptions(value),
      recommendationScoreLabel: this.data.recommendationScoreLabel,
      ...buildEditorViewData({
        form: nextForm,
        categoryOptions: this.data.categoryOptions,
        selectedCategoryIndex: this.data.selectedCategoryIndex,
        isEdit: this.data.isEdit
      })
    })
  },

  handleRecommendationTap(event) {
    const value = Number(event.currentTarget.dataset.value || 0)
    const nextForm = {
      ...this.data.form,
      recommendationScore: value
    }
    this.setData({
      form: nextForm,
      recommendationStarItems: buildRecommendationStarItems(value),
      ...buildEditorViewData({
        form: nextForm,
        categoryOptions: this.data.categoryOptions,
        selectedCategoryIndex: this.data.selectedCategoryIndex,
        isEdit: this.data.isEdit
      })
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
        const result = await service.createRecipe(this.data.activeSpaceId, payload)
        queueCreatedRecipeOnPreviousPage(result && result.item ? result.item : null)
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
        this.setData({
          form: {
            ...this.data.form,
            images: (this.data.form.images || []).concat({
              ...uploadedItem,
              uploadStatus: 'discard-failed'
            })
          },
          cancelledPendingImageIds: removeArrayValue(cancelledPendingImageIds, localId)
        })
        return
      } finally {
        if (this.data.cancelledPendingImageIds.indexOf(localId) !== -1) {
          this.setData({
            cancelledPendingImageIds: removeArrayValue(this.data.cancelledPendingImageIds, localId)
          })
        }
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
