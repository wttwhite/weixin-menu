import { beforeEach, describe, expect, it, vi } from 'vitest'

function assignByPath(target, path, value) {
  if (!path.includes('.') && !path.includes('[')) {
    target[path] = value
    return
  }

  const tokens = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)

  let current = target
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]
    const nextToken = tokens[index + 1]
    if (current[token] === undefined) {
      current[token] = /^\d+$/.test(nextToken) ? [] : {}
    }
    current = current[token]
  }
  current[tokens[tokens.length - 1]] = value
}

function createPageInstance(pageConfig) {
  const instance = {
    data: { ...(pageConfig.data || {}) },
    setData(nextData) {
      const nextState = {
        ...this.data
      }
      Object.entries(nextData).forEach(([key, value]) => {
        assignByPath(nextState, key, value)
      })
      this.data = nextState
    }
  }

  Object.keys(pageConfig).forEach((key) => {
    if (key === 'data' || typeof pageConfig[key] !== 'function') {
      return
    }
    instance[key] = pageConfig[key].bind(instance)
  })

  return instance
}

async function loadPage(modulePath) {
  let capturedPage = null
  global.Page = (config) => {
    capturedPage = config
  }

  await import(modulePath)
  return createPageInstance(capturedPage)
}

async function flushAsyncWork() {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
  delete global.Page
  delete global.wx
  delete global.getApp
})

describe('shopping page flow', () => {
  it('loads shopping lists into status tabs and filters visible cards by status', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn().mockResolvedValue({
          result: {
            code: 0,
            data: {
              items: [
                {
                  _id: 'list-open',
                  name: '周末采购',
                  listDate: '2026-04-16',
                  status: 'open',
                  updatedAt: '2026-04-16T10:00:00.000Z',
                  items: [
                    { _id: 'item-1', name: '豆瓣酱', quantity: '1', unit: '瓶', isChecked: true, sourceType: 'generated' },
                    { _id: 'item-2', name: '大麦茶', quantity: '1', unit: '盒', isChecked: false, sourceType: 'manual' }
                  ]
                },
                {
                  _id: 'list-completed',
                  name: '补货',
                  listDate: '2026-04-14',
                  status: 'completed',
                  updatedAt: '2026-04-14T08:00:00.000Z',
                  items: [{ _id: 'item-3', name: '鸡蛋', quantity: '10', unit: '个', isChecked: true, sourceType: 'manual' }]
                },
                {
                  _id: 'list-archived',
                  name: '历史采购',
                  listDate: '2026-04-01',
                  status: 'archived',
                  updatedAt: '2026-04-01T08:00:00.000Z',
                  items: []
                }
              ]
            }
          }
        })
      },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.activeFilterKey).toBe('all')
    expect(page.data.statusTabs).toEqual([
      expect.objectContaining({ key: 'all', count: 3 }),
      expect.objectContaining({ key: 'open', count: 1 }),
      expect.objectContaining({ key: 'completed', count: 1 }),
      expect.objectContaining({ key: 'archived', count: 1 })
    ])
    expect(page.data.visibleShoppingLists.map((item) => item._id)).toEqual([
      'list-open',
      'list-completed',
      'list-archived'
    ])
    expect(page.data.visibleShoppingLists[0]).toEqual(
      expect.objectContaining({
        statusTone: 'open',
        progressFillClass: 'shopping-list-card__progress-fill shopping-list-card__progress-fill--open',
        generatedSummaryText: '从计划生成，共 1 项食材'
      })
    )
    expect(page.data.visibleShoppingLists[0].manualItems.map((item) => item._id)).toEqual(['item-2'])
    expect(page.data.visibleShoppingLists[0].generatedItems.map((item) => item._id)).toEqual(['item-1'])
    expect(page.data.visibleShoppingLists[0].items[0]).not.toHaveProperty('sourceLabel')

    page.handleStatusFilterChange({
      currentTarget: {
        dataset: {
          key: 'open'
        }
      }
    })

    expect(page.data.activeFilterKey).toBe('open')
    expect(page.data.visibleShoppingLists.map((item) => item._id)).toEqual(['list-open'])
  })

  it('reuses loaded shopping data on repeated onShow when active space is unchanged', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            {
              _id: 'list-open',
              name: '周末采购',
              listDate: '2026-04-16',
              status: 'open',
              updatedAt: '2026-04-16T10:00:00.000Z',
              items: []
            }
          ]
        }
      }
    })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()
    page.onShow()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(1)
  })

  it('opens the custom create-list modal with original shopping draft fields', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn()
          .mockResolvedValueOnce({
            result: {
              code: 0,
              data: {
                items: []
              }
            }
          })
          .mockResolvedValueOnce({
            result: {
              code: 0,
              data: {
                items: [{ name: '调味料' }, { name: '乳制品' }]
              }
            }
          })
      },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openCreateListModal()

    expect(page.data.showListModal).toBe(true)
    expect(page.data.listForm).toEqual(
      expect.objectContaining({
        name: '',
        listDate: expect.any(String),
        status: 'open',
        notes: ''
      })
    )
    expect(page.data.listItemDrafts).toEqual([
      expect.objectContaining({
        name: '',
        category: '',
        quantity: '1',
        unit: '',
        notes: ''
      })
    ])
    expect(page.data.listItemCategoryOptions).toEqual(['未设置', '调味料', '乳制品'])

    page.openDraftCategorySelector({
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    })

    expect(page.data.showDraftCategorySelector).toBe(true)
    expect(page.data.draftCategorySelectorRowIndex).toBe(0)

    page.selectDraftCategoryOption({
      currentTarget: {
        dataset: {
          name: '调味料'
        }
      }
    })

    expect(page.data.listItemDrafts[0]).toEqual(
      expect.objectContaining({
        category: '调味料',
        categoryIndex: 1
      })
    )
  })

  it('adjusts manual shopping draft quantity with the stepper and keeps it at least one', async () => {
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')

    page.setData({
      listItemDrafts: [
        {
          name: '鸡蛋',
          category: '',
          quantity: '1',
          unit: '个'
        }
      ]
    })

    const event = {
      currentTarget: {
        dataset: {
          index: 0
        }
      }
    }

    page.decrementListItemDraftQuantity(event)
    expect(page.data.listItemDrafts[0].quantity).toBe('1')

    page.incrementListItemDraftQuantity(event)
    expect(page.data.listItemDrafts[0].quantity).toBe('2')
  })

  it('splits combined shopping item text into name, quantity, and unit when opening edit list drafts', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                updatedAt: '2026-04-16T10:00:00.000Z',
                items: [
                  {
                    _id: 'item-1',
                    name: '土豆 2个',
                    category: '蔬菜',
                    quantity: '',
                    unit: '',
                    isChecked: false,
                    sourceType: 'manual',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '蔬菜' }]
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openEditListModal({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open'
        }
      }
    })

    expect(page.data.listItemDrafts[0]).toEqual(
      expect.objectContaining({
        name: '土豆',
        quantity: '2',
        unit: '个',
        category: '蔬菜'
      })
    )
  })

  it('prefers trailing quantity-unit text over stale draft quantity defaults', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                items: [
                  {
                    _id: 'item-1',
                    name: '土豆 2个',
                    category: '蔬菜',
                    quantity: '1',
                    unit: '',
                    isChecked: false,
                    sourceType: 'manual',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '蔬菜' }]
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openEditListModal({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open'
        }
      }
    })
    await flushAsyncWork()

    expect(page.data.listItemDrafts[0]).toEqual(
      expect.objectContaining({
        name: '土豆',
        quantity: '2',
        unit: '个',
        category: '蔬菜'
      })
    )
  })

  it('collapses and expands shopping items from the subhead row without reloading the page', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          items: [
            {
              _id: 'list-open',
              name: '周末采购',
              listDate: '2026-04-16',
              status: 'open',
              updatedAt: '2026-04-16T10:00:00.000Z',
              items: [
                {
                  _id: 'item-1',
                  name: '豆瓣酱',
                  category: '调味料',
                  quantity: '1',
                  unit: '瓶',
                  isChecked: false,
                  sourceType: 'generated',
                  updatedAt: '2026-04-16T10:00:00.000Z'
                }
              ]
            }
          ]
        }
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.visibleShoppingLists[0].itemsCollapsed).toBe(false)

    page.toggleShoppingListItems({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open'
        }
      }
    })

    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(page.data.visibleShoppingLists[0].itemsCollapsed).toBe(true)

    page.toggleShoppingListItems({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open'
        }
      }
    })

    expect(callFunction).toHaveBeenCalledTimes(1)
    expect(page.data.visibleShoppingLists[0].itemsCollapsed).toBe(false)
  })

  it('toggles a shopping item with local state update instead of reloading all shopping lists', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                updatedAt: '2026-04-16T10:00:00.000Z',
                items: [
                  {
                    _id: 'item-1',
                    name: '豆瓣酱',
                    category: '调味料',
                    quantity: '1',
                    unit: '瓶',
                    isChecked: false,
                    sourceType: 'generated',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'item-1',
              name: '豆瓣酱',
              category: '调味料',
              quantity: '1',
              unit: '瓶',
              isChecked: true,
              sourceType: 'generated',
              updatedAt: '2026-04-16T10:01:00.000Z'
            },
            shoppingListUpdatedAt: '2026-04-16T10:01:00.000Z'
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.handleToggleItem({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open',
          shoppingItemId: 'item-1'
        }
      },
      detail: {
        value: ['checked']
      }
    })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.visibleShoppingLists[0].updatedAt).toBe('2026-04-16T10:01:00.000Z')
    expect(page.data.visibleShoppingLists[0].items[0]).toEqual(
      expect.objectContaining({
        _id: 'item-1',
        isChecked: true
      })
    )
    expect(page.data.visibleShoppingLists[0].progressText).toBe('1 / 1 项已完成')
    expect(page.data.heroPendingCountText).toBe('0')
    expect(page.data.heroProgressText).toBe('100%')
  })

  it('replaces generated items locally instead of reloading the full shopping page', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                updatedAt: '2026-04-16T10:00:00.000Z',
                items: [
                  {
                    _id: 'item-manual',
                    name: '酱油',
                    category: '调味料',
                    quantity: '1',
                    unit: '瓶',
                    isChecked: false,
                    sourceType: 'manual',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  },
                  {
                    _id: 'item-old-generated',
                    name: '鸡蛋',
                    category: '鸡蛋',
                    quantity: '2',
                    unit: '个',
                    isChecked: false,
                    sourceType: 'generated',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'item-new-generated',
                name: '牛奶',
                category: '乳制品',
                quantity: '1',
                unit: '盒',
                isChecked: false,
                sourceType: 'generated',
                updatedAt: '2026-04-16T10:05:00.000Z'
              }
            ],
            shoppingListUpdatedAt: '2026-04-16T10:05:00.000Z'
          }
        }
      })
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.generateFromMealPlans({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open'
        }
      }
    })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledTimes(2)
    expect(page.data.visibleShoppingLists[0].updatedAt).toBe('2026-04-16T10:05:00.000Z')
    expect(page.data.visibleShoppingLists[0].items.map((item) => item._id)).toEqual([
      'item-manual',
      'item-new-generated'
    ])
    expect(showToast).toHaveBeenCalledWith({
      title: '已生成采购项',
      icon: 'success'
    })
  })

  it('opens pantry-entry modal from a shopping item, creates pantry data, and auto-checks the item', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                updatedAt: '2026-04-16T10:00:00.000Z',
                items: [
                  {
                    _id: 'item-1',
                    name: '豆瓣酱',
                    category: '调味料',
                    quantity: '1',
                    unit: '瓶',
                    isChecked: false,
                    sourceType: 'generated',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '调味料' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '橱柜' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: { _id: 'pantry-1' }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'item-1',
              name: '豆瓣酱',
              category: '调味料',
              quantity: '1',
              unit: '瓶',
              isChecked: true,
              sourceType: 'generated',
              updatedAt: '2026-04-16T10:01:00.000Z'
            },
            shoppingListUpdatedAt: '2026-04-16T10:01:00.000Z'
          }
        }
      })
    const showToast = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openPantryEntryModal({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open',
          shoppingItemId: 'item-1'
        }
      }
    })

    expect(page.data.showPantryEntryModal).toBe(true)
    expect(page.data.pantryEntryForm).toEqual(
      expect.objectContaining({
        name: '豆瓣酱',
        category: '调味料',
        quantity: '1',
        unit: '瓶'
      })
    )

    page.setData({
      'pantryEntryForm.location': '橱柜'
    })

    await page.submitPantryEntry()
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'createPantryItem',
        spaceId: 'space-1',
        item: expect.objectContaining({
          name: '豆瓣酱',
          category: '调味料',
          quantity: '1',
          unit: '瓶',
          location: '橱柜'
        })
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'toggleShoppingItemChecked',
        spaceId: 'space-1',
        shoppingListId: 'list-open',
        shoppingItemId: 'item-1',
        checked: true,
        expectedUpdatedAt: '2026-04-16T10:00:00.000Z',
        shoppingListExpectedUpdatedAt: '2026-04-16T10:00:00.000Z'
      },
      config: undefined
    })
    expect(callFunction).toHaveBeenCalledTimes(5)
    expect(page.data.showPantryEntryModal).toBe(false)
    expect(showToast).toHaveBeenCalledWith({
      title: '已录入库存',
      icon: 'success'
    })
    expect(page.data.visibleShoppingLists[0].items[0].isChecked).toBe(true)
    expect(page.data.visibleShoppingLists[0].updatedAt).toBe('2026-04-16T10:01:00.000Z')
  })

  it('splits combined shopping item text when prefilling the pantry-entry modal', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                updatedAt: '2026-04-16T10:00:00.000Z',
                items: [
                  {
                    _id: 'item-1',
                    name: '土豆 2个',
                    category: '蔬菜',
                    quantity: '',
                    unit: '',
                    isChecked: false,
                    sourceType: 'manual',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '蔬菜' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '冷藏' }]
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      navigateTo: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openPantryEntryModal({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open',
          shoppingItemId: 'item-1'
        }
      }
    })

    expect(page.data.pantryEntryForm).toEqual(
      expect.objectContaining({
        name: '土豆',
        quantity: '2',
        unit: '个',
        category: '蔬菜'
      })
    )
  })

  it('prefers trailing quantity-unit text when prefilling pantry entry over stale quantity defaults', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [
              {
                _id: 'list-open',
                name: '周末采购',
                listDate: '2026-04-16',
                status: 'open',
                items: [
                  {
                    _id: 'item-1',
                    name: '土豆 2个',
                    category: '蔬菜',
                    quantity: '1',
                    unit: '',
                    isChecked: false,
                    sourceType: 'manual',
                    updatedAt: '2026-04-16T10:00:00.000Z'
                  }
                ]
              }
            ]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: '蔬菜' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: []
          }
        }
      })
    global.wx = {
      cloud: { callFunction },
      showToast: vi.fn(),
      stopPullDownRefresh: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/shopping/index.js')
    page.onShow()
    await flushAsyncWork()

    await page.openPantryEntryModal({
      currentTarget: {
        dataset: {
          shoppingListId: 'list-open',
          shoppingItemId: 'item-1'
        }
      }
    })
    await flushAsyncWork()

    expect(page.data.pantryEntryForm).toEqual(
      expect.objectContaining({
        name: '土豆',
        quantity: '2',
        unit: '个',
        category: '蔬菜'
      })
    )
  })
})
