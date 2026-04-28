const { createMealPlanService } = require('../../services/meal-plan')
const { createPantryService } = require('../../services/pantry')
const { createRecipeService } = require('../../services/recipe')
const { createShoppingService } = require('../../services/shopping')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { switchToTab, syncCurrentTabBar } = require('../../utils/tab-bar')
const calendarHelper = require('./calendar')
const { syncPageTheme } = require('../../utils/theme')

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const MEAL_TYPE_LABELS = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐'
}
const MEAL_PLAN_STATUS = {
  PLANNED: 'planned',
  DONE: 'done',
  CANCELLED: 'cancelled'
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

function normalizeMealPlanStatus(value = '') {
  const status = normalizeText(value).toLowerCase()
  if (status === MEAL_PLAN_STATUS.DONE) {
    return MEAL_PLAN_STATUS.DONE
  }
  if (status === MEAL_PLAN_STATUS.CANCELLED) {
    return MEAL_PLAN_STATUS.CANCELLED
  }
  if (status === MEAL_PLAN_STATUS.PLANNED) {
    return MEAL_PLAN_STATUS.PLANNED
  }
  return ''
}

function resolveLegacyPlanStatus(planDate = '', todayIso = '') {
  const compareResult = compareIsoDate(planDate, todayIso)
  if (compareResult < 0) {
    return MEAL_PLAN_STATUS.DONE
  }
  if (compareResult === 0) {
    return MEAL_PLAN_STATUS.PLANNED
  }
  return MEAL_PLAN_STATUS.PLANNED
}

function buildPlanStatusMeta(plan = {}, todayIso = '') {
  const normalizedStatus = normalizeMealPlanStatus(plan.status) || resolveLegacyPlanStatus(plan.planDate, todayIso)
  if (normalizedStatus === MEAL_PLAN_STATUS.DONE) {
    return {
      value: normalizedStatus,
      text: '已完成',
      className: 'plan-card__status plan-card__status--done',
      iconText: '✓',
      toolClass: 'plan-card__tool plan-card__tool--status plan-card__tool--done',
      toolLabel: '标记为已取消'
    }
  }
  if (normalizedStatus === MEAL_PLAN_STATUS.CANCELLED) {
    return {
      value: normalizedStatus,
      text: '已取消',
      className: 'plan-card__status plan-card__status--cancelled',
      iconText: '−',
      toolClass: 'plan-card__tool plan-card__tool--status plan-card__tool--cancelled',
      toolLabel: '恢复为待执行'
    }
  }
  if (compareIsoDate(plan.planDate, todayIso) === 0) {
    return {
      value: normalizedStatus,
      text: '进行中',
      className: 'plan-card__status plan-card__status--today',
      iconText: '◔',
      toolClass: 'plan-card__tool plan-card__tool--status plan-card__tool--today',
      toolLabel: '标记为已完成'
    }
  }
  return {
    value: normalizedStatus,
    text: '待执行',
    className: 'plan-card__status plan-card__status--upcoming',
    iconText: '◔',
    toolClass: 'plan-card__tool plan-card__tool--status plan-card__tool--upcoming',
    toolLabel: '标记为已完成'
  }
}

function getNextMealPlanStatus(status = '') {
  const normalizedStatus = normalizeMealPlanStatus(status) || MEAL_PLAN_STATUS.PLANNED
  if (normalizedStatus === MEAL_PLAN_STATUS.PLANNED) {
    return MEAL_PLAN_STATUS.DONE
  }
  if (normalizedStatus === MEAL_PLAN_STATUS.DONE) {
    return MEAL_PLAN_STATUS.CANCELLED
  }
  return MEAL_PLAN_STATUS.PLANNED
}

function buildPlanRecipeTagItems(recipes = []) {
  return (Array.isArray(recipes) ? recipes : [])
    .map((recipe) => {
      const recipeId = normalizeText(recipe && ((recipe.recipe && recipe.recipe._id) || recipe.recipeId))
      const label = normalizeText((recipe && recipe.recipe && recipe.recipe.name) || (recipe && recipe.recipeNameSnapshot) || '')
      if (!label) {
        return null
      }
      return {
        recipeId,
        label
      }
    })
    .filter(Boolean)
}

function buildSelectedPlanItems(items = [], todayIso = '') {
  return (items || []).map((item) => {
    const recipeTagItems = buildPlanRecipeTagItems(item.recipes || [])
    const recipeTags = recipeTagItems.map((recipe) => recipe.label)
    const statusMeta = buildPlanStatusMeta(item, todayIso)

    return {
      ...item,
      status: statusMeta.value,
      mealTypeLabel: buildMealTypeLabel(item.mealType),
      primaryRecipeName: recipeTags[0] || '未关联菜谱',
      recipeTags,
      recipeTagItems: recipeTagItems.slice(0, 4),
      statusText: statusMeta.text,
      statusClass: statusMeta.className,
      statusIconText: statusMeta.iconText,
      statusToolClass: statusMeta.toolClass,
      statusToolLabel: statusMeta.toolLabel,
      planCountText: `${recipeTags.length || 0} 道菜`,
      utensilText: '🍽'
    }
  })
}

function buildCalendarViewportStyle(presentation = {}) {
  return `height: ${presentation.viewportHeightRpx || calendarHelper.CALENDAR_ROW_HEIGHT_RPX}rpx;`
}

function buildCalendarGridStyle(presentation = {}) {
  const translateYRpx = presentation.translateYRpx || 0
  return `transform: translateY(${translateYRpx ? `-${translateYRpx}` : 0}rpx);`
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
    const pantryStatus = normalizeText(item.status)
    return pantryStatus !== 'empty' && pantryStatus !== 'discarded' && pantryStatus !== 'expired'
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
      quantityText: item.quantityText,
      unit: item.unit,
      requiredText: `需要: ${formatQuantity(item.quantityText, item.unit)} · ${Array.from(item.sources).join(' / ')}`,
      stockText: stock ? `库存: ${formatQuantity(stock.quantityText, item.unit)}` : '库存: 0',
      statusText: inStock ? '有库存' : '缺货',
      selectable: !inStock,
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

function buildInventorySelectedKeys(items = []) {
  return (items || [])
    .filter((item) => item && item.selectable)
    .map((item) => item.key)
}

function decorateInventoryItems(items = [], selectedKeys = []) {
  const selectedKeySet = new Set(selectedKeys || [])
  return (items || []).map((item) => {
    const selected = Boolean(item.selectable && selectedKeySet.has(item.key))
    return {
      ...item,
      selected,
      checkboxClass: selected
        ? 'inventory-item__checkbox inventory-item__checkbox--selected'
        : 'inventory-item__checkbox'
    }
  })
}

function buildInventoryGenerateButtonText(selectedKeys = []) {
  return `生成采购清单 (${(selectedKeys || []).length})`
}

function buildShoppingListName(dateLabel = '') {
  return `${dateLabel} 食材补货`
}

function buildShoppingItemDraftFromInventoryItem(item = {}, dateLabel = '') {
  return {
    name: item.name || '',
    category: '',
    quantity: item.quantityText || '',
    unit: item.unit || '',
    isChecked: false,
    sourceType: 'manual',
    notes: `来自 ${dateLabel} 库存检查`
  }
}

function buildMealPlanUpdatePayload(item = {}, nextStatus = '') {
  return {
    planDate: item.planDate || '',
    mealType: item.mealType || '',
    status: nextStatus || normalizeMealPlanStatus(item.status) || MEAL_PLAN_STATUS.PLANNED,
    notes: item.notes || '',
    recipes: (Array.isArray(item.recipes) ? item.recipes : [])
      .map((recipe) => ({
        recipeId: recipe.recipeId || '',
        servingsOverride: recipe.servingsOverride || '',
        notes: recipe.notes || ''
      }))
      .filter((recipe) => recipe.recipeId)
  }
}

function buildMealPlanStatusChipItems(status = '') {
  const normalizedStatus = normalizeMealPlanStatus(status) || MEAL_PLAN_STATUS.PLANNED
  return [
    {
      value: MEAL_PLAN_STATUS.PLANNED,
      label: '计划中',
      active: normalizedStatus === MEAL_PLAN_STATUS.PLANNED,
      itemClass:
        normalizedStatus === MEAL_PLAN_STATUS.PLANNED
          ? 'meal-plan-status-chip meal-plan-status-chip--active'
          : 'meal-plan-status-chip'
    },
    {
      value: MEAL_PLAN_STATUS.DONE,
      label: '已完成',
      active: normalizedStatus === MEAL_PLAN_STATUS.DONE,
      itemClass:
        normalizedStatus === MEAL_PLAN_STATUS.DONE
          ? 'meal-plan-status-chip meal-plan-status-chip--active'
          : 'meal-plan-status-chip'
    },
    {
      value: MEAL_PLAN_STATUS.CANCELLED,
      label: '已取消',
      active: normalizedStatus === MEAL_PLAN_STATUS.CANCELLED,
      itemClass:
        normalizedStatus === MEAL_PLAN_STATUS.CANCELLED
          ? 'meal-plan-status-chip meal-plan-status-chip--active'
          : 'meal-plan-status-chip'
    }
  ]
}

function buildMealPlanStatusModalView(item = {}, todayIso = '') {
  const selectedPlan = buildSelectedPlanItems([item], todayIso)[0] || item
  const recipeItems = (selectedPlan.recipeTagItems || []).map((recipe) => ({
    ...recipe,
    itemClass: recipe.recipeId
      ? 'meal-plan-status-modal__recipe-item'
      : 'meal-plan-status-modal__recipe-item meal-plan-status-modal__recipe-item--disabled'
  }))
  return {
    mealPlanStatusModalId: selectedPlan._id || '',
    mealPlanStatusModalTitle: `${selectedPlan.mealTypeLabel || '餐次'}${selectedPlan.primaryRecipeName ? `：${selectedPlan.primaryRecipeName}` : ''}`,
    mealPlanStatusModalDate: selectedPlan.planDate || '',
    mealPlanStatusModalMealTypeLabel: selectedPlan.mealTypeLabel || buildMealTypeLabel(selectedPlan.mealType),
    mealPlanStatusModalStatus: normalizeMealPlanStatus(selectedPlan.status) || MEAL_PLAN_STATUS.PLANNED,
    mealPlanStatusChipItems: buildMealPlanStatusChipItems(selectedPlan.status),
    mealPlanStatusModalRecipeItems: recipeItems,
    mealPlanStatusModalRecipeCountText: `菜谱 (${recipeItems.length})`
  }
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
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
    isCalendarExpanded: false,
    calendarItems: [],
    calendarRowCount: 0,
    calendarViewportStyle: 'height: 88rpx;',
    calendarGridStyle: 'transform: translateY(0rpx);',
    selectedDate: '',
    selectedDateTitle: '',
    selectedPlanCountText: '0 个安排',
    selectedPlans: [],
    showMealPlanStatusModal: false,
    mealPlanStatusModalId: '',
    mealPlanStatusModalTitle: '',
    mealPlanStatusModalDate: '',
    mealPlanStatusModalMealTypeLabel: '',
    mealPlanStatusModalStatus: 'planned',
    mealPlanStatusChipItems: [],
    mealPlanStatusModalRecipeCountText: '菜谱 (0)',
    mealPlanStatusModalRecipeItems: [],
    showInventoryModal: false,
    inventoryModalLoading: false,
    inventoryCheckDateLabel: '',
    inventorySummary: {
      totalText: '0',
      inStockText: '0',
      missingText: '0'
    },
    inventorySelectedKeys: [],
    inventoryItems: [],
    inventoryGenerateButtonText: '生成采购清单 (0)'
  },

  onShow() {
    if (!this.recipeDetailCache) {
      this.recipeDetailCache = new Map()
    }
    syncPageTheme(this)
    syncCurrentTabBar(this, '/pages/meal-plans/index')
    if (this.shouldReuseLoadedState()) {
      return
    }
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
    const selectedDate = calendarHelper.resolveSelectedDate(
      nextState.viewMonthKey,
      nextState.selectedDate,
      nextState.todayIso,
      planCountsByDate
    )
    const selectedPlans = buildSelectedPlanItems(plansByDate[selectedDate] || [], nextState.todayIso)
    const monthPlanCount = items.filter((item) => normalizeText(item.planDate).startsWith(nextState.viewMonthKey)).length
    const calendarItems = calendarHelper.buildCalendarItems(
      nextState.viewMonthKey,
      selectedDate,
      nextState.todayIso,
      planCountsByDate
    )
    const calendarPresentation = calendarHelper.buildCalendarPresentation(
      calendarItems,
      selectedDate,
      nextState.isCalendarExpanded
    )

    this.setData({
      ...overrides,
      viewMonthLabel: calendarHelper.formatMonthLabel(nextState.viewMonthKey),
      monthPlanCount: String(monthPlanCount),
      calendarItems,
      calendarRowCount: calendarPresentation.rowCount,
      calendarViewportStyle: buildCalendarViewportStyle(calendarPresentation),
      calendarGridStyle: buildCalendarGridStyle(calendarPresentation),
      selectedDate,
      selectedDateTitle: `${selectedDate} 的计划`,
      selectedPlanCountText: `${selectedPlans.length} 个安排`,
      selectedPlans
    })
  },

  markNeedsRefreshOnNextShow() {
    this.forceRefreshOnNextShow = true
  },

  shouldReuseLoadedState() {
    if (this.forceRefreshOnNextShow) {
      this.forceRefreshOnNextShow = false
      return false
    }

    return Boolean(this.hasLoadedMealPlansOnce) &&
      !this.data.errorMessage &&
      this.data.activeSpaceId === getActiveSpaceId()
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
      this.hasLoadedMealPlansOnce = true
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
      this.hasLoadedMealPlansOnce = true
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
      this.hasLoadedMealPlansOnce = false
    }
  },

  goPrevMonth() {
    this.syncCalendarView({
      viewMonthKey: calendarHelper.shiftMonthKey(this.data.viewMonthKey, -1),
      selectedDate: ''
    })
  },

  goNextMonth() {
    this.syncCalendarView({
      viewMonthKey: calendarHelper.shiftMonthKey(this.data.viewMonthKey, 1),
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
    const nextMonthKey = date.slice(0, 7)
    if (nextMonthKey && nextMonthKey !== this.data.viewMonthKey) {
      this.syncCalendarView({
        viewMonthKey: nextMonthKey,
        selectedDate: date
      })
      return
    }
    this.syncCalendarView({
      selectedDate: date
    })
  },

  toggleCalendarExpanded() {
    this.syncCalendarView({
      isCalendarExpanded: !this.data.isCalendarExpanded
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

  handlePlanRecipeTap(event) {
    const recipeId = event && event.currentTarget && event.currentTarget.dataset
      ? normalizeText(event.currentTarget.dataset.recipeId)
      : ''
    if (!recipeId) {
      return
    }

    wx.navigateTo({
      url: `/pages/recipe-detail/index?recipeId=${recipeId}&from=plans`
    })
  },

  handleToggleMealPlanStatus(event) {
    const mealPlanId = event && event.currentTarget && event.currentTarget.dataset
      ? normalizeText(event.currentTarget.dataset.mealPlanId)
      : ''
    if (!mealPlanId) {
      return
    }

    const currentItem = (this.data.items || []).find((item) => item && item._id === mealPlanId)
    if (!currentItem) {
      return
    }

    this.setData({
      showMealPlanStatusModal: true,
      ...buildMealPlanStatusModalView(currentItem, this.data.todayIso)
    })
  },

  closeMealPlanStatusModal() {
    this.setData({
      showMealPlanStatusModal: false,
      mealPlanStatusModalId: '',
      mealPlanStatusModalTitle: '',
      mealPlanStatusModalDate: '',
      mealPlanStatusModalMealTypeLabel: '',
      mealPlanStatusModalStatus: MEAL_PLAN_STATUS.PLANNED,
      mealPlanStatusChipItems: [],
      mealPlanStatusModalRecipeCountText: '菜谱 (0)',
      mealPlanStatusModalRecipeItems: []
    })
  },

  async selectMealPlanStatus(event) {
    const nextStatus = event && event.currentTarget && event.currentTarget.dataset
      ? normalizeText(event.currentTarget.dataset.status)
      : ''
    const mealPlanId = this.data.mealPlanStatusModalId
    if (!mealPlanId || !this.data.activeSpaceId || !nextStatus) {
      return
    }

    const currentItem = (this.data.items || []).find((item) => item && item._id === mealPlanId)
    if (!currentItem) {
      return
    }

    const optimisticItem = {
      ...currentItem,
      status: nextStatus
    }
    const optimisticItems = (this.data.items || []).map((item) => (item && item._id === mealPlanId ? optimisticItem : item))

    this.setData({
      items: optimisticItems,
      ...buildMealPlanStatusModalView(optimisticItem, this.data.todayIso)
    })
    this.syncCalendarView({
      items: optimisticItems
    })

    try {
      const result = await createMealPlanService().updateMealPlan(
        this.data.activeSpaceId,
        mealPlanId,
        buildMealPlanUpdatePayload(currentItem, nextStatus)
      )
      const nextItem = result && result.item ? result.item : { ...currentItem, status: nextStatus }
      const nextItems = (this.data.items || []).map((item) => (item && item._id === mealPlanId ? nextItem : item))
      this.setData({
        items: nextItems,
        ...buildMealPlanStatusModalView(nextItem, this.data.todayIso)
      })
      this.syncCalendarView({
        items: nextItems
      })
      wx.showToast({
        title: '状态已更新',
        icon: 'success'
      })
    } catch (error) {
      const rollbackItems = (this.data.items || []).map((item) => (item && item._id === mealPlanId ? currentItem : item))
      this.setData({
        items: rollbackItems,
        ...buildMealPlanStatusModalView(currentItem, this.data.todayIso)
      })
      this.syncCalendarView({
        items: rollbackItems
      })
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  },

  async removeSelectedMealPlan() {
    const mealPlanId = this.data.mealPlanStatusModalId
    if (!mealPlanId || !this.data.activeSpaceId) {
      return
    }

    try {
      await createMealPlanService().deleteMealPlan(this.data.activeSpaceId, mealPlanId)
      const nextItems = (this.data.items || []).filter((item) => item && item._id !== mealPlanId)
      this.setData({
        items: nextItems
      })
      this.closeMealPlanStatusModal()
      this.syncCalendarView({
        items: nextItems
      })
      wx.showToast({
        title: '已删除计划',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
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
      inventoryCheckDateLabel: this.data.selectedDate,
      inventorySelectedKeys: []
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
      const inventorySelectedKeys = buildInventorySelectedKeys(inventoryResult.items)

      this.setData({
        inventoryModalLoading: false,
        inventorySummary: inventoryResult.summary,
        inventorySelectedKeys,
        inventoryItems: decorateInventoryItems(inventoryResult.items, inventorySelectedKeys),
        inventoryGenerateButtonText: buildInventoryGenerateButtonText(inventorySelectedKeys)
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
      showInventoryModal: false,
      inventorySelectedKeys: []
    })
  },

  toggleInventorySelection(event) {
    const key = event && event.currentTarget && event.currentTarget.dataset
      ? normalizeText(event.currentTarget.dataset.key)
      : ''
    if (!key) {
      return
    }

    const targetItem = (this.data.inventoryItems || []).find((item) => item.key === key)
    if (!targetItem || !targetItem.selectable) {
      return
    }

    const currentKeys = Array.isArray(this.data.inventorySelectedKeys) ? this.data.inventorySelectedKeys : []
    const nextKeys = currentKeys.includes(key)
      ? currentKeys.filter((item) => item !== key)
      : currentKeys.concat(key)

    this.setData({
      inventorySelectedKeys: nextKeys,
      inventoryItems: decorateInventoryItems(this.data.inventoryItems || [], nextKeys),
      inventoryGenerateButtonText: buildInventoryGenerateButtonText(nextKeys)
    })
  },

  async generateShoppingList() {
    const selectedKeys = Array.isArray(this.data.inventorySelectedKeys) ? this.data.inventorySelectedKeys : []
    if (!selectedKeys.length) {
      wx.showToast({
        title: '请先选择缺货食材',
        icon: 'none'
      })
      return
    }

    const selectedItems = (this.data.inventoryItems || []).filter((item) => selectedKeys.includes(item.key))
    if (!selectedItems.length) {
      wx.showToast({
        title: '请先选择缺货食材',
        icon: 'none'
      })
      return
    }

    try {
      const shoppingService = createShoppingService()
      const shoppingListName = buildShoppingListName(this.data.inventoryCheckDateLabel)
      const created = await shoppingService.createShoppingList(this.data.activeSpaceId, {
        name: shoppingListName,
        listDate: this.data.inventoryCheckDateLabel,
        status: 'open',
        notes: ''
      })

      let expectedUpdatedAt = created && created.item ? created.item.updatedAt || '' : ''
      const shoppingListId = created && created.item ? created.item._id : ''

      for (const item of selectedItems) {
        const updated = await shoppingService.updateShoppingList(
          this.data.activeSpaceId,
          shoppingListId,
          {
            name: shoppingListName,
            listDate: this.data.inventoryCheckDateLabel,
            status: 'open',
            notes: '',
            itemDraft: buildShoppingItemDraftFromInventoryItem(item, this.data.inventoryCheckDateLabel)
          },
          expectedUpdatedAt
        )
        expectedUpdatedAt = updated && updated.item ? updated.item.updatedAt || expectedUpdatedAt : expectedUpdatedAt
      }

      this.setData({
        showInventoryModal: false,
        inventorySelectedKeys: []
      })
      wx.showToast({
        title: '采购清单已生成',
        icon: 'success'
      })
      await switchToTab('/pages/shopping/index')
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  }
})
