const { spawnSync } = require('child_process')
const path = require('path')
const { syncSharedDirectory } = require('./sync-shared.cjs')
const { resolveDeployFunctionNames } = require('./cloudfunctions-manifest.cjs')

const rootDir = path.resolve(__dirname, '..')

function resolveFunctionNames(options = {}) {
  return resolveDeployFunctionNames(options)
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
