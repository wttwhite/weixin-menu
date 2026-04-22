# Profile Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the statistics tab with a new profile center tab that aggregates space/profile/configuration entry points, supports per-space display names, theme switching, and reuses existing member/backup/statistics workflows.

**Architecture:** Add a new `/pages/profile/index` tab page as the orchestration layer, keep heavy workflows in their existing pages, and extract only the reusable configuration logic needed for in-page modals. Persist a lightweight app theme in local storage, route member display-name writes through `memberOps`, and reuse current services/pages wherever a dedicated flow already exists.

**Tech Stack:** WeChat mini program pages, local storage helpers, existing `memberOps` and `api` cloud functions, Vitest

---

## File Structure

- Create: `miniprogram/pages/profile/index.js`
- Create: `miniprogram/pages/profile/index.wxml`
- Create: `miniprogram/pages/profile/index.wxss`
- Create: `miniprogram/pages/profile/index.json`
- Create: `miniprogram/utils/theme.js`
- Create: `miniprogram/utils/recipe-category-manager.js`
- Create: `miniprogram/utils/pantry-manager.js`
- Create: `tests/miniprogram/profile-page-flow.test.js`
- Create: `tests/miniprogram/profile-template.test.js`
- Create: `tests/miniprogram/theme-utils.test.js`
- Create: `tests/miniprogram/space-members-page-flow.test.js`
- Create: `tests/miniprogram/category-manager-helpers.test.js`
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/app.js`
- Modify: `miniprogram/custom-tab-bar/index.js`
- Modify: `miniprogram/utils/storage.js`
- Modify: `miniprogram/pages/recipes/index.js`
- Modify: `miniprogram/pages/pantry/index.js`
- Modify: `miniprogram/pages/statistics/index.js`
- Modify: `miniprogram/pages/backup/index.js`
- Modify: `miniprogram/pages/space-members/index.js`
- Modify: `miniprogram/pages/space-members/index.wxml`
- Modify: `miniprogram/pages/space-members/index.wxss`
- Modify: `miniprogram/services/members.js`
- Modify: `cloudfunctions/memberOps/index.js`
- Modify: `cloudfunctions/memberOps/services/member-service.js`
- Modify: `cloudfunctions/memberOps/lib/repository.js`
- Modify: `tests/miniprogram/app-config.test.js`
- Modify: `tests/miniprogram/tab-pages-source.test.js`
- Modify: `tests/miniprogram/custom-tab-bar.test.js`
- Modify: `tests/miniprogram/members-service.test.js`
- Modify: `tests/cloudfunctions/member-ops.test.js`

### Task 1: Wire The New Profile Tab Shell

**Files:**
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/custom-tab-bar/index.js`
- Modify: `miniprogram/pages/statistics/index.js`
- Create: `miniprogram/pages/profile/index.js`
- Create: `miniprogram/pages/profile/index.wxml`
- Create: `miniprogram/pages/profile/index.wxss`
- Create: `miniprogram/pages/profile/index.json`
- Modify: `tests/miniprogram/app-config.test.js`
- Modify: `tests/miniprogram/tab-pages-source.test.js`
- Create: `tests/miniprogram/profile-template.test.js`

- [ ] **Step 1: Write failing tests for tabBar wiring and profile page shell**

Add assertions that:

- `app.json` registers `pages/profile/index`
- tabBar list ends with `pages/profile/index`
- `tab-pages-source.test.js` expects `syncCurrentTabBar(this, '/pages/profile/index')`
- `profile-template.test.js` expects a profile header, space card, grouped action list, and modal placeholders

- [ ] **Step 2: Run the new app/profile template tests to verify failure**

Run: `npx vitest run tests/miniprogram/app-config.test.js tests/miniprogram/tab-pages-source.test.js tests/miniprogram/profile-template.test.js`
Expected: FAIL because `pages/profile/index` does not exist and the tabBar still points to `pages/statistics/index`.

- [ ] **Step 3: Implement the minimal profile tab shell**

Make these minimum changes:

- add `pages/profile/index` to `app.json`
- change the fifth tab item in `app.json` and `custom-tab-bar/index.js` to `pages/profile/index` with text `我的`
- keep `/pages/statistics/index` registered as a normal page
- create a minimal `pages/profile/index` shell that calls `syncCurrentTabBar(this, '/pages/profile/index')`
- render placeholder sections matching the approved layout structure

- [ ] **Step 4: Re-run the profile shell tests to verify pass**

Run: `npx vitest run tests/miniprogram/app-config.test.js tests/miniprogram/tab-pages-source.test.js tests/miniprogram/profile-template.test.js`
Expected: PASS

### Task 2: Add Theme Storage And Shared Theme Helpers

**Files:**
- Modify: `miniprogram/app.js`
- Modify: `miniprogram/utils/storage.js`
- Create: `miniprogram/utils/theme.js`
- Modify: `miniprogram/custom-tab-bar/index.js`
- Modify: `miniprogram/pages/profile/index.js`
- Modify: `miniprogram/pages/statistics/index.js`
- Modify: `miniprogram/pages/backup/index.js`
- Create: `tests/miniprogram/theme-utils.test.js`
- Modify: `tests/miniprogram/custom-tab-bar.test.js`

- [ ] **Step 1: Write failing tests for theme persistence and style derivation**

Add tests that prove:

- storage supports a theme key alongside `activeSpaceId`
- `theme.js` returns a default theme key and a page-style string for `default`, `fresh-green`, and `amber`
- profile/custom-tab-bar consumers can read a persisted theme and expose a theme style/class

- [ ] **Step 2: Run the theme-focused tests to verify failure**

Run: `npx vitest run tests/miniprogram/theme-utils.test.js tests/miniprogram/custom-tab-bar.test.js`
Expected: FAIL because there is no theme helper or stored theme key yet.

- [ ] **Step 3: Implement the minimal theme persistence layer**

Create `miniprogram/utils/theme.js` with pure helpers for:

- theme key validation
- default-theme fallback
- serializing theme CSS vars or page style strings

Update `miniprogram/utils/storage.js` and `miniprogram/app.js` to:

- persist a theme key
- expose current theme in `globalData`
- provide a setter that profile page can call after selection

Update `custom-tab-bar`, `profile`, and the reused detail pages (`backup`, `statistics`) to read/apply the shared theme state.

- [ ] **Step 4: Re-run the theme-focused tests to verify pass**

Run: `npx vitest run tests/miniprogram/theme-utils.test.js tests/miniprogram/custom-tab-bar.test.js`
Expected: PASS

### Task 3: Add Per-Space Display Name Support In memberOps

**Files:**
- Modify: `cloudfunctions/memberOps/index.js`
- Modify: `cloudfunctions/memberOps/services/member-service.js`
- Modify: `cloudfunctions/memberOps/lib/repository.js`
- Modify: `miniprogram/services/members.js`
- Modify: `tests/cloudfunctions/member-ops.test.js`
- Modify: `tests/miniprogram/members-service.test.js`

- [ ] **Step 1: Write failing tests for display-name update actions**

Add assertions like:

```js
const response = await handler({
  action: 'updateMemberDisplayName',
  spaceId: 'space-1',
  memberOpenid: 'member-1',
  displayName: '小王'
})
expect(response.code).toBe(ERROR_CODES.OK)
```

and

```js
await service.updateMemberDisplayName('space-1', 'member-1', '小王')
expect(callCloud).toHaveBeenCalledWith('memberOps', {
  action: 'updateMemberDisplayName',
  spaceId: 'space-1',
  memberOpenid: 'member-1',
  displayName: '小王'
})
```

- [ ] **Step 2: Run the memberOps and members-service tests to verify failure**

Run: `npx vitest run tests/cloudfunctions/member-ops.test.js tests/miniprogram/members-service.test.js`
Expected: FAIL because `updateMemberDisplayName` is not implemented.

- [ ] **Step 3: Implement the minimal display-name update chain**

Add a new `memberOps` action and repository method that:

- validates `spaceId`, `memberOpenid`, and `displayName`
- allows owners to edit any member display name
- allows members to edit their own display name
- writes `displayName` onto the target `space_members` record

Then expose the action through `miniprogram/services/members.js`.

- [ ] **Step 4: Re-run the member display-name tests to verify pass**

Run: `npx vitest run tests/cloudfunctions/member-ops.test.js tests/miniprogram/members-service.test.js`
Expected: PASS

### Task 4: Extract Reusable Category And Pantry Manager Helpers

**Files:**
- Create: `miniprogram/utils/recipe-category-manager.js`
- Create: `miniprogram/utils/pantry-manager.js`
- Modify: `miniprogram/pages/recipes/index.js`
- Modify: `miniprogram/pages/pantry/index.js`
- Create: `tests/miniprogram/category-manager-helpers.test.js`

- [ ] **Step 1: Write failing helper tests for recipe category and pantry manager state shaping**

Cover pure behaviors such as:

- converting service items into view items with `deletable` / count labels
- returning manager config for pantry `category` vs `location`
- building consistent empty/loading state text for profile modals

- [ ] **Step 2: Run the helper test to verify failure**

Run: `npx vitest run tests/miniprogram/category-manager-helpers.test.js`
Expected: FAIL because the helper modules do not exist.

- [ ] **Step 3: Extract the minimal reusable helpers**

Move pure logic out of `pages/recipes/index.js` and `pages/pantry/index.js` into the new helper files. Keep network calls and page-local wiring in the existing pages, but make the view-model builders importable by `pages/profile/index.js`.

- [ ] **Step 4: Re-run the helper and existing recipe/pantry tests to verify pass**

Run: `npx vitest run tests/miniprogram/category-manager-helpers.test.js tests/miniprogram/recipes-page-flow.test.js tests/miniprogram/pantry-page-flow.test.js`
Expected: PASS

### Task 5: Build The Profile Center Page

**Files:**
- Create: `miniprogram/pages/profile/index.js`
- Create: `miniprogram/pages/profile/index.wxml`
- Create: `miniprogram/pages/profile/index.wxss`
- Create: `miniprogram/pages/profile/index.json`
- Modify: `miniprogram/services/members.js`
- Modify: `tests/miniprogram/profile-page-flow.test.js`
- Modify: `tests/miniprogram/profile-template.test.js`

- [ ] **Step 1: Write failing profile page-flow tests for approved behaviors**

Cover these concrete flows:

- loading current member/space summary
- editing the current user’s display name
- copying invite code
- opening category/location/theme modals
- navigating to members, backup, and statistics pages
- owner-only visibility for rename-space action

- [ ] **Step 2: Run the profile page tests to verify failure**

Run: `npx vitest run tests/miniprogram/profile-page-flow.test.js tests/miniprogram/profile-template.test.js`
Expected: FAIL because the profile page does not yet implement the approved interactions.

- [ ] **Step 3: Implement the minimal profile page**

In `pages/profile/index.js`:

- load session, member, backup, and statistics summary data
- derive the current display name with the approved fallback order
- wire navigation actions for space/member/backup/statistics flows
- open in-page modals for recipe category, pantry category, pantry location, and theme selection
- support `renameSpace` for owners and `updateMemberDisplayName` for the current member

In `pages/profile/index.wxml` / `.wxss`:

- render the profile header card
- render grouped action rows
- render a current-space card
- render modal markup for category/location/theme management

- [ ] **Step 4: Re-run the profile page tests to verify pass**

Run: `npx vitest run tests/miniprogram/profile-page-flow.test.js tests/miniprogram/profile-template.test.js`
Expected: PASS

### Task 6: Upgrade The Space Members Page For Nickname Editing

**Files:**
- Modify: `miniprogram/pages/space-members/index.js`
- Modify: `miniprogram/pages/space-members/index.wxml`
- Modify: `miniprogram/pages/space-members/index.wxss`
- Create: `tests/miniprogram/space-members-page-flow.test.js`

- [ ] **Step 1: Write failing page-flow tests for owner nickname editing**

Add tests that prove:

- owner can open an edit flow for another member’s display name
- current user display names are shown with fallback order
- non-owner still cannot remove/edit other members

- [ ] **Step 2: Run the new space-members page test to verify failure**

Run: `npx vitest run tests/miniprogram/space-members-page-flow.test.js`
Expected: FAIL because the page only supports list/remove/rotate invite code today.

- [ ] **Step 3: Implement the minimal space-members page upgrade**

Add an edit affordance that calls the new `updateMemberDisplayName` service method, then reloads the member list. Keep delete/invite behavior unchanged.

- [ ] **Step 4: Re-run the page-flow and related member tests to verify pass**

Run: `npx vitest run tests/miniprogram/space-members-page-flow.test.js tests/cloudfunctions/member-ops.test.js tests/miniprogram/members-service.test.js`
Expected: PASS

### Task 7: Run Final Verification

**Files:**
- Modify all touched profile/theme/member/helper files and tests above

- [ ] **Step 1: Run the focused profile center suite**

Run: `npx vitest run tests/miniprogram/profile-page-flow.test.js tests/miniprogram/profile-template.test.js tests/miniprogram/theme-utils.test.js tests/miniprogram/space-members-page-flow.test.js tests/miniprogram/category-manager-helpers.test.js tests/cloudfunctions/member-ops.test.js tests/miniprogram/members-service.test.js tests/miniprogram/app-config.test.js tests/miniprogram/tab-pages-source.test.js tests/miniprogram/custom-tab-bar.test.js`
Expected: PASS

- [ ] **Step 2: Run the broader affected page regressions**

Run: `npx vitest run tests/miniprogram/recipes-page-flow.test.js tests/miniprogram/pantry-page-flow.test.js tests/miniprogram/backup-service.test.js tests/miniprogram/page-flow.test.js`
Expected: PASS

- [ ] **Step 3: Run the full Vitest suite**

Run: `npx vitest run`
Expected: PASS
