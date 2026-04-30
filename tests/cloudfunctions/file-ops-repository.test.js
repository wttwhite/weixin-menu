import { describe, expect, it, vi } from 'vitest'
import { createRepository } from '../../cloudfunctions/fileOps/index'

function createMockDb() {
  const operations = []
  const transaction = {
    collection(name) {
      return {
        where(query) {
          return {
            async remove() {
              operations.push({ type: 'remove', collection: name, query })
              return {}
            }
          }
        },
        doc(id) {
          return {
            async update({ data }) {
              operations.push({ type: 'update', collection: name, id, data })
              return {}
            }
          }
        },
        async add({ data }) {
          operations.push({ type: 'add', collection: name, data })
          return Array.isArray(data)
            ? { ids: data.map((item) => item._id) }
            : { _id: data._id }
        }
      }
    },
    commit: vi.fn(),
    rollback: vi.fn()
  }

  return {
    operations,
    async startTransaction() {
      return transaction
    },
    collection() {
      throw new Error('outside transaction should not be used by replaceSpaceData')
    }
  }
}

describe('fileOps repository', () => {
  it('restores large backups with batched collection writes inside one transaction', async () => {
    const db = createMockDb()
    const repository = createRepository({
      cloudSdk: {
        DYNAMIC_CURRENT_ENV: 'test-env',
        init: vi.fn(),
        database: () => db
      },
      db
    })

    await repository.replaceSpaceData('space-1', {
      recipes: Array.from({ length: 16 }, (_, index) => ({ _id: `recipe-${index}` })),
      recipeTags: [],
      recipeImages: Array.from({ length: 7 }, (_, index) => ({ _id: `image-${index}` })),
      pantryItems: Array.from({ length: 89 }, (_, index) => ({ _id: `pantry-${index}` })),
      mealPlans: Array.from({ length: 10 }, (_, index) => ({ _id: `meal-${index}` })),
      shoppingLists: Array.from({ length: 3 }, (_, index) => ({ _id: `list-${index}` })),
      shoppingItems: Array.from({ length: 12 }, (_, index) => ({ _id: `item-${index}` })),
      settings: {
        recipeCategories: ['家常']
      }
    })

    const addOperations = db.operations.filter((operation) => operation.type === 'add')
    expect(addOperations).toHaveLength(6)
    expect(addOperations.every((operation) => Array.isArray(operation.data))).toBe(true)
    expect(addOperations.map((operation) => operation.data.length)).toEqual([16, 7, 89, 10, 3, 12])
    expect(db.operations).toHaveLength(14)
  })
})
