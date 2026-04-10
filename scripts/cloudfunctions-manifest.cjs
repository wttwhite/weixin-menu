const fs = require('fs')
const path = require('path')

const NEXT_GEN_FUNCTIONS = Object.freeze(['api', 'memberOps', 'fileOps'])
const LEGACY_FUNCTIONS = Object.freeze(['quickstartFunctions'])

function getSharedSyncTargets(rootDir) {
  return [
    path.join(rootDir, 'miniprogram', 'shared'),
    ...NEXT_GEN_FUNCTIONS.map((name) =>
      path.join(rootDir, 'cloudfunctions', name, 'shared')
    )
  ]
}

function resolveDeployFunctionNames(options = {}) {
  const workingRoot = options.rootDir
  const existsSync = options.existsSync || fs.existsSync
  const cloudFunctionsDir = path.join(workingRoot, 'cloudfunctions')
  const isDeployableFunction = (name) =>
    existsSync(path.join(cloudFunctionsDir, name, 'index.js'))

  const nextGenExisting = NEXT_GEN_FUNCTIONS.filter((name) => isDeployableFunction(name))
  if (nextGenExisting.length > 0) {
    return nextGenExisting
  }

  const legacyExisting = LEGACY_FUNCTIONS.filter((name) => isDeployableFunction(name))
  if (legacyExisting.length > 0) {
    return legacyExisting
  }

  return []
}

module.exports = {
  NEXT_GEN_FUNCTIONS,
  LEGACY_FUNCTIONS,
  getSharedSyncTargets,
  resolveDeployFunctionNames
}
