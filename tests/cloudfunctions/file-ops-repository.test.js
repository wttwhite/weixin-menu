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
          async set({ data }) {
            const sourceData = { _id: id, ...data }
            const shouldFailLimit =
              typeof mockDb.failAddLimit === 'function' && mockDb.failAddLimit(name, sourceData)
            if (shouldFailLimit) {
              const error = new Error(
                'collection.add:fail -501003 exceed request limit. [LimitExceeded.OutOte request overrun]'
              )
              error.code = -501003
              throw error
            }
            if (typeof mockDb.failAddOnce === 'function' && mockDb.failAddOnce(name, sourceData)) {
              mockDb.failAddOnce = null
              const error = new Error(
                'collection.add:fail -501003 exceed request limit. [LimitExceeded.OutOte request overrun]'
              )
              error.code = -501003
              throw error
            }
            if (typeof mockDb.failAdd === 'function' && mockDb.failAdd(name, sourceData)) {
              throw new Error('mock set failed')
            }
            operations.push({ type: 'set', scope, collection: name, id, data })
            return {}
          },
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
  it('restores large backups with direct overwrite writes instead of clearing first', async () => {
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

    const removeOperations = db.operations.filter((operation) => operation.type === 'remove')
    const setOperations = db.operations.filter((operation) => operation.type === 'set')
    expect(removeOperations).toHaveLength(0)
    expect(setOperations).toHaveLength(137)
    expect(setOperations.every((operation) => operation.scope === 'direct')).toBe(true)
  })

  it('uses direct overwrite writes when transactional add writes would hit cloud request limits', async () => {
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
          type: 'set',
          scope: 'direct',
          collection: 'recipes',
          id: 'recipe-0',
          data: expect.not.objectContaining({ _id: 'recipe-0' })
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
        stage: 'setRecord',
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

    const recipeSets = db.operations.filter(
      (operation) => operation.type === 'set' && operation.collection === 'recipes'
    )
    expect(recipeSets).toHaveLength(1)
    expect(sleeps).toEqual([1])
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
        stage: 'setRecord',
        collectionName: 'recipes',
        itemIndex: 0,
        requestLimitRetryAttempts: 2
      }
    })

    expect(sleeps).toEqual([1, 2])
  })
})
