const MEAL_TYPE_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
}

function getPrimaryRecipe(mealPlan = {}) {
  const recipes = Array.isArray(mealPlan.recipes) ? mealPlan.recipes : []
  return recipes[0] || {}
}

function getRecipeNames(mealPlan = {}) {
  const recipes = Array.isArray(mealPlan.recipes) ? mealPlan.recipes : []
  return recipes
    .map((item) => (item.recipe && item.recipe.name) || item.recipeNameSnapshot || '')
    .filter(Boolean)
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
    servingsText: '',
    recipeName: '',
    recipeSummary: '',
    recipeCountText: ''
  },

  methods: {
    syncMealPlanView(mealPlan = {}) {
      const mealType = mealPlan.mealType || ''
      const primaryRecipe = getPrimaryRecipe(mealPlan)
      const recipeNames = getRecipeNames(mealPlan)
      const servings =
        primaryRecipe.servingsOverride ||
        (primaryRecipe.recipe && primaryRecipe.recipe.servings) ||
        ''
      this.setData({
        mealTypeLabel: MEAL_TYPE_LABELS[mealType] || '餐次',
        servingsText: servings ? `${servings} 人份` : '',
        recipeName:
          recipeNames.join(' / ') ||
          '未关联菜谱',
        recipeSummary:
          (primaryRecipe.recipe && primaryRecipe.recipe.summary) || '',
        recipeCountText:
          recipeNames.length > 1 ? `共 ${recipeNames.length} 道菜` : ''
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
