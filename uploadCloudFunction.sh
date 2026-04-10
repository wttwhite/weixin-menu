#!/usr/bin/env sh
set -e

# Requires ENV_ID and INSTALL_PATH/WECHAT_CLI_PATH. Set DRY_RUN=1 to preview commands.
node scripts/deploy-cloudfunctions.cjs
