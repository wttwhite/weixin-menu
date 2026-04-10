import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { syncSharedDirectory } from '../../scripts/sync-shared.cjs'

const tempRoots = []

function makeTempRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-shared-test-'))
  tempRoots.push(tempRoot)
  return tempRoot
}

describe('syncSharedDirectory', () => {
  afterEach(() => {
    for (const tempRoot of tempRoots.splice(0)) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  it('throws when source directory does not exist', () => {
    const tempRoot = makeTempRoot()
    const missingSource = path.join(tempRoot, 'missing-shared')

    expect(() =>
      syncSharedDirectory({
        rootDir: tempRoot,
        sourceDir: missingSource,
        targets: []
      })
    ).toThrow(`Shared source directory not found: ${missingSource}`)
  })

  it('copies source shared files to each target', () => {
    const tempRoot = makeTempRoot()
    const sourceDir = path.join(tempRoot, 'shared')
    const targetA = path.join(tempRoot, 'miniprogram', 'shared')
    const targetB = path.join(tempRoot, 'cloudfunctions', 'api', 'shared')

    fs.mkdirSync(path.join(sourceDir, 'utils'), { recursive: true })
    fs.writeFileSync(path.join(sourceDir, 'utils', 'sample.js'), 'module.exports = 1\n')

    syncSharedDirectory({
      rootDir: tempRoot,
      sourceDir,
      targets: [targetA, targetB]
    })

    expect(fs.readFileSync(path.join(targetA, 'utils', 'sample.js'), 'utf8')).toBe(
      'module.exports = 1\n'
    )
    expect(fs.readFileSync(path.join(targetB, 'utils', 'sample.js'), 'utf8')).toBe(
      'module.exports = 1\n'
    )
  })
})
