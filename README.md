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

Run shared tests:

```bash
npm run test
```
