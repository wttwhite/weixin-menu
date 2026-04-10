# weixin-menu

This repository contains the WeChat mini program and cloud function codebase for the `the-ai-menu` migration target.

Remote repository: https://github.com/wttwhite/weixin-menu.git

## Local Setup

Install dependencies:

```bash
npm install
```

Sync shared modules from root `shared/` into mini program and cloud function folders:

```bash
npm run sync:shared
```

This generates mirrored copies in:
- `miniprogram/shared`
- `cloudfunctions/api/shared`
- `cloudfunctions/memberOps/shared`
- `cloudfunctions/fileOps/shared`

Do not edit generated shared copies directly. Edit root `shared/` and run sync again.

Run shared tests:

```bash
npm run test
```

## Deploy Cloud Functions

Use:

```bash
npm run deploy:functions
```

Required environment variables:
- `ENV_ID` (cloud environment id)
- `INSTALL_PATH` or `WECHAT_CLI_PATH` (WeChat DevTools CLI executable path)

Optional environment variables:
- `PROJECT_PATH` (defaults to repo root)
- `DRY_RUN=1` (or `DRY_RUN=true`) to print deploy commands without executing them
