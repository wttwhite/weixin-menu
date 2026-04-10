const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const sourceDir = path.join(rootDir, 'shared')
const targets = [
  path.join(rootDir, 'miniprogram', 'shared'),
  path.join(rootDir, 'cloudfunctions', 'api', 'shared'),
  path.join(rootDir, 'cloudfunctions', 'memberOps', 'shared'),
  path.join(rootDir, 'cloudfunctions', 'fileOps', 'shared')
]

function syncSharedDirectory() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Shared source directory not found: ${sourceDir}`)
  }

  for (const target of targets) {
    fs.rmSync(target, { recursive: true, force: true })
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.cpSync(sourceDir, target, { recursive: true })
    console.log(`Synced: ${path.relative(rootDir, target)}`)
  }
}

if (require.main === module) {
  syncSharedDirectory()
}

module.exports = {
  syncSharedDirectory
}
