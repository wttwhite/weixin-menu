import { beforeEach, describe, expect, it, vi } from 'vitest'

function createPageInstance(pageConfig) {
  const instance = {
    data: { ...(pageConfig.data || {}) },
    setData(nextData) {
      this.data = {
        ...this.data,
        ...nextData
      }
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

describe('pantry edit page flow', () => {
  it('builds today value from local date components instead of ISO UTC slicing', async () => {
    const RealDate = Date
    class MockDate extends RealDate {
      constructor(...args) {
        if (args.length) {
          super(...args)
          return
        }
        super('2026-04-09T16:30:00.000Z')
      }

      getFullYear() {
        return 2026
      }

      getMonth() {
        return 3
      }

      getDate() {
        return 10
      }

      toISOString() {
        return '2026-04-09T16:30:00.000Z'
      }
    }
    global.Date = MockDate
    global.wx = {
      cloud: {
        callFunction: vi.fn()
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    expect(page.data.today).toBe('2026-04-10')
  })

  it('loads edit item via getPantryItem action', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'dairy' }, { name: 'produce' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'fridge' }, { name: 'freezer' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'pantry-1',
              name: 'Milk',
              category: 'dairy',
              quantity: '1',
              unit: 'box',
              location: 'fridge',
              productionDate: '2026-01-10',
              shelfLifeMonths: '3',
              openedDate: '2026-01-18',
              status: 'opened',
              expirationDate: '2026-04-10',
              notes: 'test'
            }
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({ pantryItemId: 'pantry-1' })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenCalledWith({
      name: 'api',
      data: {
        action: 'getPantryItem',
        spaceId: 'space-1',
        pantryItemId: 'pantry-1'
      },
      config: undefined
    })
    expect(page.data.form.name).toBe('Milk')
    expect(page.data.categoryOptions).toEqual(['未设置', 'dairy', 'produce'])
    expect(page.data.locationOptions).toEqual(['未设置', 'fridge', 'freezer'])
    expect(page.data.form.status).toBe('opened')
    expect(page.data.form.expirationDate).toBe('2026-04-10')
    expect(page.data.loadErrorMessage).toBe('')
    expect(page.data.showEditModal).toBe(false)
  })

  it('syncs theme and keeps pantry detail status visually neutral', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'dairy' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'fridge' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'pantry-1',
              name: 'Milk',
              category: 'dairy',
              quantity: '1',
              unit: 'box',
              location: 'fridge',
              storedStatus: 'active',
              status: 'expiring',
              expirationDate: '2026-05-01'
            }
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1',
        themeKey: 'sakura-pink'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({ pantryItemId: 'pantry-1' })
    await flushAsyncWork()

    expect(page.data.themeKey).toBe('sakura-pink')
    expect(page.data.themeStyle).toContain('--brand: #d58aa2;')
    expect(page.data.form.status).toBe('active')
    expect(page.data.detailStatusText).toBe('即将过期')
    expect(page.data.detailStatusClass).toBe('detail-status')
  })

  it('opens shared edit modal from pantry detail and updates local detail state after save', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'dairy' }, { name: 'produce' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'fridge' }, { name: 'freezer' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'pantry-1',
              name: 'Milk',
              category: 'dairy',
              quantity: '1',
              unit: 'box',
              location: 'fridge',
              productionDate: '2026-01-10',
              shelfLifeMonths: '3',
              openedDate: '2026-01-18',
              status: 'opened',
              expirationDate: '2026-04-10',
              notes: 'test'
            }
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'pantry-1',
              name: 'Fresh Milk',
              category: 'produce',
              quantity: '2',
              unit: '瓶',
              location: 'freezer',
              productionDate: '2026-01-11',
              shelfLifeMonths: '4',
              openedDate: '2026-01-19',
              status: 'active',
              expirationDate: '2026-05-11',
              notes: 'updated'
            }
          }
        }
      })
    const showToast = vi.fn()
    const navigateBack = vi.fn()
    global.wx = {
      cloud: {
        callFunction
      },
      showToast,
      navigateBack,
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({ pantryItemId: 'pantry-1' })
    await flushAsyncWork()

    page.openEditModal()
    expect(page.data.showEditModal).toBe(true)
    expect(page.data.editForm).toEqual(
      expect.objectContaining({
        name: 'Milk',
        category: 'dairy',
        location: 'fridge'
      })
    )

    page.handleEditFormChange({
      detail: {
        form: {
          ...page.data.editForm,
          name: 'Fresh Milk',
          category: 'produce',
          quantity: '2',
          unit: '瓶',
          location: 'freezer',
          productionDate: '2026-01-11',
          shelfLifeMonths: '4',
          openedDate: '2026-01-19',
          status: 'active',
          expirationDate: '2026-05-11',
          notes: 'updated'
        }
      }
    })

    await page.submitEditModal({
      detail: {
        form: page.data.editForm
      }
    })
    await flushAsyncWork()

    expect(callFunction).toHaveBeenNthCalledWith(4, {
      name: 'api',
      data: {
        action: 'updatePantryItem',
        spaceId: 'space-1',
        pantryItemId: 'pantry-1',
        item: expect.objectContaining({
          name: 'Fresh Milk',
          category: 'produce',
          quantity: '2',
          unit: '瓶',
          location: 'freezer',
          status: 'active'
        })
      },
      config: undefined
    })
    expect(page.data.showEditModal).toBe(false)
    expect(page.data.form).toEqual(
      expect.objectContaining({
        name: 'Fresh Milk',
        category: 'produce',
        location: 'freezer',
        status: 'active',
        notes: 'updated'
      })
    )
    expect(page.data.categoryOptions).toEqual(['未设置', 'dairy', 'produce'])
    expect(page.data.locationOptions).toEqual(['未设置', 'fridge', 'freezer'])
    expect(showToast).toHaveBeenCalledWith({
      title: '已更新库存',
      icon: 'success'
    })
    expect(navigateBack).not.toHaveBeenCalled()
  })

  it('uses configured dropdowns and stepper actions for pantry fields', async () => {
    const callFunction = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'dairy' }, { name: 'produce' }]
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            items: [{ name: 'fridge' }, { name: 'freezer' }]
          }
        }
      })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({})
    await flushAsyncWork()

    page.handleCategorySelect({ detail: { value: 2 } })
    page.handleLocationSelect({ detail: { value: 2 } })
    page.handleUsageStatusSelect({ detail: { value: 2 } })
    page.incrementQuantity()
    page.openUnitSelector()
    page.handleUnitOptionTap({
      currentTarget: {
        dataset: {
          unit: '瓶'
        }
      }
    })
    page.incrementShelfLifeMonths()
    page.handleProductionDateChange({ detail: { value: '2026-01-10' } })
    page.handleExpirationDateChange({ detail: { value: '2026-02-14' } })
    page.handleOpenedDateChange({ detail: { value: '2026-01-12' } })

    expect(page.data.form.category).toBe('produce')
    expect(page.data.form.location).toBe('freezer')
    expect(page.data.form.status).toBe('empty')
    expect(page.data.form.quantity).toBe('1.5')
    expect(page.data.form.unit).toBe('瓶')
    expect(page.data.form.shelfLifeMonths).toBe('1')
    expect(page.data.form.productionDate).toBe('2026-01-10')
    expect(page.data.form.expirationDate).toBe('2026-02-14')
    expect(page.data.form.openedDate).toBe('2026-01-12')

    page.clearCategory()
    page.clearLocation()
    page.clearExpirationDate()
    page.clearOpenedDate()

    expect(page.data.form.category).toBe('')
    expect(page.data.form.location).toBe('')
    expect(page.data.form.expirationDate).toBe('')
    expect(page.data.form.openedDate).toBe('')
    expect(page.data.categoryIndex).toBe(0)
    expect(page.data.locationIndex).toBe(0)
  })

  it('blocks edit actions after item load failure', async () => {
    const callFunction = vi.fn().mockResolvedValue({
      result: {
        code: 404,
        message: 'Pantry item not found',
        data: null
      }
    })
    global.wx = {
      cloud: {
        callFunction
      },
      showToast: vi.fn(),
      navigateBack: vi.fn(),
      redirectTo: vi.fn(),
      showModal: vi.fn()
    }
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })

    const page = await loadPage('../../miniprogram/pages/pantry-edit/index.js')
    page.onLoad({ pantryItemId: 'pantry-1' })
    await flushAsyncWork()

    expect(page.data.loadErrorMessage).toBe('没有找到对应的数据')
    await page.submit()
    await page.removeItem()
    expect(callFunction).toHaveBeenCalledTimes(3)
  })
})
