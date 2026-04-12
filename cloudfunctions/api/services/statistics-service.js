const { ERROR_CODES } = require('../shared/constants/error-codes')
const { buildShoppingProgress } = require('../shared/domain/shopping')

const EXPIRING_SOON_DAYS = 3

function toAppError(message, code, data = null) {
  const error = new Error(message)
  error.code = code
  error.data = data
  return error
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveNowIso(options = {}) {
  if (typeof options.nowIso === 'function') {
    return options.nowIso()
  }
  return new Date().toISOString()
}

function isUpcomingExpiration(expirationDate, nowIso) {
  if (typeof expirationDate !== 'string' || !expirationDate) {
    return false
  }
  const currentDate = new Date(nowIso.slice(0, 10) + 'T00:00:00.000Z')
  const targetDate = new Date(expirationDate + 'T00:00:00.000Z')
  if (Number.isNaN(currentDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    return false
  }
  const diffDays = Math.round((targetDate.getTime() - currentDate.getTime()) / 86400000)
  return diffDays >= 0 && diffDays <= EXPIRING_SOON_DAYS
}

async function getStatisticsDashboard(event = {}, context = {}, repository = {}, options = {}) {
  const spaceId = normalizeId(event.spaceId)
  if (!spaceId) {
    throw toAppError('spaceId is required', ERROR_CODES.INVALID_INPUT)
  }

  const [recipes, pantryItems, shoppingLists, members, recentBackup] = await Promise.all([
    repository.listRecipes(spaceId, { deletedAt: '' }),
    repository.listPantryItems(spaceId, { deletedAt: '' }),
    repository.listShoppingLists(spaceId, { deletedAt: '' }),
    repository.listSpaceMembers
      ? repository.listSpaceMembers(spaceId)
      : repository.listMembers
        ? repository.listMembers(spaceId)
        : [],
    repository.getRecentBackupRecord
      ? repository.getRecentBackupRecord(spaceId)
      : null
  ])

  const allShoppingItems = []
  for (const list of shoppingLists || []) {
    const items = await repository.listShoppingItems(spaceId, list._id, { deletedAt: '' })
    allShoppingItems.push(...(items || []))
  }

  const nowIso = resolveNowIso(options)
  const upcomingExpirations = (pantryItems || []).filter((item) =>
    isUpcomingExpiration(item.expirationDate, nowIso)
  ).length

  return {
    recipeCount: (recipes || []).length,
    pantryCount: (pantryItems || []).length,
    upcomingExpirations,
    shoppingProgress: buildShoppingProgress(allShoppingItems),
    memberCount: (members || []).length,
    recentBackup: recentBackup
      ? {
          status: 'available',
          updatedAt: recentBackup.updatedAt || recentBackup.createdAt || ''
        }
      : {
          status: 'not-available',
          updatedAt: ''
        }
  }
}

module.exports = {
  getStatisticsDashboard
}
