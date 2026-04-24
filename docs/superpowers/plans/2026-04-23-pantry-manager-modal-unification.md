# Pantry Manager Modal Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove pantry-location management from the pantry settings modal and make pantry category/location management in the profile page reuse one shared pantry manager modal design.

**Architecture:** Extract the pantry manager UI from the pantry page into a shared component, keep service calls and state transitions in page files, and update both pantry/profile pages to drive the same component with mode-specific copy and API methods.

**Tech Stack:** WeChat mini program pages/components, existing pantry services, Vitest

---

## File Structure

- Create: `miniprogram/components/pantry-manager-modal/index.js`
- Create: `miniprogram/components/pantry-manager-modal/index.json`
- Create: `miniprogram/components/pantry-manager-modal/index.wxml`
- Create: `miniprogram/components/pantry-manager-modal/index.wxss`
- Modify: `miniprogram/pages/pantry/index.js`
- Modify: `miniprogram/pages/pantry/index.json`
- Modify: `miniprogram/pages/pantry/index.wxml`
- Modify: `miniprogram/pages/pantry/index.wxss`
- Modify: `miniprogram/pages/profile/index.js`
- Modify: `miniprogram/pages/profile/index.json`
- Modify: `miniprogram/pages/profile/index.wxml`
- Modify: `miniprogram/pages/profile/index.wxss`
- Modify: `miniprogram/utils/pantry-manager.js`
- Modify: `tests/miniprogram/pantry-template.test.js`
- Modify: `tests/miniprogram/pantry-list-page-flow.test.js`
- Modify: `tests/miniprogram/profile-template.test.js`
- Modify: `tests/miniprogram/profile-page-flow.test.js`

### Task 1: Lock The New Modal Boundaries In Tests

**Files:**
- Modify: `tests/miniprogram/pantry-template.test.js`
- Modify: `tests/miniprogram/pantry-list-page-flow.test.js`
- Modify: `tests/miniprogram/profile-template.test.js`
- Modify: `tests/miniprogram/profile-page-flow.test.js`

- [ ] **Step 1: Write the failing tests**

Add assertions that:

- pantry settings modal no longer renders the location-management section
- pantry settings modal only loads pantry categories when opened
- profile page no longer renders the old `manager-modal`
- profile page renders a shared pantry manager modal component
- opening pantry category/location from profile loads the corresponding pantry items into shared modal state

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/miniprogram/pantry-template.test.js tests/miniprogram/pantry-list-page-flow.test.js tests/miniprogram/profile-template.test.js tests/miniprogram/profile-page-flow.test.js`
Expected: FAIL because the pantry page still renders the old two-section settings modal and profile still uses `manager-modal`.

### Task 2: Extract Shared Pantry Manager Modal

**Files:**
- Create: `miniprogram/components/pantry-manager-modal/index.js`
- Create: `miniprogram/components/pantry-manager-modal/index.json`
- Create: `miniprogram/components/pantry-manager-modal/index.wxml`
- Create: `miniprogram/components/pantry-manager-modal/index.wxss`

- [ ] **Step 1: Write the minimal shared component**

Implement a component that accepts:

- `visible`
- `title`
- `metaText`
- `inputPlaceholder`
- `inputValue`
- `loading`
- `loadingText`
- `items`
- `draggingIndex`
- `emptyIllustration`
- `emptyTitle`
- `emptyText`

and emits:

- `close`
- `inputchange`
- `submit`
- `rename`
- `delete`
- `dragstart`
- `dragmove`
- `dragend`
- `dragcancel`

- [ ] **Step 2: Reuse pantry settings visual language**

Port the current pantry settings list row structure, drag handle, count badge, empty state, and confirm button sizing into the component stylesheet.

### Task 3: Move Pantry Page To Category-Only Shared Modal

**Files:**
- Modify: `miniprogram/pages/pantry/index.js`
- Modify: `miniprogram/pages/pantry/index.json`
- Modify: `miniprogram/pages/pantry/index.wxml`
- Modify: `miniprogram/pages/pantry/index.wxss`

- [ ] **Step 1: Update pantry page state and tests-first expectations**

Keep only the category manager modal UI path in pantry settings state.

- [ ] **Step 2: Implement pantry page wiring**

- register the new component
- replace the inline settings markup with the shared component
- load only pantry categories in `openSettingsModal`
- keep category create/rename/delete/reorder behavior
- leave location loading available only where pantry forms need it

- [ ] **Step 3: Run focused pantry tests**

Run: `npx vitest run tests/miniprogram/pantry-template.test.js tests/miniprogram/pantry-list-page-flow.test.js`
Expected: PASS

### Task 4: Move Profile Pantry Managers To Shared Modal

**Files:**
- Modify: `miniprogram/pages/profile/index.js`
- Modify: `miniprogram/pages/profile/index.json`
- Modify: `miniprogram/pages/profile/index.wxml`
- Modify: `miniprogram/pages/profile/index.wxss`
- Modify: `miniprogram/utils/pantry-manager.js`

- [ ] **Step 1: Replace old pantry manager modal state**

Convert profile pantry category/location management to a single shared pantry manager modal state model with mode-specific config.

- [ ] **Step 2: Implement profile pantry manager behavior**

- open pantry category/location with shared component
- feed title/placeholder/meta/empty copy from pantry manager config
- support create, rename, delete, and reorder for both pantry category and pantry location
- keep recipe category modal unchanged

- [ ] **Step 3: Run focused profile tests**

Run: `npx vitest run tests/miniprogram/profile-template.test.js tests/miniprogram/profile-page-flow.test.js`
Expected: PASS

### Task 5: Final Verification

**Files:**
- Modify: no new files beyond the task outputs

- [ ] **Step 1: Run the complete targeted suite**

Run: `npx vitest run tests/miniprogram/pantry-template.test.js tests/miniprogram/pantry-list-page-flow.test.js tests/miniprogram/profile-template.test.js tests/miniprogram/profile-page-flow.test.js`
Expected: PASS

- [ ] **Step 2: Run full project verification required by repo instructions**

Run: `npx vitest run`
Expected: PASS
