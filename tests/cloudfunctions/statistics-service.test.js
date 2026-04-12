import { describe, expect, it } from 'vitest'
import { getStatisticsDashboard } from '../../cloudfunctions/api/services/statistics-service'

function createRepository() {
  const recipes = [{ _id: 'recipe-1', deletedAt: '' }, { _id: 'recipe-2', deletedAt: '' }]
  const pantryItems = [
    { _id: 'pantry-1', deletedAt: '', expirationDate: '2026-04-13' },
    { _id: 'pantry-2', deletedAt: '', expirationDate: '2026-04-30' }
  ]
  const shoppingLists = [{ _id: 'list-1', deletedAt: '' }]
  const shoppingItems = [
    { _id: 'item-1', checked: true, deletedAt: '' },
    { _id: 'item-2', checked: false, deletedAt: '' }
  ]
  const members = [{ openid: 'user-1' }, { openid: 'user-2' }]

  return {
    async listRecipes(spaceId, query = {}) {
      return spaceId ? recipes.filter((item) => item.deletedAt === (query.deletedAt || '')) : []
    },
    async listPantryItems(spaceId, query = {}) {
      return spaceId ? pantryItems.filter((item) => item.deletedAt === (query.deletedAt || '')) : []
    },
    async listShoppingLists(spaceId, query = {}) {
      return spaceId ? shoppingLists.filter((item) => item.deletedAt === (query.deletedAt || '')) : []
    },
    async listShoppingItems() {
      return shoppingItems.map((item) => ({ ...item }))
    },
    async listSpaceMembers() {
      return members.map((item) => ({ ...item }))
    },
    async getRecentBackupRecord() {
      return null
    }
  }
}

describe('statistics service', () => {
  it('returns dashboard aggregates', async () => {
    const result = await getStatisticsDashboard(
      { spaceId: 'space-1' },
      { openid: 'user-1' },
      createRepository(),
      {
        nowIso: () => '2026-04-12T00:00:00.000Z'
      }
    )

    expect(result).toEqual({
      recipeCount: 2,
      pantryCount: 2,
      upcomingExpirations: 1,
      shoppingProgress: {
        total: 2,
        checked: 1,
        percent: 50
      },
      memberCount: 2,
      recentBackup: {
        status: 'not-available',
        updatedAt: ''
      }
    })
  })
})
