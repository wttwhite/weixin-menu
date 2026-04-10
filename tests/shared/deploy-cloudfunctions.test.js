import { describe, expect, it, vi } from 'vitest'
import path from 'path'
import * as deployScript from '../../scripts/deploy-cloudfunctions.cjs'

describe('resolveFunctionNames', () => {
  it('falls back to quickstartFunctions when new function packages are not deployable', () => {
    const rootDir = 'D:/repo'
    const cloudDir = path.join(rootDir, 'cloudfunctions')
    const existing = new Set([
      path.join(cloudDir, 'api'),
      path.join(cloudDir, 'memberOps'),
      path.join(cloudDir, 'fileOps'),
      path.join(cloudDir, 'quickstartFunctions', 'index.js')
    ])

    const names = deployScript.resolveFunctionNames({
      rootDir,
      existsSync: (value) => existing.has(value)
    })

    expect(names).toEqual(['quickstartFunctions'])
  })

  it('uses api/memberOps/fileOps when they exist', () => {
    const rootDir = 'D:/repo'
    const cloudDir = path.join(rootDir, 'cloudfunctions')
    const existing = new Set([
      path.join(cloudDir, 'api', 'index.js'),
      path.join(cloudDir, 'memberOps', 'index.js'),
      path.join(cloudDir, 'fileOps', 'index.js')
    ])

    const names = deployScript.resolveFunctionNames({
      rootDir,
      existsSync: (value) => existing.has(value)
    })

    expect(names).toEqual(['api', 'memberOps', 'fileOps'])
  })
})

describe('deployCloudFunctions', () => {
  it('runs shared sync before deploying each selected function', () => {
    const calls = []
    const syncSharedFn = vi.fn(() => calls.push('sync'))
    const spawnSyncFn = vi.fn((binary, args) => {
      calls.push(`deploy:${args[6]}`)
      return { status: 0 }
    })

    deployScript.deployCloudFunctions({
      installPath: 'cli',
      envId: 'test-env',
      projectPath: 'D:/repo',
      rootDir: 'D:/repo',
      functionNames: ['quickstartFunctions'],
      spawnSyncFn,
      syncSharedFn
    })

    expect(syncSharedFn).toHaveBeenCalledTimes(1)
    expect(spawnSyncFn).toHaveBeenCalledTimes(1)
    expect(calls).toEqual(['sync', 'deploy:quickstartFunctions'])
  })
})
