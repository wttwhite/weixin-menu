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
      const nextState = { ...this.data }
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

describe('backup page flow', () => {
  beforeEach(() => {
    vi.resetModules()
    delete global.Page
    delete global.wx
    delete global.getApp
    delete global.getCurrentPages
  })

  it('formats backup record timestamps without the ISO T separator', async () => {
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })
    global.wx = {
      getStorageSync: vi.fn(),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
      cloud: {
        callFunction: vi.fn().mockImplementation(({ name, data }) => {
          if (name === 'fileOps' && data.action === 'listBackupRecords') {
            return Promise.resolve({
              result: {
                code: 0,
                data: {
                  items: [
                    {
                      _id: 'backup-1',
                      type: 'export',
                      status: 'completed',
                      updatedAt: '2026-04-30T03:44:11.540Z'
                    },
                    {
                      _id: 'backup-2',
                      type: 'import',
                      status: 'completed',
                      createdAt: '2026-04-30T12:05:48+08:00'
                    }
                  ]
                }
              }
            })
          }
          if (name === 'memberOps' && data.action === 'bootstrap') {
            return Promise.resolve({
              result: {
                code: 0,
                data: {
                  openid: 'owner-1',
                  activeSpaceId: 'space-1',
                  role: 'owner',
                  spaces: [{ spaceId: 'space-1', name: '家庭厨房', role: 'owner' }]
                }
              }
            })
          }
          throw new Error(`${name}:${data.action}`)
        })
      }
    }

    const page = await loadPage('../../miniprogram/pages/backup/index.js')
    page.onShow()
    await flushAsyncWork()

    expect(page.data.records[0].timeText).toBe('2026-04-30 11:44:11')
    expect(page.data.records[1].timeText).toBe('2026-04-30 12:05:48')
    expect(page.data.records[0].timeText).not.toContain('T')
  })

  it('marks loaded data tabs for refresh after importing a backup', async () => {
    const recipesPage = { route: 'pages/recipes/index', markNeedsRefreshOnNextShow: vi.fn() }
    const pantryPage = { route: 'pages/pantry/index', markNeedsRefreshOnNextShow: vi.fn() }
    const mealPlansPage = { route: 'pages/meal-plans/index', markNeedsRefreshOnNextShow: vi.fn() }
    const shoppingPage = { route: 'pages/shopping/index', markNeedsRefreshOnNextShow: vi.fn() }
    global.getCurrentPages = () => ([
      recipesPage,
      pantryPage,
      mealPlansPage,
      shoppingPage,
      { route: 'pages/backup/index' }
    ])
    global.getApp = () => ({
      globalData: {
        activeSpaceId: 'space-1'
      }
    })
    global.wx = {
      getStorageSync: vi.fn(),
      setStorageSync: vi.fn(),
      removeStorageSync: vi.fn(),
      showModal: vi.fn().mockResolvedValue({ confirm: true }),
      chooseMessageFile: vi.fn().mockResolvedValue({
        tempFiles: [{ path: '/tmp/backup.zip', name: 'backup.zip' }]
      }),
      showToast: vi.fn(),
      cloud: {
        uploadFile: vi.fn().mockResolvedValue({ fileID: 'cloud://temp/backup.zip' }),
        callFunction: vi.fn().mockImplementation(({ name, data }) => {
          if (name === 'fileOps' && data.action === 'listBackupRecords') {
            return Promise.resolve({
              result: {
                code: 0,
                data: { items: [] }
              }
            })
          }
          if (name === 'memberOps' && data.action === 'bootstrap') {
            return Promise.resolve({
              result: {
                code: 0,
                data: {
                  openid: 'owner-1',
                  activeSpaceId: 'space-1',
                  role: 'owner',
                  spaces: [{ spaceId: 'space-1', name: '家庭厨房', role: 'owner' }]
                }
              }
            })
          }
          if (name === 'fileOps' && data.action === 'importSpaceBackup') {
            return Promise.resolve({
              result: {
                code: 0,
                data: { summary: { recipes: 1 } }
              }
            })
          }
          throw new Error(`${name}:${data.action}`)
        })
      }
    }

    const page = await loadPage('../../miniprogram/pages/backup/index.js')
    page.onShow()
    await flushAsyncWork()
    await page.handleImport()
    await flushAsyncWork()

    expect(recipesPage.markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
    expect(pantryPage.markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
    expect(mealPlansPage.markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
    expect(shoppingPage.markNeedsRefreshOnNextShow).toHaveBeenCalledTimes(1)
  })
})
