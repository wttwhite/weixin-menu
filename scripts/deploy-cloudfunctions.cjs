const { spawnSync } = require('child_process')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const installPath =
  process.env.installPath || process.env.INSTALL_PATH || process.env.WECHAT_CLI_PATH
const envId = process.env.envId || process.env.ENV_ID
const projectPath = process.env.projectPath || process.env.PROJECT_PATH || rootDir

const functionNames = ['api', 'memberOps', 'fileOps']

if (!installPath) {
  throw new Error(
    'Missing WeChat CLI path. Set installPath, INSTALL_PATH, or WECHAT_CLI_PATH.'
  )
}

if (!envId) {
  throw new Error('Missing cloud environment id. Set envId or ENV_ID.')
}

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

  const result = spawnSync(installPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  })

  if (result.status !== 0) {
    throw new Error(`Cloud function deploy failed for: ${name}`)
  }
}
