const MEAL_TYPE_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
}

Component({
  properties: {
    mealPlan: {
      type: Object,
      value: null,
      observer(nextValue) {
        this.syncMealPlanView(nextValue)
      }
    }
  },

  data: {
    mealTypeLabel: '',
    servingsText: ''
  },

  methods: {
    syncMealPlanView(mealPlan = {}) {
      const mealType = mealPlan.mealType || ''
      const servings = mealPlan.servings || (mealPlan.recipe && mealPlan.recipe.servings) || ''
      this.setData({
        mealTypeLabel: MEAL_TYPE_LABELS[mealType] || '餐次',
        servingsText: servings ? `${servings} 人份` : ''
      })
    },

    handleTap() {
      const mealPlan = this.data.mealPlan || {}
      if (!mealPlan._id) {
        return
      }
      this.triggerEvent('select', {
        mealPlanId: mealPlan._id
      })
    }
  }
})
