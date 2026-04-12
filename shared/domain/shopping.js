function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function parseQuantity(value) {
  const parsed = Number(normalizeText(value))
  return Number.isFinite(parsed) ? parsed : null
}

function formatQuantity(value) {
  if (!Number.isFinite(value)) {
    return ''
  }
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value))
  }
  return String(value)
}

function normalizeShoppingListWrite(input = {}) {
  return {
    title: normalizeText(input.title) || '采购清单',
    notes: normalizeText(input.notes)
  }
}

function normalizeShoppingItemWrite(input = {}) {
  return {
    name: normalizeText(input.name),
    quantity: normalizeText(input.quantity),
    unit: normalizeText(input.unit),
    notes: normalizeText(input.notes),
    sourceType: normalizeText(input.sourceType) || 'manual'
  }
}

function buildShoppingItemsFromMealPlans(mealPlans = []) {
  const mergedByKey = new Map()

  ;(mealPlans || []).forEach((plan) => {
    const recipes = Array.isArray(plan && plan.recipes) ? plan.recipes : []
    recipes.forEach((recipe) => {
      const ingredients = Array.isArray(recipe && recipe.ingredients) ? recipe.ingredients : []
      ingredients.forEach((ingredient) => {
        const normalized = normalizeShoppingItemWrite({
          ...ingredient,
          sourceType: 'generated'
        })
        if (!normalized.name) {
          return
        }

        const key = `${normalized.name.toLowerCase()}|${normalized.unit.toLowerCase()}`
        const existing = mergedByKey.get(key)
        if (!existing) {
          mergedByKey.set(key, {
            ...normalized,
            quantity: normalized.quantity || '1',
            checked: false
          })
          return
        }

        const left = parseQuantity(existing.quantity)
        const right = parseQuantity(normalized.quantity || '1')
        if (left !== null && right !== null) {
          existing.quantity = formatQuantity(left + right)
        }
      })
    })
  })

  return Array.from(mergedByKey.values()).map((item, index) => ({
    ...item,
    sortOrder: index + 1
  }))
}

function buildShoppingProgress(items = []) {
  const total = (items || []).length
  const checked = (items || []).filter((item) => Boolean(item && item.checked)).length
  const percent = total ? Math.round((checked / total) * 100) : 0
  return {
    total,
    checked,
    percent
  }
}

module.exports = {
  buildShoppingItemsFromMealPlans,
  buildShoppingProgress,
  normalizeShoppingItemWrite,
  normalizeShoppingListWrite
}
