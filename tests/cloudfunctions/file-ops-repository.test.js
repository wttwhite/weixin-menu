import { describe, expect, it, vi } from 'vitest'
import { createRepository } from '../../cloudfunctions/fileOps/index'

function createMockDb() {
  const operations = []
  const mockDb = {
    failAdd: null,
    failAddLimit: null,
    failTransactionAddLimit: null,
    failAddOnce: null
  }
  let transactionIndex = 0

  function createCollection(scope, name) {
    return {
      where(query) {
        return {
          async remove() {
            operations.push({ type: 'remove', scope, collection: name, query })
            return {}
          }
        }
      },
      doc(id) {
        return {
          async update({ data }) {
            operations.push({ type: 'update', scope, collection: name, id, data })
            return {}
          }
        }
      },
      async add({ data }) {
        const shouldFailLimit =
          typeof mockDb.failAddLimit === 'function' && mockDb.failAddLimit(name, data)
        const shouldFailTransactionLimit =
          scope !== 'direct' &&
          typeof mockDb.failTransactionAddLimit === 'function' &&
          mockDb.failTransactionAddLimit(name, data)
        if (shouldFailLimit || shouldFailTransactionLimit) {
          const error = new Error(
            'collection.add:fail -501003 exceed request limit. [LimitExceeded.OutOte request overrun]'
          )
          error.code = -501003
          throw error
        }
        if (typeof mockDb.failAddOnce === 'function' && mockDb.failAddOnce(name, data)) {
          mockDb.failAddOnce = null
          const error = new Error(
            'collection.add:fail -501003 exceed request limit. [LimitExceeded.OutOte request overrun]'
          )
          error.code = -501003
          throw error
        }
        if (typeof mockDb.failAdd === 'function' && mockDb.failAdd(name, data)) {
          throw new Error('mock add failed')
        }
        operations.push({ type: 'add', scope, collection: name, data })
        return { _id: data._id }
      }
    }
  }

  function createTransaction() {
    transactionIndex += 1
    const tx = transactionIndex
    return {
      collection(name) {
        return createCollection(`tx-${tx}`, name)
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
    get failAddLimit() {
      return mockDb.failAddLimit
    },
    set failAddLimit(value) {
      mockDb.failAddLimit = value
    },
    get failTransactionAddLimit() {
      return mockDb.failTransactionAddLimit
    },
    set failTransactionAddLimit(value) {
      mockDb.failTransactionAddLimit = value
    },
    get failAddOnce() {
      return mockDb.failAddOnce
    },
    set failAddOnce(value) {
      mockDb.failAddOnce = value
    },
    operations,
    async startTransaction() {
      return createTransaction()
    },
    collection(name) {
      return createCollection('direct', name)
    }
  }
}

describe('fileOps repository', () => {
  it('restores large backups with direct writes instead of transactional writes', async () => {
    const db = createMockDb()
    const repository = createRepository({
      cloudSdk: {
        DYNAMIC_CURRENT_ENV: 'test-env',
        init: vi.fn(),
        database: () => db
      },
      db,
      sleep: async () => {},
      restoreRetryDelayMs: 0
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
    expect(addOperations.every((operation) => operation.scope === 'direct')).toBe(true)
  })

  it('uses direct restore writes when transactional writes hit cloud request limits', async () => {
    const db = createMockDb()
    db.failTransactionAddLimit = (collection, data) => collection === 'recipes' && data._id === 'recipe-0'
    const repository = createRepository({
      cloudSdk: {
        DYNAMIC_CURRENT_ENV: 'test-env',
        init: vi.fn(),
        database: () => db
      },
      db,
      sleep: async () => {},
      restoreRetryDelayMs: 0
    })

    await repository.replaceSpaceData('space-1', {
      recipes: [{ _id: 'recipe-0' }],
      recipeTags: [],
      recipeImages: [],
      pantryItems: [],
      mealPlans: [],
      shoppingLists: [],
      shoppingItems: [],
      settings: {}
    })

    expect(db.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'add',
          scope: 'direct',
          collection: 'recipes',
          data: expect.objectContaining({ _id: 'recipe-0' })
        })
      ])
    )
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
      db,
      sleep: async () => {},
      restoreRetryDelayMs: 0
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

  it('retries restore writes when cloud database request limit is exceeded', async () => {
    const db = createMockDb()
    const sleeps = []
    db.failAddOnce = (collection, data) => collection === 'recipes' && data._id === 'recipe-0'
    const repository = createRepository({
      cloudSdk: {
        DYNAMIC_CURRENT_ENV: 'test-env',
        init: vi.fn(),
        database: () => db
      },
      db,
      sleep: async (delay) => {
        sleeps.push(delay)
      },
      restoreRetryDelayMs: 1
    })

    await repository.replaceSpaceData('space-1', {
      recipes: [{ _id: 'recipe-0' }],
      recipeTags: [],
      recipeImages: [],
      pantryItems: [],
      mealPlans: [],
      shoppingLists: [],
      shoppingItems: [],
      settings: {}
    })

    const recipeAdds = db.operations.filter(
      (operation) => operation.type === 'add' && operation.collection === 'recipes'
    )
    expect(recipeAdds).toHaveLength(1)
    expect(sleeps).toEqual([1, 1])
  })

  it('reports retry attempts when cloud database request limit keeps failing', async () => {
    const db = createMockDb()
    const sleeps = []
    db.failAddLimit = (collection, data) => collection === 'recipes' && data._id === 'recipe-0'
    const repository = createRepository({
      cloudSdk: {
        DYNAMIC_CURRENT_ENV: 'test-env',
        init: vi.fn(),
        database: () => db
      },
      db,
      sleep: async (delay) => {
        sleeps.push(delay)
      },
      restoreRetryDelayMs: 1
    })

    await expect(
      repository.replaceSpaceData('space-1', {
        recipes: [{ _id: 'recipe-0' }],
        recipeTags: [],
        recipeImages: [],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    ).rejects.toMatchObject({
      data: {
        stage: 'addRecord',
        collectionName: 'recipes',
        itemIndex: 0,
        requestLimitRetryAttempts: 2
      }
    })

    expect(sleeps.slice(1, 3)).toEqual([1, 2])
  })
})
