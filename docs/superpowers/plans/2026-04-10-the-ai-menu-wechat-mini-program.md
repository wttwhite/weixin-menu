# The AI Menu WeChat Mini Program Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WeChat mini program + WeChat cloud development version of `the-ai-menu` inside `D:\a-code\wechat-code`, keeping the original repository untouched while preserving the major business domains (`recipes`, `pantry`, `meal-plans`, `shopping`, `statistics`, `backup`) under a shared family/team space model.

**Architecture:** Use `memberOps`, `api`, and `fileOps` cloud functions as the only business entrypoints. Keep cross-runtime constants and pure domain helpers in a root `shared/` source tree, then sync them into `miniprogram/shared/` and `cloudfunctions/*/shared/` before testing or deployment. Keep page files thin: page JS should mostly orchestrate domain services, while data validation, write shaping, and response formatting live in shared modules and cloud function services.

**Tech Stack:** WeChat Mini Program (`JS`, `WXML`, `WXSS`), WeChat Cloud Functions (`Node.js`, `wx-server-sdk`), Cloud Database, Cloud Storage, `JSZip`, root-level Node test runner with `vitest`, repo-local sync/deploy scripts.

---

## File Map

- `package.json`
  Root automation entrypoint for tests, shared sync, and cloud-function deployment wrappers.
- `scripts/sync-shared.cjs`
  Copies root `shared/` modules into `miniprogram/shared/` and `cloudfunctions/{api,memberOps,fileOps}/shared/`.
- `scripts/deploy-cloudfunctions.cjs`
  Deploys `api`, `memberOps`, and `fileOps` after syncing shared code.
- `shared/constants/*.js`
  Source-of-truth for collection names, error codes, roles, and action names.
- `shared/domain/*.js`
  Pure business helpers for pantry status, recipe normalization, meal-plan sorting, shopping generation, and backup schema validation.
- `shared/utils/*.js`
  Common response wrappers, date/time helpers, and ID/invite-code generators.
- `cloudfunctions/memberOps/*`
  Session bootstrap, create/join space, list/remove members, rotate invite code, rename/disband space.
- `cloudfunctions/api/*`
  Business CRUD and statistics aggregation for `pantry`, `recipes`, `mealPlans`, `shopping`, and `statistics`.
- `cloudfunctions/fileOps/*`
  Recipe-image upload lifecycle and backup import/export lifecycle.
- `miniprogram/services/*.js`
  Page-facing cloud-call wrappers and domain-specific request helpers.
- `miniprogram/pages/*`
  Mini program pages only; keep page files focused on loading state, form events, and navigation.
- `miniprogram/components/*`
  Reusable list cards, chips, image uploader, and empty/loading/error blocks.
- `tests/shared/*.test.js`
  Pure shared helper tests.
- `tests/cloudfunctions/*.test.js`
  Cloud-function service and router tests with fake repositories/adapters.
- `tests/miniprogram/*.test.js`
  Service-layer tests with mocked `wx` globals; page JS should stay thin enough to avoid heavy UI test scaffolding.

**Generated directories:**

- `miniprogram/shared/`
- `cloudfunctions/api/shared/`
- `cloudfunctions/memberOps/shared/`
- `cloudfunctions/fileOps/shared/`

Never edit generated shared copies directly. Edit root `shared/` and rerun `node scripts/sync-shared.cjs`.

### Task 1: Establish Repo Tooling And Shared Sync Pipeline

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `scripts/sync-shared.cjs`
- Create: `scripts/deploy-cloudfunctions.cjs`
- Create: `shared/constants/collections.js`
- Create: `shared/constants/error-codes.js`
- Create: `shared/constants/roles.js`
- Create: `shared/utils/response.js`
- Create: `shared/utils/time.js`
- Create: `shared/utils/invite-code.js`
- Create: `tests/shared/response.test.js`
- Create: `tests/shared/time.test.js`
- Create: `tests/shared/invite-code.test.js`
- Modify: `README.md`
- Modify: `uploadCloudFunction.sh`

- [ ] **Step 1: Create the root test/deploy harness**

Write a minimal root `package.json` so tests and sync scripts have a stable entrypoint:

```json
{
  "name": "weixin-menu",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "sync:shared": "node scripts/sync-shared.cjs",
    "deploy:functions": "node scripts/deploy-cloudfunctions.cjs"
  },
  "devDependencies": {
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Write the failing shared helper tests**

```js
import { describe, expect, it } from 'vitest'
import { buildOkResponse, buildErrorResponse } from '../../shared/utils/response'
import { createInviteCode } from '../../shared/utils/invite-code'

describe('buildOkResponse', () => {
  it('wraps payloads with code 0', () => {
    expect(buildOkResponse({ ok: true })).toEqual({
      code: 0,
      message: '',
      data: { ok: true },
      retryable: false
    })
  })
})

describe('createInviteCode', () => {
  it('returns six uppercase characters', () => {
    expect(createInviteCode()).toMatch(/^[A-Z0-9]{6}$/)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/shared/response.test.js tests/shared/time.test.js tests/shared/invite-code.test.js`

Expected: FAIL with module-not-found errors for `shared/utils/response` and `shared/utils/invite-code`.

- [ ] **Step 4: Implement the shared source files and sync script**

Create the minimal helpers and a sync script that mirrors root `shared/` into:

- `miniprogram/shared`
- `cloudfunctions/api/shared`
- `cloudfunctions/memberOps/shared`
- `cloudfunctions/fileOps/shared`

The response helper should stay tiny:

```js
function buildOkResponse(data, message = '') {
  return { code: 0, message, data, retryable: false }
}

function buildErrorResponse(message, code = 1, retryable = false, data = null) {
  return { code, message, data, retryable }
}

module.exports = {
  buildOkResponse,
  buildErrorResponse
}
```

- [ ] **Step 5: Run sync and rerun the shared tests**

Run: `npm install`

Run: `node scripts/sync-shared.cjs`

Expected: `miniprogram/shared` and the three cloud-function `shared/` directories are created/updated.

Run: `npx vitest run tests/shared/response.test.js tests/shared/time.test.js tests/shared/invite-code.test.js`

Expected: PASS for all shared tests.

- [ ] **Step 6: Update repo docs and commit**

Update `README.md` with:

- repo purpose
- current remote URL
- `npm install`
- `npm run sync:shared`
- `npm run test`

Update `uploadCloudFunction.sh` to shell out to `node scripts/deploy-cloudfunctions.cjs`.

Run:

```bash
git add package.json .gitignore scripts shared tests README.md uploadCloudFunction.sh
git commit -m "chore: add shared tooling and sync pipeline"
```

### Task 2: Build MemberOps And API Entry Points

**Files:**
- Create: `cloudfunctions/memberOps/package.json`
- Create: `cloudfunctions/memberOps/index.js`
- Create: `cloudfunctions/memberOps/lib/context.js`
- Create: `cloudfunctions/memberOps/lib/repository.js`
- Create: `cloudfunctions/memberOps/services/bootstrap-service.js`
- Create: `cloudfunctions/memberOps/services/space-service.js`
- Create: `cloudfunctions/memberOps/services/member-service.js`
- Create: `cloudfunctions/api/package.json`
- Create: `cloudfunctions/api/index.js`
- Create: `cloudfunctions/api/lib/context.js`
- Create: `cloudfunctions/api/lib/router.js`
- Create: `cloudfunctions/api/lib/assert-space-member.js`
- Create: `tests/cloudfunctions/member-ops.test.js`
- Create: `tests/cloudfunctions/api-router.test.js`
- Create: `tests/helpers/fake-db.js`

- [ ] **Step 1: Write the failing session/bootstrap tests**

```js
import { describe, expect, it } from 'vitest'
import { bootstrapSession } from '../../cloudfunctions/memberOps/services/bootstrap-service'

describe('bootstrapSession', () => {
  it('returns spaces and the active role for the current user', async () => {
    const result = await bootstrapSession(
      { openid: 'user-1', preferredSpaceId: 'space-1' },
      {
        listMemberships: async () => [
          { spaceId: 'space-1', role: 'owner', status: 'active', name: 'Home' }
        ]
      }
    )

    expect(result.activeSpaceId).toBe('space-1')
    expect(result.role).toBe('owner')
    expect(result.spaces).toHaveLength(1)
  })
})
```

Also write an API-router test that expects `SPACE_FORBIDDEN` when a request has no valid membership.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/cloudfunctions/member-ops.test.js tests/cloudfunctions/api-router.test.js`

Expected: FAIL because the service and router modules do not exist yet.

- [ ] **Step 3: Implement the minimal cloud-function packages**

Use action-based entrypoints:

```js
// cloudfunctions/memberOps/index.js
exports.main = async (event) => {
  switch (event.action) {
    case 'bootstrap':
      return handleBootstrap(event)
    case 'createSpace':
      return handleCreateSpace(event)
    case 'joinSpace':
      return handleJoinSpace(event)
    case 'listMembers':
      return handleListMembers(event)
    case 'removeMember':
      return handleRemoveMember(event)
    case 'renameSpace':
      return handleRenameSpace(event)
    case 'rotateInviteCode':
      return handleRotateInviteCode(event)
    default:
      return buildErrorResponse('Unsupported action', 404)
  }
}
```

For `api/index.js`, keep the first version limited to:

- action parsing
- membership assertion
- handler dispatch
- response normalization

- [ ] **Step 4: Install function dependencies**

Run: `npm install --prefix cloudfunctions/memberOps`

Run: `npm install --prefix cloudfunctions/api`

Expected: both directories get `node_modules` and `package-lock.json` with `wx-server-sdk`.

- [ ] **Step 5: Sync shared modules and rerun the cloud-function tests**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/cloudfunctions/member-ops.test.js tests/cloudfunctions/api-router.test.js`

Expected: PASS for bootstrap, create/join-space flows, and the forbidden-request guard.

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/memberOps cloudfunctions/api tests/helpers/fake-db.js tests/cloudfunctions
git commit -m "feat: add space membership cloud entrypoints"
```

### Task 3: Build App Bootstrap, Session State, And Space Pages

**Files:**
- Modify: `miniprogram/app.js`
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/app.wxss`
- Create: `miniprogram/styles/theme.wxss`
- Create: `miniprogram/services/cloud.js`
- Create: `miniprogram/services/session.js`
- Create: `miniprogram/utils/storage.js`
- Create: `miniprogram/utils/error.js`
- Create: `miniprogram/pages/boot/index.js`
- Create: `miniprogram/pages/boot/index.json`
- Create: `miniprogram/pages/boot/index.wxml`
- Create: `miniprogram/pages/boot/index.wxss`
- Create: `miniprogram/pages/space/index.js`
- Create: `miniprogram/pages/space/index.json`
- Create: `miniprogram/pages/space/index.wxml`
- Create: `miniprogram/pages/space/index.wxss`
- Create: `miniprogram/pages/space-create/index.js`
- Create: `miniprogram/pages/space-create/index.json`
- Create: `miniprogram/pages/space-create/index.wxml`
- Create: `miniprogram/pages/space-create/index.wxss`
- Create: `miniprogram/pages/space-join/index.js`
- Create: `miniprogram/pages/space-join/index.json`
- Create: `miniprogram/pages/space-join/index.wxml`
- Create: `miniprogram/pages/space-join/index.wxss`
- Create: `miniprogram/pages/recipes/index.js`
- Create: `miniprogram/pages/recipes/index.json`
- Create: `miniprogram/pages/recipes/index.wxml`
- Create: `miniprogram/pages/recipes/index.wxss`
- Create: `miniprogram/pages/pantry/index.js`
- Create: `miniprogram/pages/pantry/index.json`
- Create: `miniprogram/pages/pantry/index.wxml`
- Create: `miniprogram/pages/pantry/index.wxss`
- Create: `miniprogram/pages/meal-plans/index.js`
- Create: `miniprogram/pages/meal-plans/index.json`
- Create: `miniprogram/pages/meal-plans/index.wxml`
- Create: `miniprogram/pages/meal-plans/index.wxss`
- Create: `miniprogram/pages/shopping/index.js`
- Create: `miniprogram/pages/shopping/index.json`
- Create: `miniprogram/pages/shopping/index.wxml`
- Create: `miniprogram/pages/shopping/index.wxss`
- Create: `miniprogram/pages/statistics/index.js`
- Create: `miniprogram/pages/statistics/index.json`
- Create: `miniprogram/pages/statistics/index.wxml`
- Create: `miniprogram/pages/statistics/index.wxss`
- Create: `tests/miniprogram/session-service.test.js`
- Create: `tests/miniprogram/error-utils.test.js`

- [ ] **Step 1: Write the failing mini-program service tests**

```js
import { describe, expect, it } from 'vitest'
import { resolveActiveSpaceId } from '../../miniprogram/services/session'

describe('resolveActiveSpaceId', () => {
  it('falls back to the first available space when storage is empty', () => {
    expect(resolveActiveSpaceId('', [{ id: 'space-1' }, { id: 'space-2' }])).toBe('space-1')
  })
})
```

Also write an error-mapping test that turns `SPACE_FORBIDDEN` into a user-facing Chinese message.

- [ ] **Step 2: Run the mini-program tests to verify they fail**

Run: `npx vitest run tests/miniprogram/session-service.test.js tests/miniprogram/error-utils.test.js`

Expected: FAIL because the session and error utilities do not exist yet.

- [ ] **Step 3: Implement the app bootstrap flow**

`miniprogram/app.js` should:

- initialize cloud
- remember `env`
- expose `globalData.activeSpaceId`
- call into `session.js` from the boot page rather than doing business logic in `App`

`miniprogram/app.json` should:

- set `pages/boot/index` as the first page
- register the space-management pages
- register placeholder tab pages so navigation can stabilize early

- [ ] **Step 4: Implement the session services and pages**

`services/cloud.js` should stay small:

```js
function callCloud(name, data, options = {}) {
  return wx.cloud.callFunction({
    name,
    data,
    config: options.config
  })
}

module.exports = {
  callCloud
}
```

`services/session.js` should wrap:

- `bootstrap`
- `createSpace`
- `joinSpace`
- `switchSpace`
- `listMembers`

The boot page should:

- show a loading state
- call `memberOps.bootstrap`
- route to create/join when no spaces exist
- route to `/pages/recipes/index` when an active space exists

- [ ] **Step 5: Rerun tests and do a boot-flow smoke check**

Run: `npx vitest run tests/miniprogram/session-service.test.js tests/miniprogram/error-utils.test.js`

Expected: PASS.

Manual smoke check in WeChat DevTools:

- launch app
- confirm boot page loads
- confirm “no spaces” routes to create/join UI
- confirm created space persists in local storage

- [ ] **Step 6: Commit**

```bash
git add miniprogram/app.* miniprogram/styles miniprogram/services miniprogram/utils miniprogram/pages/boot miniprogram/pages/space* miniprogram/pages/recipes miniprogram/pages/pantry miniprogram/pages/meal-plans miniprogram/pages/shopping miniprogram/pages/statistics tests/miniprogram
git commit -m "feat: add session bootstrap and space pages"
```

### Task 4: Deliver Pantry End-To-End

**Files:**
- Create: `shared/domain/pantry.js`
- Create: `tests/shared/pantry-domain.test.js`
- Create: `cloudfunctions/api/handlers/pantry.js`
- Create: `cloudfunctions/api/services/pantry-service.js`
- Create: `tests/cloudfunctions/pantry-service.test.js`
- Create: `miniprogram/services/pantry.js`
- Create: `miniprogram/pages/pantry-edit/index.js`
- Create: `miniprogram/pages/pantry-edit/index.json`
- Create: `miniprogram/pages/pantry-edit/index.wxml`
- Create: `miniprogram/pages/pantry-edit/index.wxss`
- Create: `miniprogram/components/pantry-card/index.js`
- Create: `miniprogram/components/pantry-card/index.json`
- Create: `miniprogram/components/pantry-card/index.wxml`
- Create: `miniprogram/components/pantry-card/index.wxss`
- Create: `tests/miniprogram/pantry-service.test.js`
- Modify: `miniprogram/pages/pantry/index.js`
- Modify: `miniprogram/pages/pantry/index.wxml`
- Modify: `miniprogram/pages/pantry/index.wxss`
- Modify: `miniprogram/pages/pantry/index.json`

- [ ] **Step 1: Write the failing pantry tests**

```js
import { describe, expect, it } from 'vitest'
import { derivePantryStatus } from '../../shared/domain/pantry'

describe('derivePantryStatus', () => {
  it('marks items as expiring soon when the expiration date is near', () => {
    expect(
      derivePantryStatus({
        expirationDate: '2026-04-12',
        now: '2026-04-10'
      })
    ).toBe('expiring-soon')
  })
})
```

Also add a cloud-function test for list/create/update/delete against a fake `spaceId`.

- [ ] **Step 2: Run the pantry tests to verify they fail**

Run: `npx vitest run tests/shared/pantry-domain.test.js tests/cloudfunctions/pantry-service.test.js tests/miniprogram/pantry-service.test.js`

Expected: FAIL due to missing pantry domain/service modules.

- [ ] **Step 3: Implement pantry shared/domain and API service**

`shared/domain/pantry.js` should contain:

- write normalization
- status derivation
- default field filling
- simple filter matching

`cloudfunctions/api/handlers/pantry.js` should support:

- `listPantry`
- `createPantryItem`
- `updatePantryItem`
- `deletePantryItem`

- [ ] **Step 4: Implement mini-program pantry service and pages**

`miniprogram/services/pantry.js` should wrap the `api` cloud function:

```js
async function listPantry(spaceId, filters = {}) {
  const result = await callCloud('api', {
    action: 'listPantry',
    spaceId,
    filters
  })
  return result.result.data.items
}
```

The pantry list page should support:

- category/location/status filters
- empty state
- tap-to-edit
- create button

- [ ] **Step 5: Sync shared code, rerun tests, then do manual CRUD**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/shared/pantry-domain.test.js tests/cloudfunctions/pantry-service.test.js tests/miniprogram/pantry-service.test.js`

Expected: PASS.

Manual smoke check:

- create item
- edit item
- filter by category
- soft delete item
- reopen app and confirm cloud data reloads

- [ ] **Step 6: Commit**

```bash
git add shared/domain/pantry.js cloudfunctions/api/handlers/pantry.js cloudfunctions/api/services/pantry-service.js miniprogram/services/pantry.js miniprogram/pages/pantry* miniprogram/components/pantry-card tests/shared/pantry-domain.test.js tests/cloudfunctions/pantry-service.test.js tests/miniprogram/pantry-service.test.js
git commit -m "feat: add pantry shared-space workflow"
```

### Task 5: Deliver Recipe Text, Tags, And Detail Screens

**Files:**
- Create: `shared/domain/recipe.js`
- Create: `tests/shared/recipe-domain.test.js`
- Create: `cloudfunctions/api/handlers/recipes.js`
- Create: `cloudfunctions/api/services/recipe-service.js`
- Create: `tests/cloudfunctions/recipe-service.test.js`
- Create: `miniprogram/services/recipe.js`
- Create: `miniprogram/pages/recipe-detail/index.js`
- Create: `miniprogram/pages/recipe-detail/index.json`
- Create: `miniprogram/pages/recipe-detail/index.wxml`
- Create: `miniprogram/pages/recipe-detail/index.wxss`
- Create: `miniprogram/pages/recipe-edit/index.js`
- Create: `miniprogram/pages/recipe-edit/index.json`
- Create: `miniprogram/pages/recipe-edit/index.wxml`
- Create: `miniprogram/pages/recipe-edit/index.wxss`
- Create: `miniprogram/components/recipe-card/index.js`
- Create: `miniprogram/components/recipe-card/index.json`
- Create: `miniprogram/components/recipe-card/index.wxml`
- Create: `miniprogram/components/recipe-card/index.wxss`
- Create: `miniprogram/components/tag-chip/index.js`
- Create: `miniprogram/components/tag-chip/index.json`
- Create: `miniprogram/components/tag-chip/index.wxml`
- Create: `miniprogram/components/tag-chip/index.wxss`
- Create: `tests/miniprogram/recipe-service.test.js`
- Modify: `miniprogram/pages/recipes/index.js`
- Modify: `miniprogram/pages/recipes/index.wxml`
- Modify: `miniprogram/pages/recipes/index.wxss`
- Modify: `miniprogram/pages/recipes/index.json`

- [ ] **Step 1: Write the failing recipe tests**

```js
import { describe, expect, it } from 'vitest'
import { normalizeRecipeDraft } from '../../shared/domain/recipe'

describe('normalizeRecipeDraft', () => {
  it('keeps steps and ingredients sorted by sortOrder', () => {
    const result = normalizeRecipeDraft({
      name: 'Mapo Tofu',
      ingredients: [
        { name: 'Tofu', sortOrder: 2 },
        { name: 'Pork', sortOrder: 1 }
      ],
      steps: [
        { content: 'Cook', sortOrder: 2 },
        { content: 'Prep', sortOrder: 1 }
      ]
    })

    expect(result.ingredients.map((item) => item.name)).toEqual(['Pork', 'Tofu'])
    expect(result.steps.map((item) => item.content)).toEqual(['Prep', 'Cook'])
  })
})
```

Also add cloud-function tests for recipe CRUD, tag creation, and detail retrieval.

- [ ] **Step 2: Run the recipe tests to verify they fail**

Run: `npx vitest run tests/shared/recipe-domain.test.js tests/cloudfunctions/recipe-service.test.js tests/miniprogram/recipe-service.test.js`

Expected: FAIL because recipe domain and service files do not exist.

- [ ] **Step 3: Implement recipe shared/domain and API service**

Support these actions in `cloudfunctions/api/handlers/recipes.js`:

- `listRecipes`
- `getRecipeDetail`
- `createRecipe`
- `updateRecipe`
- `deleteRecipe`
- `listRecipeTags`
- `createRecipeTag`
- `deleteRecipeTag`

- [ ] **Step 4: Implement recipe pages and components**

`pages/recipes/index` should support:

- list
- favorite indicator
- category/tag summary
- navigation to detail and editor

`pages/recipe-edit/index` should support:

- recipe core fields
- ingredient rows
- step rows
- tag selection
- save/delete

- [ ] **Step 5: Sync shared code, rerun tests, then do manual recipe CRUD**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/shared/recipe-domain.test.js tests/cloudfunctions/recipe-service.test.js tests/miniprogram/recipe-service.test.js`

Expected: PASS.

Manual smoke check:

- create recipe
- edit ingredients and steps
- add/delete tag
- open detail page
- verify updates are visible on another logged-in member after refresh

- [ ] **Step 6: Commit**

```bash
git add shared/domain/recipe.js cloudfunctions/api/handlers/recipes.js cloudfunctions/api/services/recipe-service.js miniprogram/services/recipe.js miniprogram/pages/recipes miniprogram/pages/recipe-detail miniprogram/pages/recipe-edit miniprogram/components/recipe-card miniprogram/components/tag-chip tests/shared/recipe-domain.test.js tests/cloudfunctions/recipe-service.test.js tests/miniprogram/recipe-service.test.js
git commit -m "feat: add recipe text and tag management"
```

### Task 6: Deliver Recipe Image Upload Lifecycle

**Files:**
- Create: `cloudfunctions/fileOps/package.json`
- Create: `cloudfunctions/fileOps/index.js`
- Create: `cloudfunctions/fileOps/lib/context.js`
- Create: `cloudfunctions/fileOps/services/recipe-image-service.js`
- Create: `cloudfunctions/fileOps/services/storage-service.js`
- Create: `tests/cloudfunctions/recipe-image-service.test.js`
- Create: `miniprogram/services/upload.js`
- Create: `miniprogram/components/image-uploader/index.js`
- Create: `miniprogram/components/image-uploader/index.json`
- Create: `miniprogram/components/image-uploader/index.wxml`
- Create: `miniprogram/components/image-uploader/index.wxss`
- Create: `tests/miniprogram/upload-service.test.js`
- Modify: `miniprogram/pages/recipe-edit/index.js`
- Modify: `miniprogram/pages/recipe-edit/index.wxml`
- Modify: `miniprogram/pages/recipe-detail/index.wxml`

- [ ] **Step 1: Write the failing image-lifecycle tests**

```js
import { describe, expect, it } from 'vitest'
import { prepareRecipeImageUpload } from '../../cloudfunctions/fileOps/services/recipe-image-service'

describe('prepareRecipeImageUpload', () => {
  it('returns an image id, upload session id, and scoped cloud path', async () => {
    const result = await prepareRecipeImageUpload(
      { spaceId: 'space-1', recipeId: 'recipe-1', imageRole: 'cover', fileName: 'cover.jpg' },
      { randomId: () => 'img-1', nowIso: () => '2026-04-10T00:00:00.000Z' }
    )

    expect(result.imageId).toBe('img-1')
    expect(result.cloudPath).toContain('spaces/space-1/recipes/')
  })
})
```

Also add tests for confirm/discard/delete image actions.

- [ ] **Step 2: Run the image tests to verify they fail**

Run: `npx vitest run tests/cloudfunctions/recipe-image-service.test.js tests/miniprogram/upload-service.test.js`

Expected: FAIL because `fileOps` and upload helpers do not exist.

- [ ] **Step 3: Implement `fileOps` image actions and dependencies**

Support these actions:

- `prepareRecipeImageUpload`
- `confirmRecipeImageUpload`
- `discardRecipeImage`
- `deleteRecipeImage`

Run: `npm install --prefix cloudfunctions/fileOps`

Then add `jszip` so the same function package is ready for backup later:

Run: `npm install --prefix cloudfunctions/fileOps jszip`

- [ ] **Step 4: Implement the mini-program upload service and editor wiring**

`services/upload.js` should:

- call `fileOps.prepareRecipeImageUpload`
- call `wx.cloud.uploadFile`
- call `fileOps.confirmRecipeImageUpload`
- surface a clear failure message when upload or confirm fails

The editor page should preserve confirmed image metadata even if recipe save fails.

- [ ] **Step 5: Sync shared code, rerun tests, and do manual image checks**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/cloudfunctions/recipe-image-service.test.js tests/miniprogram/upload-service.test.js`

Expected: PASS.

Manual smoke check:

- add cover image
- add step image
- delete pending image before save
- save recipe with images
- reopen detail page and verify image rendering
- simulate upload failure and confirm user-facing error text

- [ ] **Step 6: Commit**

```bash
git add cloudfunctions/fileOps miniprogram/services/upload.js miniprogram/components/image-uploader miniprogram/pages/recipe-edit miniprogram/pages/recipe-detail tests/cloudfunctions/recipe-image-service.test.js tests/miniprogram/upload-service.test.js
git commit -m "feat: add recipe image upload lifecycle"
```

### Task 7: Deliver Meal Plans End-To-End

**Files:**
- Create: `shared/domain/meal-plan.js`
- Create: `tests/shared/meal-plan-domain.test.js`
- Create: `cloudfunctions/api/handlers/meal-plans.js`
- Create: `cloudfunctions/api/services/meal-plan-service.js`
- Create: `tests/cloudfunctions/meal-plan-service.test.js`
- Create: `miniprogram/services/meal-plan.js`
- Create: `miniprogram/pages/meal-plan-edit/index.js`
- Create: `miniprogram/pages/meal-plan-edit/index.json`
- Create: `miniprogram/pages/meal-plan-edit/index.wxml`
- Create: `miniprogram/pages/meal-plan-edit/index.wxss`
- Create: `miniprogram/components/meal-plan-card/index.js`
- Create: `miniprogram/components/meal-plan-card/index.json`
- Create: `miniprogram/components/meal-plan-card/index.wxml`
- Create: `miniprogram/components/meal-plan-card/index.wxss`
- Create: `tests/miniprogram/meal-plan-service.test.js`
- Modify: `miniprogram/pages/meal-plans/index.js`
- Modify: `miniprogram/pages/meal-plans/index.wxml`
- Modify: `miniprogram/pages/meal-plans/index.wxss`

- [ ] **Step 1: Write the failing meal-plan tests**

```js
import { describe, expect, it } from 'vitest'
import { sortMealPlansByDateAndMeal } from '../../shared/domain/meal-plan'

describe('sortMealPlansByDateAndMeal', () => {
  it('keeps breakfast before lunch before dinner on the same day', () => {
    const sorted = sortMealPlansByDateAndMeal([
      { planDate: '2026-04-10', mealType: 'dinner' },
      { planDate: '2026-04-10', mealType: 'breakfast' }
    ])

    expect(sorted[0].mealType).toBe('breakfast')
  })
})
```

Add cloud-function tests for create/update/delete meal plans and embedded recipe snapshots.

- [ ] **Step 2: Run the meal-plan tests to verify they fail**

Run: `npx vitest run tests/shared/meal-plan-domain.test.js tests/cloudfunctions/meal-plan-service.test.js tests/miniprogram/meal-plan-service.test.js`

Expected: FAIL because meal-plan modules do not exist.

- [ ] **Step 3: Implement meal-plan shared/domain and API service**

Support these actions:

- `listMealPlans`
- `createMealPlan`
- `updateMealPlan`
- `deleteMealPlan`

Use embedded `recipes` snapshots on each plan document to keep day-level reads simple.

- [ ] **Step 4: Implement meal-plan pages**

The list page should support:

- date-grouped display
- meal slot chips
- add-plan action
- tap-to-edit

The edit page should support selecting existing recipes and overriding servings.

- [ ] **Step 5: Sync shared code, rerun tests, and verify cross-member reads**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/shared/meal-plan-domain.test.js tests/cloudfunctions/meal-plan-service.test.js tests/miniprogram/meal-plan-service.test.js`

Expected: PASS.

Manual smoke check:

- create breakfast/dinner plans
- attach recipe snapshots
- edit plan
- delete plan
- refresh from another member account and verify shared visibility

- [ ] **Step 6: Commit**

```bash
git add shared/domain/meal-plan.js cloudfunctions/api/handlers/meal-plans.js cloudfunctions/api/services/meal-plan-service.js miniprogram/services/meal-plan.js miniprogram/pages/meal-plans miniprogram/pages/meal-plan-edit miniprogram/components/meal-plan-card tests/shared/meal-plan-domain.test.js tests/cloudfunctions/meal-plan-service.test.js tests/miniprogram/meal-plan-service.test.js
git commit -m "feat: add meal plan shared workflow"
```

### Task 8: Deliver Shopping, Statistics, And Member Management

**Files:**
- Create: `shared/domain/shopping.js`
- Create: `tests/shared/shopping-domain.test.js`
- Create: `cloudfunctions/api/handlers/shopping.js`
- Create: `cloudfunctions/api/services/shopping-service.js`
- Create: `cloudfunctions/api/handlers/statistics.js`
- Create: `cloudfunctions/api/services/statistics-service.js`
- Create: `tests/cloudfunctions/shopping-service.test.js`
- Create: `tests/cloudfunctions/statistics-service.test.js`
- Create: `miniprogram/services/shopping.js`
- Create: `miniprogram/services/statistics.js`
- Create: `miniprogram/services/members.js`
- Create: `miniprogram/pages/shopping-edit/index.js`
- Create: `miniprogram/pages/shopping-edit/index.json`
- Create: `miniprogram/pages/shopping-edit/index.wxml`
- Create: `miniprogram/pages/shopping-edit/index.wxss`
- Create: `tests/miniprogram/shopping-service.test.js`
- Modify: `miniprogram/pages/shopping/index.js`
- Modify: `miniprogram/pages/shopping/index.wxml`
- Modify: `miniprogram/pages/shopping/index.wxss`
- Modify: `miniprogram/pages/statistics/index.js`
- Modify: `miniprogram/pages/statistics/index.wxml`
- Modify: `miniprogram/pages/statistics/index.wxss`
- Modify: `miniprogram/pages/space-members/index.js`
- Modify: `miniprogram/pages/space-members/index.wxml`
- Modify: `miniprogram/pages/space-members/index.wxss`

- [ ] **Step 1: Write the failing shopping/statistics tests**

```js
import { describe, expect, it } from 'vitest'
import { buildShoppingItemsFromMealPlans } from '../../shared/domain/shopping'

describe('buildShoppingItemsFromMealPlans', () => {
  it('creates generated shopping items from meal-plan recipe ingredients', () => {
    const result = buildShoppingItemsFromMealPlans([
      {
        recipes: [
          {
            recipeId: 'recipe-1',
            ingredients: [{ name: 'Tofu', quantity: '1', unit: 'box' }]
          }
        ]
      }
    ])

    expect(result[0].name).toBe('Tofu')
    expect(result[0].sourceType).toBe('generated')
  })
})
```

Add cloud-function tests for shopping CRUD, check toggles, generation from plan, and the statistics dashboard aggregate.

- [ ] **Step 2: Run the shopping/statistics tests to verify they fail**

Run: `npx vitest run tests/shared/shopping-domain.test.js tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/miniprogram/shopping-service.test.js`

Expected: FAIL because the shopping/statistics modules do not exist.

- [ ] **Step 3: Implement shared/domain and API services**

Support these actions in `shopping.js`:

- `listShoppingLists`
- `createShoppingList`
- `updateShoppingList`
- `deleteShoppingList`
- `generateShoppingItemsFromPlan`
- `toggleShoppingItemChecked`

Support `getStatisticsDashboard` in `statistics.js`.

- [ ] **Step 4: Implement mini-program shopping/statistics/member pages**

The shopping pages should support:

- list selection
- item check/uncheck
- manual item add/edit
- generate from meal plans

The statistics page should show:

- recipe count
- pantry count
- upcoming expirations
- shopping progress
- member count
- recent backup status placeholder

The member-management page should allow owners to:

- view current members
- remove a member
- rotate invite code

- [ ] **Step 5: Sync shared code, rerun tests, and do manual owner/member checks**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/shared/shopping-domain.test.js tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/miniprogram/shopping-service.test.js`

Expected: PASS.

Manual smoke check:

- generate shopping list from plan
- toggle item status
- open statistics page
- open member page as owner
- verify non-owner cannot remove members

- [ ] **Step 6: Commit**

```bash
git add shared/domain/shopping.js cloudfunctions/api/handlers/shopping.js cloudfunctions/api/services/shopping-service.js cloudfunctions/api/handlers/statistics.js cloudfunctions/api/services/statistics-service.js miniprogram/services/shopping.js miniprogram/services/statistics.js miniprogram/services/members.js miniprogram/pages/shopping miniprogram/pages/shopping-edit miniprogram/pages/statistics miniprogram/pages/space-members tests/shared/shopping-domain.test.js tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/miniprogram/shopping-service.test.js
git commit -m "feat: add shopping, statistics, and member management"
```

### Task 9: Deliver Backup Import/Export

**Files:**
- Create: `shared/domain/backup.js`
- Create: `tests/shared/backup-domain.test.js`
- Create: `cloudfunctions/fileOps/services/backup-service.js`
- Create: `tests/cloudfunctions/backup-service.test.js`
- Create: `miniprogram/services/backup.js`
- Create: `miniprogram/pages/backup/index.js`
- Create: `miniprogram/pages/backup/index.json`
- Create: `miniprogram/pages/backup/index.wxml`
- Create: `miniprogram/pages/backup/index.wxss`
- Create: `tests/miniprogram/backup-service.test.js`
- Modify: `cloudfunctions/fileOps/index.js`
- Modify: `miniprogram/pages/statistics/index.wxml`
- Modify: `miniprogram/pages/statistics/index.js`

- [ ] **Step 1: Write the failing backup tests**

```js
import { describe, expect, it } from 'vitest'
import { validateBackupPayload } from '../../shared/domain/backup'

describe('validateBackupPayload', () => {
  it('accepts a full backup payload with version and top-level collections', () => {
    expect(
      validateBackupPayload({
        version: '1.0.0',
        exportTime: '2026-04-10T00:00:00.000Z',
        recipes: [],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        settings: {}
      })
    ).toBe(true)
  })
})
```

Add cloud-function tests for export zip assembly, invalid import handling, and restore ordering.

- [ ] **Step 2: Run the backup tests to verify they fail**

Run: `npx vitest run tests/shared/backup-domain.test.js tests/cloudfunctions/backup-service.test.js tests/miniprogram/backup-service.test.js`

Expected: FAIL because backup modules do not exist.

- [ ] **Step 3: Implement backup shared/domain and fileOps service**

`cloudfunctions/fileOps/services/backup-service.js` should:

- query all collections for the target `spaceId`
- pull recipe-image files from cloud storage
- emit `backup.json`
- build a zip with `JSZip`
- store the zip under `spaces/{spaceId}/backup/...`
- write a `backup_records` document

For import, validate first and only then clear/rewrite the space data.

- [ ] **Step 4: Implement mini-program backup page and service**

`services/backup.js` should wrap:

- `exportSpaceBackup`
- `importSpaceBackup`
- `listBackupRecords`

The backup page should support:

- export button
- choose file for import
- recent backup record list
- confirmation modal before destructive import

- [ ] **Step 5: Sync shared code, rerun tests, and do manual backup recovery**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run tests/shared/backup-domain.test.js tests/cloudfunctions/backup-service.test.js tests/miniprogram/backup-service.test.js`

Expected: PASS.

Manual smoke check:

- export current space
- import the same backup into a test space
- verify recipe images and structured data restore
- verify invalid zip shows a clear Chinese error

- [ ] **Step 6: Commit**

```bash
git add shared/domain/backup.js cloudfunctions/fileOps/services/backup-service.js cloudfunctions/fileOps/index.js miniprogram/services/backup.js miniprogram/pages/backup miniprogram/pages/statistics tests/shared/backup-domain.test.js tests/cloudfunctions/backup-service.test.js tests/miniprogram/backup-service.test.js
git commit -m "feat: add backup import and export"
```

### Task 10: Final Integration, Cleanup, And Release Readiness

**Files:**
- Modify: `README.md`
- Modify: `project.config.json`
- Modify: `uploadCloudFunction.sh`
- Create: `docs/manual-smoke-checklist.md`
- Create: `docs/cloud-collections.md`

- [ ] **Step 1: Run the full automated suite**

Run: `node scripts/sync-shared.cjs`

Run: `npx vitest run`

Expected: PASS for every shared, cloud-function, and mini-program service test.

- [ ] **Step 2: Install and verify all cloud-function packages**

Run:

```bash
npm install --prefix cloudfunctions/api
npm install --prefix cloudfunctions/memberOps
npm install --prefix cloudfunctions/fileOps
```

Expected: each function directory has a valid `package-lock.json` and no missing dependencies for local deploy.

- [ ] **Step 3: Finish deploy tooling and project metadata**

Update:

- `project.config.json` project name from quickstart wording to `weixin-menu`
- `uploadCloudFunction.sh` to deploy `api`, `memberOps`, and `fileOps`
- `README.md` with:
  - env configuration
  - sync step
  - local test command
  - cloud-function deploy command
  - manual smoke flow

- [ ] **Step 4: Run the manual smoke checklist with two accounts**

Document and perform:

1. create a space as owner
2. join from a second account
3. create pantry item
4. create recipe with image
5. create meal plan from recipe
6. generate shopping list from plan
7. export backup
8. import backup into a fresh test space
9. remove a member as owner
10. verify cloud-write failures show user-facing errors

- [ ] **Step 5: Commit the release-ready baseline**

```bash
git add README.md project.config.json uploadCloudFunction.sh docs
git commit -m "chore: document deployment and release verification"
```

- [ ] **Step 6: Push the branch to the provided remote**

Run:

```bash
git branch -M main
git push -u origin main
```

Expected: remote `https://github.com/wttwhite/weixin-menu.git` contains the initialized mini-program migration baseline.
