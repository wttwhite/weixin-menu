import { describe, expect, it, vi } from 'vitest'
import { createRepository } from '../../cloudfunctions/fileOps/index'

function createMockDb() {
  const operations = []
  const mockDb = {
    failAdd: null
  }
  let transactionIndex = 0

  function createTransaction() {
    transactionIndex += 1
    const tx = transactionIndex
    return {
      collection(name) {
        return {
          where(query) {
            return {
              async remove() {
                operations.push({ type: 'remove', tx, collection: name, query })
                return {}
              }
            }
          },
          doc(id) {
            return {
              async update({ data }) {
                operations.push({ type: 'update', tx, collection: name, id, data })
                return {}
              }
            }
          },
          async add({ data }) {
            if (typeof mockDb.failAdd === 'function' && mockDb.failAdd(name, data)) {
              throw new Error('mock add failed')
            }
            operations.push({ type: 'add', tx, collection: name, data })
            return { _id: data._id }
          }
        }
      },
      commit: vi.fn(),
      rollback: vi.fn()
    }
  }

  return {
    ...mockDb,
    get failAdd() {
      return mockDb.failAdd
    },
    set failAdd(value) {
      mockDb.failAdd = value
    },
    operations,
    async startTransaction() {
      return createTransaction()
    },
    collection() {
      throw new Error('outside transaction should not be used by replaceSpaceData')
    }
  }
}

describe('fileOps repository', () => {
  it('restores large backups without exceeding per-transaction write limits', async () => {
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
    expect(addOperations).toHaveLength(137)
    expect(addOperations.every((operation) => !Array.isArray(operation.data))).toBe(true)

    const writeCountByTransaction = db.operations.reduce((counts, operation) => {
      counts.set(operation.tx, (counts.get(operation.tx) || 0) + 1)
      return counts
    }, new Map())
    expect(Math.max(...writeCountByTransaction.values())).toBeLessThanOrEqual(50)
  })

  it('annotates restore write failures with collection and item index', async () => {
    const db = createMockDb()
    db.failAdd = (collection, data) => collection === 'pantry_items' && data._id === 'pantry-2'
    const repository = createRepository({
      cloudSdk: {
        DYNAMIC_CURRENT_ENV: 'test-env',
        init: vi.fn(),
        database: () => db
      },
      db
    })

    await expect(
      repository.replaceSpaceData('space-1', {
        recipes: [],
        recipeTags: [],
        recipeImages: [],
        pantryItems: Array.from({ length: 3 }, (_, index) => ({ _id: `pantry-${index}` })),
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    ).rejects.toMatchObject({
      data: {
        stage: 'addRecord',
        collectionName: 'pantry_items',
        itemIndex: 2,
        recordId: 'pantry-2'
      }
    })
  })
})
