const { createMealPlanService } = require('../../services/meal-plan')
const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncPageTheme } = require('../../utils/theme')

const MEAL_TYPE_OPTIONS = [
  { label: '早餐', value: 'breakfast' },
  { label: '午餐', value: 'lunch' },
  { label: '晚餐', value: 'dinner' },
  { label: '加餐', value: 'snack' }
]

function getTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMealTypeIndex(mealType) {
  const index = MEAL_TYPE_OPTIONS.findIndex((option) => option.value === mealType)
  return index >= 0 ? index : 0
}

function buildRecipeOptions(recipes = []) {
  return [{ label: '请选择菜谱', value: '' }].concat(
    (recipes || []).map((item) => ({
      label: item.name || '未命名菜谱',
      value: item._id
    }))
  )
}

function buildFilteredRecipeOptions(recipeOptions = [], keyword = '') {
  const normalizedKeyword = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
  const options = (recipeOptions || []).filter((item) => item && item.value)
  if (!normalizedKeyword) {
    return options
  }
  return options.filter((item) => String(item.label || '').toLowerCase().includes(normalizedKeyword))
}

function mergeRecipeOptions(recipes = [], fallbackRecipes = []) {
  const options = buildRecipeOptions(recipes)
  const existingIds = new Set(options.map((item) => item.value))

  ;(fallbackRecipes || []).forEach((item) => {
    const recipeId = item && item.recipeId ? item.recipeId : ''
    if (!recipeId || existingIds.has(recipeId)) {
      return
    }
    options.push({
      label: `${item.recipeNameSnapshot || '已删除菜谱'}（历史快照）`,
      value: recipeId
    })
    existingIds.add(recipeId)
  })

  return options
}

function buildRecipeIndex(recipeOptions = [], recipeId = '') {
  const index = (recipeOptions || []).findIndex((item) => item.value === recipeId)
  return index >= 0 ? index : 0
}

function buildRecipeIndices(recipeOptions = [], recipes = []) {
  const rows = Array.isArray(recipes) && recipes.length ? recipes : [{ recipeId: '' }]
  return rows.map((item) => buildRecipeIndex(recipeOptions, item.recipeId || ''))
}

function createEmptyPlanRecipe() {
  return {
    recipeId: '',
    servingsOverride: '',
    notes: ''
  }
}

function createEmptyForm() {
  return {
    planDate: getTodayDate(),
    mealType: 'dinner',
    status: 'planned',
    notes: '',
    recipes: [createEmptyPlanRecipe()]
  }
}

function buildRecipeRowViewItems(recipes = [], recipeOptions = [], selectedRecipeIndexes = []) {
  const rows = Array.isArray(recipes) && recipes.length ? recipes : [createEmptyPlanRecipe()]
  return rows.map((item, index) => {
    const selectedIndex = typeof selectedRecipeIndexes[index] === 'number' ? selectedRecipeIndexes[index] : 0
    const selectedOption = recipeOptions[selectedIndex] || recipeOptions[0] || { label: '请选择菜谱', value: '' }
    return {
      ...item,
      rowIndex: index + 1,
      selectedRecipeLabel: selectedOption.label || '请选择菜谱',
      recipePickerClass: selectedOption.value ? 'recipe-search' : 'recipe-search recipe-search--placeholder'
    }
  })
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
    submitting: false,
    deleting: false,
    isEdit: false,
    mealPlanId: '',
    activeSpaceId: '',
    recipes: [],
    recipeOptions: [{ label: '请选择菜谱', value: '' }],
    recipeRowViewItems: [],
    selectedRecipeIndexes: [0],
    showRecipeSelector: false,
    activeRecipeRowIndex: -1,
    recipeSearchKeyword: '',
    filteredRecipeOptions: [],
    mealTypeOptions: MEAL_TYPE_OPTIONS,
    selectedMealTypeIndex: getMealTypeIndex('dinner'),
    loadErrorMessage: '',
    form: createEmptyForm()
  },

  onLoad(options) {
    const mealPlanId = options && options.mealPlanId ? options.mealPlanId : ''
    this.setData({
      mealPlanId,
      isEdit: Boolean(mealPlanId)
    })
  },

  onShow() {
    syncPageTheme(this)
    this.bootstrap()
  },

  async bootstrap() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      loadErrorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        loadErrorMessage: '请先选择空间后再编辑计划。',
        form: createEmptyForm(),
        recipes: [],
        recipeOptions: [{ label: '请选择菜谱', value: '' }],
        recipeRowViewItems: buildRecipeRowViewItems([createEmptyPlanRecipe()], [{ label: '请选择菜谱', value: '' }], [0]),
        selectedRecipeIndexes: [0],
        showRecipeSelector: false,
        activeRecipeRowIndex: -1,
        recipeSearchKeyword: '',
        filteredRecipeOptions: [],
        selectedMealTypeIndex: getMealTypeIndex('dinner')
      })
      return
    }

    try {
      const mealPlanResult =
        this.data.isEdit && this.data.mealPlanId
          ? await createMealPlanService().getMealPlan(activeSpaceId, this.data.mealPlanId)
          : null
      const target = mealPlanResult && mealPlanResult.item ? mealPlanResult.item : null

      const recipeResult = await createRecipeService().listRecipes(activeSpaceId)
      const recipes = recipeResult.items || []
      const recipeOptions = mergeRecipeOptions(recipes, target ? target.recipes : [])
      const nextData = {
        loading: false,
        recipes,
        recipeOptions,
        filteredRecipeOptions: buildFilteredRecipeOptions(recipeOptions, ''),
        showRecipeSelector: false,
        activeRecipeRowIndex: -1,
        recipeSearchKeyword: ''
      }

      if (this.data.isEdit && this.data.mealPlanId) {
        if (!target) {
          this.setData({
            loading: false,
            loadErrorMessage: '没有找到对应的数据'
          })
          return
        }
        const primaryRecipe = (Array.isArray(target.recipes) ? target.recipes[0] : null) || {}
        nextData.form = {
          planDate: target.planDate || getTodayDate(),
          mealType: target.mealType || 'dinner',
          status: target.status || 'planned',
          notes: target.notes || '',
          recipes: (Array.isArray(target.recipes) && target.recipes.length
            ? target.recipes
            : [primaryRecipe]
          ).map((item) => ({
            recipeId: item.recipeId || '',
            servingsOverride: item.servingsOverride || '',
            notes: item.notes || ''
          }))
        }
        nextData.selectedMealTypeIndex = getMealTypeIndex(nextData.form.mealType)
        nextData.selectedRecipeIndexes = buildRecipeIndices(recipeOptions, nextData.form.recipes)
      } else {
        nextData.form = createEmptyForm()
        nextData.selectedMealTypeIndex = getMealTypeIndex(nextData.form.mealType)
        nextData.selectedRecipeIndexes = [0]
      }

      nextData.recipeRowViewItems = buildRecipeRowViewItems(
        nextData.form.recipes,
        recipeOptions,
        nextData.selectedRecipeIndexes
      )

      this.setData(nextData)
    } catch (error) {
      this.setData({
        loading: false,
        loadErrorMessage: getErrorMessage(error),
        showRecipeSelector: false,
        activeRecipeRowIndex: -1
      })
    }
  },

  handleDateChange(event) {
    this.setData({
      'form.planDate': event.detail.value
    })
  },

  handleMealTypeChange(event) {
    const selectedMealTypeIndex = Number(event.detail.value)
    const mealTypeOption = this.data.mealTypeOptions[selectedMealTypeIndex] || MEAL_TYPE_OPTIONS[0]
    this.setData({
      selectedMealTypeIndex,
      'form.mealType': mealTypeOption.value
    })
  },

  handleRecipeChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const selectedRecipeIndex = Number(event.detail.value)
    const recipeOption = this.data.recipeOptions[selectedRecipeIndex] || { value: '' }
    this.setData({
      [`selectedRecipeIndexes[${index}]`]: selectedRecipeIndex,
      [`form.recipes[${index}].recipeId`]: recipeOption.value
    })
  },

  handleRecipeFieldInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.recipes[${index}].${field}`]: event.detail.value
    })
  },

  addRecipeRow() {
    const nextRecipes = (this.data.form.recipes || []).concat(createEmptyPlanRecipe())
    const nextSelectedRecipeIndexes = buildRecipeIndices(this.data.recipeOptions, nextRecipes)
    this.setData({
      'form.recipes': nextRecipes,
      selectedRecipeIndexes: nextSelectedRecipeIndexes,
      recipeRowViewItems: buildRecipeRowViewItems(nextRecipes, this.data.recipeOptions, nextSelectedRecipeIndexes)
    })
  },

  removeRecipeRow(event) {
    const index = Number(event.currentTarget.dataset.index)
    const nextRecipes = (this.data.form.recipes || []).filter((item, currentIndex) => currentIndex !== index)
    const safeRecipes = nextRecipes.length ? nextRecipes : [createEmptyPlanRecipe()]
    const nextSelectedRecipeIndexes = buildRecipeIndices(this.data.recipeOptions, safeRecipes)
    this.setData({
      'form.recipes': safeRecipes,
      selectedRecipeIndexes: nextSelectedRecipeIndexes,
      recipeRowViewItems: buildRecipeRowViewItems(safeRecipes, this.data.recipeOptions, nextSelectedRecipeIndexes)
    })
  },

  openRecipeSelector(event) {
    const index = Number(event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.index
      : -1)
    if (!Number.isInteger(index) || index < 0) {
      return
    }

    this.setData({
      showRecipeSelector: true,
      activeRecipeRowIndex: index,
      recipeSearchKeyword: '',
      filteredRecipeOptions: buildFilteredRecipeOptions(this.data.recipeOptions, '')
    })
  },

  closeRecipeSelector() {
    this.setData({
      showRecipeSelector: false,
      activeRecipeRowIndex: -1,
      recipeSearchKeyword: '',
      filteredRecipeOptions: buildFilteredRecipeOptions(this.data.recipeOptions, '')
    })
  },

  handleRecipeSearchInput(event) {
    const value = event && event.detail ? event.detail.value : ''
    this.setData({
      recipeSearchKeyword: value,
      filteredRecipeOptions: buildFilteredRecipeOptions(this.data.recipeOptions, value)
    })
  },

  handleRecipeOptionSelect(event) {
    const value = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.value || ''
      : ''
    const index = this.data.activeRecipeRowIndex
    if (!value || !Number.isInteger(index) || index < 0) {
      return
    }

    const selectedRecipeIndex = buildRecipeIndex(this.data.recipeOptions, value)
    const nextSelectedRecipeIndexes = (this.data.selectedRecipeIndexes || []).slice()
    nextSelectedRecipeIndexes[index] = selectedRecipeIndex
    const nextRecipes = (this.data.form.recipes || []).map((item, currentIndex) => {
      if (currentIndex !== index) {
        return item
      }
      return {
        ...item,
        recipeId: value
      }
    })

    this.setData({
      'form.recipes': nextRecipes,
      selectedRecipeIndexes: nextSelectedRecipeIndexes,
      recipeRowViewItems: buildRecipeRowViewItems(nextRecipes, this.data.recipeOptions, nextSelectedRecipeIndexes),
      showRecipeSelector: false,
      activeRecipeRowIndex: -1,
      recipeSearchKeyword: '',
      filteredRecipeOptions: buildFilteredRecipeOptions(this.data.recipeOptions, '')
    })
  },

  noop() {},

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  async submit() {
    if (this.data.submitting || this.data.loading || this.data.loadErrorMessage || !this.data.activeSpaceId) {
      return
    }
    const hasRecipeSelection = (this.data.form.recipes || []).some((item) => item.recipeId)
    if (!hasRecipeSelection) {
      wx.showToast({
        title: '请选择菜谱',
        icon: 'none'
      })
      return
    }
    const availableRecipeIds = new Set((this.data.recipes || []).map((item) => item._id))
    const hasMissingRecipe = (this.data.form.recipes || []).some(
      (item) => !item.recipeId || !availableRecipeIds.has(item.recipeId)
    )
    if (hasMissingRecipe) {
      wx.showToast({
        title: '计划中包含已失效菜谱，请重新选择',
        icon: 'none'
      })
      return
    }

    this.setData({
      submitting: true
    })
    try {
      const service = createMealPlanService()
      if (this.data.isEdit) {
        await service.updateMealPlan(this.data.activeSpaceId, this.data.mealPlanId, this.data.form)
      } else {
        await service.createMealPlan(this.data.activeSpaceId, this.data.form)
      }
      wx.showToast({
        title: this.data.isEdit ? '已更新计划' : '已创建计划',
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

  async removeMealPlan() {
    if (
      !this.data.isEdit ||
      this.data.deleting ||
      this.data.loading ||
      this.data.loadErrorMessage ||
      !this.data.activeSpaceId
    ) {
      return
    }

    const modalResult = await wx.showModal({
      title: '删除计划',
      content: '确认删除这条用餐计划吗？',
      confirmColor: '#b44343'
    })
    if (!modalResult.confirm) {
      return
    }

    this.setData({
      deleting: true
    })
    try {
      await createMealPlanService().deleteMealPlan(this.data.activeSpaceId, this.data.mealPlanId)
      wx.showToast({
        title: '已删除计划',
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
