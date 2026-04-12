const { createMealPlanService } = require('../../services/meal-plan')
const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')

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

function buildRecipeIndex(recipeOptions = [], recipeId = '') {
  const index = (recipeOptions || []).findIndex((item) => item.value === recipeId)
  return index >= 0 ? index : 0
}

function createEmptyForm() {
  return {
    date: getTodayDate(),
    mealType: 'dinner',
    recipeId: '',
    servings: '',
    notes: ''
  }
}

Page({
  data: {
    loading: true,
    submitting: false,
    deleting: false,
    isEdit: false,
    mealPlanId: '',
    activeSpaceId: '',
    recipes: [],
    recipeOptions: [{ label: '请选择菜谱', value: '' }],
    selectedRecipeIndex: 0,
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
        loading: false
      })
      return
    }

    try {
      const recipeResult = await createRecipeService().listRecipes(activeSpaceId)
      const recipes = recipeResult.items || []
      const recipeOptions = buildRecipeOptions(recipes)
      const nextData = {
        loading: false,
        recipes,
        recipeOptions
      }

      if (this.data.isEdit && this.data.mealPlanId) {
        const mealPlanResult = await createMealPlanService().listMealPlans(activeSpaceId)
        const target = (mealPlanResult.items || []).find((item) => item._id === this.data.mealPlanId)
        if (!target) {
          this.setData({
            loading: false,
            loadErrorMessage: '没有找到对应的数据'
          })
          return
        }
        nextData.form = {
          date: target.date || getTodayDate(),
          mealType: target.mealType || 'dinner',
          recipeId: target.recipeId || '',
          servings: target.servings || '',
          notes: target.notes || ''
        }
        nextData.selectedMealTypeIndex = getMealTypeIndex(nextData.form.mealType)
        nextData.selectedRecipeIndex = buildRecipeIndex(recipeOptions, nextData.form.recipeId)
      } else {
        nextData.form = createEmptyForm()
        nextData.selectedMealTypeIndex = getMealTypeIndex(nextData.form.mealType)
        nextData.selectedRecipeIndex = 0
      }

      this.setData(nextData)
    } catch (error) {
      this.setData({
        loading: false,
        loadErrorMessage: getErrorMessage(error)
      })
    }
  },

  handleDateChange(event) {
    this.setData({
      'form.date': event.detail.value
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
    const selectedRecipeIndex = Number(event.detail.value)
    const recipeOption = this.data.recipeOptions[selectedRecipeIndex] || { value: '' }
    this.setData({
      selectedRecipeIndex,
      'form.recipeId': recipeOption.value
    })
  },

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
    if (!this.data.form.recipeId) {
      wx.showToast({
        title: '请选择菜谱',
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
