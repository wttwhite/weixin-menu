const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { syncSharedDirectory } = require('./sync-shared.cjs')

const rootDir = path.resolve(__dirname, '..')

const NEXT_GEN_FUNCTIONS = ['api', 'memberOps', 'fileOps']
const LEGACY_FUNCTIONS = ['quickstartFunctions']

function resolveFunctionNames(options = {}) {
  const workingRoot = options.rootDir || rootDir
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

function deployCloudFunctions(options) {
  const installPath = options.installPath
  const envId = options.envId
  const projectPath = options.projectPath
  const functionNames = options.functionNames
  const workingRoot = options.rootDir || rootDir
  const spawnSyncFn = options.spawnSyncFn || spawnSync
  const syncSharedFn = options.syncSharedFn || syncSharedDirectory
  const dryRun = Boolean(options.dryRun)

  if (!installPath) {
    throw new Error(
      'Missing WeChat CLI path. Set installPath, INSTALL_PATH, or WECHAT_CLI_PATH.'
    )
  }

  if (!envId) {
    throw new Error('Missing cloud environment id. Set envId or ENV_ID.')
  }

  if (!functionNames || functionNames.length === 0) {
    throw new Error('No cloud functions found to deploy.')
  }

  syncSharedFn()

  for (const name of functionNames) {
    const args = [
      'cloud',
      'functions',
      'deploy',
      '--e',
      envId,
      '--n',
      name,
      '--r',
      '--project',
      projectPath
    ]

    if (dryRun) {
      console.log(
        `Dry run: ${installPath} ${args.join(' ')}`
      )
      continue
    }

    const result = spawnSyncFn(installPath, args, {
      cwd: workingRoot,
      stdio: 'inherit',
      shell: true
    })

    if (result.status !== 0) {
      throw new Error(`Cloud function deploy failed for: ${name}`)
    }
  }
}

function main() {
  const installPath =
    process.env.installPath || process.env.INSTALL_PATH || process.env.WECHAT_CLI_PATH
  const envId = process.env.envId || process.env.ENV_ID
  const projectPath = process.env.projectPath || process.env.PROJECT_PATH || rootDir
  const functionNames = resolveFunctionNames({ rootDir })
  const dryRun =
    process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'

  deployCloudFunctions({
    installPath,
    envId,
    projectPath,
    rootDir,
    functionNames,
    dryRun
  })
}

if (require.main === module) {
  main()
}

module.exports = {
  resolveFunctionNames,
  deployCloudFunctions,
  main
}
