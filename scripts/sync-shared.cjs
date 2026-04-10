const fs = require('fs')
const path = require('path')
const { getSharedSyncTargets } = require('./cloudfunctions-manifest.cjs')

const rootDir = path.resolve(__dirname, '..')

function syncSharedDirectory(options = {}) {
  const workingRoot = options.rootDir || rootDir
  const sourceDir = options.sourceDir || path.join(workingRoot, 'shared')
  const targets = options.targets || getSharedSyncTargets(workingRoot)
  const fsImpl = options.fsImpl || fs

  if (!fsImpl.existsSync(sourceDir)) {
    throw new Error(`Shared source directory not found: ${sourceDir}`)
  }

  for (const target of targets) {
    fsImpl.rmSync(target, { recursive: true, force: true })
    fsImpl.mkdirSync(path.dirname(target), { recursive: true })
    fsImpl.cpSync(sourceDir, target, { recursive: true })
    console.log(`Synced: ${path.relative(workingRoot, target)}`)
  }
}

if (require.main === module) {
  syncSharedDirectory()
}

module.exports = {
  syncSharedDirectory
}
