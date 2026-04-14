const { createMealPlanService } = require('../../services/meal-plan')
const { createPantryService } = require('../../services/pantry')
const { createRecipeService } = require('../../services/recipe')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncCurrentTabBar } = require('../../utils/tab-bar')

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const MEAL_TYPE_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function createTodayIso(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createTodayDisplayLabel(now = new Date()) {
  return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
}

function buildMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function parseMonthKey(monthKey = '') {
  const [yearText, monthText] = normalizeText(monthKey).split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    const today = createTodayIso()
    return parseMonthKey(today.slice(0, 7))
  }
  return {
    year,
    month
  }
}

function shiftMonthKey(monthKey = '', offset = 0) {
  const { year, month } = parseMonthKey(monthKey)
  const next = new Date(Date.UTC(year, month - 1 + offset, 1))
  return buildMonthKey(next.getUTCFullYear(), next.getUTCMonth() + 1)
}

function formatMonthLabel(monthKey = '') {
  const { year, month } = parseMonthKey(monthKey)
  return `${year}年${month}月`
}

function compareIsoDate(left = '', right = '') {
  return normalizeText(left).localeCompare(normalizeText(right))
}

function groupPlansByDate(items = []) {
  const grouped = []
  ;(items || []).forEach((item) => {
    const date = item.planDate || '未设置日期'
    const lastGroup = grouped[grouped.length - 1]
    if (!lastGroup || lastGroup.date !== date) {
      grouped.push({
        date,
        items: [item]
      })
      return
    }
    lastGroup.items.push(item)
  })
  return grouped
}

function buildPlansByDate(items = []) {
  const grouped = {}
  ;(items || []).forEach((item) => {
    const date = normalizeText(item.planDate)
    if (!date) {
      return
    }
    if (!grouped[date]) {
      grouped[date] = []
    }
    grouped[date].push(item)
  })
  return grouped
}

function buildPlanCountByDate(items = []) {
  const counts = {}
  ;(items || []).forEach((item) => {
    const date = normalizeText(item.planDate)
    if (!date) {
      return
    }
    counts[date] = (counts[date] || 0) + 1
  })
  return counts
}

function resolveSelectedDate(monthKey = '', selectedDate = '', todayIso = '', planCounts = {}) {
  const normalizedSelectedDate = normalizeText(selectedDate)
  if (normalizedSelectedDate.startsWith(monthKey)) {
    return normalizedSelectedDate
  }
  if (normalizeText(todayIso).startsWith(monthKey)) {
    return normalizeText(todayIso)
  }

  const plannedDates = Object.keys(planCounts)
    .filter((date) => date.startsWith(monthKey))
    .sort()
  if (plannedDates.length) {
    return plannedDates[0]
  }

  return `${monthKey}-01`
}

function buildCalendarItems(monthKey = '', selectedDate = '', todayIso = '', planCounts = {}) {
  const { year, month } = parseMonthKey(monthKey)
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const items = []

  for (let index = 0; index < firstWeekday; index += 1) {
    items.push({
      key: `blank-start-${index}`,
      date: '',
      label: '',
      isBlank: true,
      hasPlans: false,
      planCount: 0,
      itemClass: 'calendar-cell calendar-cell--blank',
      dotClass: ''
    })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthKey}-${String(day).padStart(2, '0')}`
    const hasPlans = Boolean(planCounts[date])
    const isSelected = date === selectedDate
    const isToday = date === todayIso
    const classes = ['calendar-cell']
    if (hasPlans) {
      classes.push('calendar-cell--has-plans')
    }
    if (isToday) {
      classes.push('calendar-cell--today')
    }
    if (isSelected) {
      classes.push('calendar-cell--selected')
    }

    items.push({
      key: date,
      date,
      label: String(day),
      isBlank: false,
      hasPlans,
      planCount: planCounts[date] || 0,
      showDot: hasPlans,
      itemClass: classes.join(' '),
      dotClass: isSelected ? 'calendar-cell__dot calendar-cell__dot--selected' : 'calendar-cell__dot'
    })
  }

  while (items.length % 7 !== 0) {
    items.push({
      key: `blank-end-${items.length}`,
      date: '',
      label: '',
      isBlank: true,
      hasPlans: false,
      planCount: 0,
      itemClass: 'calendar-cell calendar-cell--blank',
      dotClass: ''
    })
  }

  return items
}

function buildMealTypeLabel(mealType = '') {
  return MEAL_TYPE_LABELS[normalizeText(mealType)] || '餐次'
}

function buildPlanStatusMeta(planDate = '', todayIso = '') {
  const compareResult = compareIsoDate(planDate, todayIso)
  if (compareResult < 0) {
    return {
      text: '已完成',
      className: 'plan-card__status plan-card__status--done'
    }
  }
  if (compareResult === 0) {
    return {
      text: '进行中',
      className: 'plan-card__status plan-card__status--today'
    }
  }
  return {
    text: '待执行',
    className: 'plan-card__status plan-card__status--upcoming'
  }
}

function buildSelectedPlanItems(items = [], todayIso = '') {
  return (items || []).map((item) => {
    const recipeTags = (Array.isArray(item.recipes) ? item.recipes : [])
      .map((recipe) => (recipe.recipe && recipe.recipe.name) || recipe.recipeNameSnapshot || '')
      .filter(Boolean)
    const statusMeta = buildPlanStatusMeta(item.planDate, todayIso)

    return {
      ...item,
      mealTypeLabel: buildMealTypeLabel(item.mealType),
      primaryRecipeName: recipeTags[0] || '未关联菜谱',
      recipeTags,
      recipeTagItems: recipeTags.slice(0, 4),
      statusText: statusMeta.text,
      statusClass: statusMeta.className,
      planCountText: `${recipeTags.length || 0} 道菜`,
      utensilText: '🍽'
    }
  })
}

function parseNumericQuantity(value) {
  const text = normalizeText(value)
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return null
  }
  return Number(text)
}

function formatQuantity(value, unit = '') {
  const quantityText = typeof value === 'number' ? String(value).replace(/\.0$/, '') : normalizeText(value)
  return unit ? `${quantityText}${unit}` : quantityText
}

function buildInventoryAggregateKey(name = '', unit = '') {
  return `${normalizeText(name).toLowerCase()}__${normalizeText(unit).toLowerCase()}`
}

function buildInventoryCheckResult(selectedPlans = [], recipeDetails = [], pantryItems = []) {
  const recipeMap = new Map((recipeDetails || []).map((item) => [item._id, item]))
  const requiredMap = new Map()

  ;(selectedPlans || []).forEach((plan) => {
    ;(plan.recipes || []).forEach((recipeRef) => {
      const recipe = recipeMap.get(recipeRef.recipeId)
      const recipeName = (recipe && recipe.name) || recipeRef.recipeNameSnapshot || '菜谱'
      ;((recipe && recipe.ingredients) || []).forEach((ingredient) => {
        const name = normalizeText(ingredient.name)
        const unit = normalizeText(ingredient.unit)
        if (!name) {
          return
        }
        const key = buildInventoryAggregateKey(name, unit)
        const quantityText = normalizeText(ingredient.quantity) || '1'
        const quantityNumber = parseNumericQuantity(quantityText)
        const current = requiredMap.get(key) || {
          name,
          unit,
          quantityNumber: 0,
          quantityText: quantityText,
          sources: new Set()
        }

        if (quantityNumber !== null) {
          current.quantityNumber += quantityNumber
          current.quantityText = String(current.quantityNumber)
        }
        current.sources.add(recipeName)
        requiredMap.set(key, current)
      })
    })
  })

  const availablePantryItems = (pantryItems || []).filter((item) => {
    const usageStatus = normalizeText(item.usageStatus)
    const freshnessStatus = normalizeText(item.status)
    return usageStatus !== 'used-up' && usageStatus !== 'discarded' && freshnessStatus !== 'expired'
  })

  const stockMap = new Map()
  availablePantryItems.forEach((item) => {
    const name = normalizeText(item.name)
    const unit = normalizeText(item.unit)
    if (!name) {
      return
    }
    const key = buildInventoryAggregateKey(name, unit)
    const quantityText = normalizeText(item.quantity) || '1'
    const quantityNumber = parseNumericQuantity(quantityText)
    const current = stockMap.get(key) || {
      quantityNumber: 0,
      quantityText: quantityText
    }
    if (quantityNumber !== null) {
      current.quantityNumber += quantityNumber
      current.quantityText = String(current.quantityNumber)
    }
    stockMap.set(key, current)
  })

  const inventoryItems = Array.from(requiredMap.values()).map((item) => {
    const key = buildInventoryAggregateKey(item.name, item.unit)
    const stock = stockMap.get(key)
    const inStock = Boolean(stock && stock.quantityNumber >= item.quantityNumber && item.quantityNumber > 0)
    return {
      key,
      name: item.name,
      requiredText: `需要: ${formatQuantity(item.quantityText, item.unit)} · ${Array.from(item.sources).join(' / ')}`,
      stockText: stock ? `库存: ${formatQuantity(stock.quantityText, item.unit)}` : '库存: 0',
      statusText: inStock ? '有库存' : '缺货',
      statusClass: inStock ? 'inventory-item__status inventory-item__status--ok' : 'inventory-item__status inventory-item__status--missing',
      iconClass: inStock ? 'inventory-item__icon inventory-item__icon--ok' : 'inventory-item__icon inventory-item__icon--missing',
      iconText: inStock ? '✓' : '!'
    }
  })

  inventoryItems.sort((left, right) => left.statusText.localeCompare(right.statusText))

  const missingCount = inventoryItems.filter((item) => item.statusText === '缺货').length
  const inStockCount = inventoryItems.length - missingCount

  return {
    summary: {
      totalText: String(inventoryItems.length),
      inStockText: String(inStockCount),
      missingText: String(missingCount)
    },
    items: inventoryItems,
    generateButtonText: `生成采购清单 (${missingCount})`
  }
}

Page({
  data: {
    loading: true,
    activeSpaceId: '',
    items: [],
    groups: [],
    summary: '正在读取计划...',
    errorMessage: '',
    emptyMessage: '这个空间还没有用餐计划，点击下方开始添加。',
    showEmptyState: false,
    truncationMessage: '',
    currentDateLabel: createTodayDisplayLabel(),
    todayIso: createTodayIso(),
    weekDayLabels: WEEKDAY_LABELS,
    viewMonthKey: createTodayIso().slice(0, 7),
    viewMonthLabel: formatMonthLabel(createTodayIso().slice(0, 7)),
    monthPlanCount: '0',
    calendarItems: [],
    selectedDate: '',
    selectedDateTitle: '',
    selectedPlanCountText: '0 个安排',
    selectedPlans: [],
    showInventoryModal: false,
    inventoryModalLoading: false,
    inventoryCheckDateLabel: '',
    inventorySummary: {
      totalText: '0',
      inStockText: '0',
      missingText: '0'
    },
    inventoryItems: [],
    inventoryGenerateButtonText: '生成采购清单 (0)'
  },

  onShow() {
    this.recipeDetailCache = new Map()
    syncCurrentTabBar(this, '/pages/meal-plans/index')
    this.loadMealPlans()
  },

  async onPullDownRefresh() {
    await this.loadMealPlans()
    wx.stopPullDownRefresh()
  },

  syncCalendarView(overrides = {}) {
    const nextState = {
      ...this.data,
      ...overrides
    }
    const items = Array.isArray(nextState.items) ? nextState.items : []
    const planCountsByDate = buildPlanCountByDate(items)
    const plansByDate = buildPlansByDate(items)
    const selectedDate = resolveSelectedDate(
      nextState.viewMonthKey,
      nextState.selectedDate,
      nextState.todayIso,
      planCountsByDate
    )
    const selectedPlans = buildSelectedPlanItems(plansByDate[selectedDate] || [], nextState.todayIso)
    const monthPlanCount = items.filter((item) => normalizeText(item.planDate).startsWith(nextState.viewMonthKey)).length

    this.setData({
      ...overrides,
      viewMonthLabel: formatMonthLabel(nextState.viewMonthKey),
      monthPlanCount: String(monthPlanCount),
      calendarItems: buildCalendarItems(nextState.viewMonthKey, selectedDate, nextState.todayIso, planCountsByDate),
      selectedDate,
      selectedDateTitle: `${selectedDate} 的计划`,
      selectedPlanCountText: `${selectedPlans.length} 个安排`,
      selectedPlans
    })
  },

  async loadMealPlans() {
    if (!this.recipeDetailCache) {
      this.recipeDetailCache = new Map()
    }
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId,
      currentDateLabel: createTodayDisplayLabel(),
      todayIso: createTodayIso()
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        items: [],
        groups: [],
        showEmptyState: false,
        summary: '请先选择一个空间，再创建用餐计划。',
        truncationMessage: ''
      })
      this.syncCalendarView({
        items: [],
        selectedDate: '',
        monthPlanCount: '0'
      })
      return
    }

    try {
      const result = await createMealPlanService().listMealPlans(activeSpaceId)
      const items = Array.isArray(result.items) ? result.items : []
      const groups = groupPlansByDate(items)
      const total = typeof result.total === 'number' ? result.total : items.length
      const hasMore = Boolean(result.hasMore)
      this.setData({
        loading: false,
        items,
        groups,
        showEmptyState: groups.length === 0,
        summary: groups.length ? `已安排 ${total} 条用餐计划。` : '暂无用餐计划。',
        emptyMessage: '这个空间还没有用餐计划，点击下方开始添加。',
        truncationMessage: hasMore ? '当前仅显示部分计划，请继续缩小范围或等待分页支持。' : ''
      })
      this.syncCalendarView({
        items
      })
    } catch (error) {
      this.setData({
        loading: false,
        items: [],
        groups: [],
        showEmptyState: false,
        summary: '计划加载失败，请稍后重试。',
        errorMessage: getErrorMessage(error),
        truncationMessage: ''
      })
      this.syncCalendarView({
        items: []
      })
    }
  },

  goPrevMonth() {
    this.syncCalendarView({
      viewMonthKey: shiftMonthKey(this.data.viewMonthKey, -1),
      selectedDate: ''
    })
  },

  goNextMonth() {
    this.syncCalendarView({
      viewMonthKey: shiftMonthKey(this.data.viewMonthKey, 1),
      selectedDate: ''
    })
  },

  goToday() {
    const todayIso = this.data.todayIso || createTodayIso()
    this.syncCalendarView({
      viewMonthKey: todayIso.slice(0, 7),
      selectedDate: todayIso
    })
  },

  handleCalendarDateSelect(event) {
    const date = event && event.currentTarget && event.currentTarget.dataset
      ? normalizeText(event.currentTarget.dataset.date)
      : ''
    if (!date) {
      return
    }
    this.syncCalendarView({
      selectedDate: date
    })
  },

  goCreate() {
    if (!this.data.activeSpaceId) {
      wx.showToast({
        title: '请先选择空间',
        icon: 'none'
      })
      return
    }
    wx.navigateTo({
      url: '/pages/meal-plan-edit/index'
    })
  },

  handleSelectMealPlan(event) {
    const mealPlanId = event && event.currentTarget && event.currentTarget.dataset
      ? event.currentTarget.dataset.mealPlanId
      : event.detail.mealPlanId
    if (!mealPlanId) {
      return
    }
    wx.navigateTo({
      url: `/pages/meal-plan-edit/index?mealPlanId=${mealPlanId}`
    })
  },

  openSpace() {
    wx.navigateTo({
      url: '/pages/space/index'
    })
  },

  noop() {},

  async openInventoryCheck() {
    if (!this.data.activeSpaceId) {
      return
    }
    if (!this.data.selectedPlans || !this.data.selectedPlans.length) {
      wx.showToast({
        title: '当天暂无计划',
        icon: 'none'
      })
      return
    }

    this.setData({
      showInventoryModal: true,
      inventoryModalLoading: true,
      inventoryCheckDateLabel: this.data.selectedDate
    })

    try {
      const recipeIds = Array.from(
        new Set(
          (this.data.selectedPlans || [])
            .reduce(
              (result, plan) =>
                result.concat((plan.recipes || []).map((recipe) => normalizeText(recipe.recipeId))),
              []
            )
            .filter(Boolean)
        )
      )

      const recipeService = createRecipeService()
      const missingIds = recipeIds.filter((id) => !this.recipeDetailCache.has(id))
      if (missingIds.length) {
        const results = await Promise.all(
          missingIds.map((recipeId) => recipeService.getRecipeDetail(this.data.activeSpaceId, recipeId))
        )
        results.forEach((result) => {
          if (result && result.item && result.item._id) {
            this.recipeDetailCache.set(result.item._id, result.item)
          }
        })
      }

      const pantryResult = await createPantryService().listPantry(this.data.activeSpaceId, {})
      const inventoryResult = buildInventoryCheckResult(
        this.data.selectedPlans,
        recipeIds.map((id) => this.recipeDetailCache.get(id)).filter(Boolean),
        pantryResult.items || []
      )

      this.setData({
        inventoryModalLoading: false,
        inventorySummary: inventoryResult.summary,
        inventoryItems: inventoryResult.items,
        inventoryGenerateButtonText: inventoryResult.generateButtonText
      })
    } catch (error) {
      this.setData({
        inventoryModalLoading: false
      })
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  closeInventoryModal() {
    this.setData({
      showInventoryModal: false
    })
  },

  generateShoppingList() {
    wx.showToast({
      title: '生成采购清单待实现',
      icon: 'none'
    })
  }
})
