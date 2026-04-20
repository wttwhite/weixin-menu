# Shopping Page And Shopping-Domain Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the mini-program shopping page to match the approved green market-style UI, align the shopping domain to the original `the-ai-menu` field names, and let shopping items create pantry records inline before auto-checking themselves complete.

**Architecture:** Keep the data path centered on the existing cloud `api` function and `shopping` service, but switch shopping list and shopping item payloads to the original project’s field names (`name`, `listDate`, `status`, `isChecked`, etc.). Rebuild `pages/shopping/index` into a self-contained page with two in-page modal flows: one for shopping-list creation/editing with manual item drafts, and one for “录入库存” that reuses pantry-form rules through shared helper logic instead of navigating to `pages/pantry-edit/index`.

**Tech Stack:** WeChat mini program pages, cloud functions, shared domain helpers, Vitest, TDesign mini-program components

---

## File Structure

- Modify: `shared/domain/shopping.js`
  Normalize shopping-list writes to original field names and add list-status helpers used by the page layer.
- Modify: `cloudfunctions/api/services/shopping-service.js`
  Persist original shopping field names, accept manual item drafts, and keep generation/toggle flows aligned.
- Modify: `cloudfunctions/api/index.js`
  Repository access stays generic, but shopping list ordering and field handling may need cleanup during list reads.
- Modify: `cloudfunctions/fileOps/services/backup-service.js`
  Ensure shopping export/import payloads preserve the original shopping field names.
- Modify: `cloudfunctions/api/services/statistics-service.js`
  Read `isChecked` and status-aligned shopping metrics correctly after the rename.
- Modify: `miniprogram/services/shopping.js`
  Keep cloud-call wrappers in sync with the renamed shopping payloads.
- Create: `miniprogram/utils/pantry-form.js`
  Extract pantry-form pure helpers needed by both `pages/pantry-edit/index` and the shopping page’s inline pantry modal.
- Modify: `miniprogram/pages/pantry-edit/index.js`
  Reuse the extracted pantry-form helpers instead of keeping duplicate local implementations.
- Modify: `miniprogram/pages/shopping/index.js`
  Replace picker-based single-list view with hero metrics, status filters, card rendering, shopping-list modal state, and inline pantry-entry modal logic.
- Modify: `miniprogram/pages/shopping/index.wxml`
  Render the new hero, tabs, cards, list modal, and pantry-entry modal.
- Modify: `miniprogram/pages/shopping/index.wxss`
  Apply the market action panel layout and modal styling shown in the approved references.
- Modify: `miniprogram/pages/shopping/index.json`
  Register any extra components needed by the new page structure.
- Test: `tests/shared/shopping-domain.test.js`
  Update shared-domain expectations to original shopping field names.
- Test: `tests/cloudfunctions/shopping-service.test.js`
  Cover renamed shopping fields, manual draft creation, and `isChecked` toggles.
- Test: `tests/cloudfunctions/backup-service.test.js`
  Prove shopping backup payloads round-trip the original field names.
- Test: `tests/cloudfunctions/statistics-service.test.js`
  Verify shopping progress still aggregates after switching to `isChecked`.
- Test: `tests/miniprogram/shopping-service.test.js`
  Update cloud-wrapper expectations to original field names.
- Create: `tests/miniprogram/shopping-page-flow.test.js`
  Cover status filters, list modal save flow, and inline pantry-entry auto-check behavior.
- Create: `tests/miniprogram/shopping-template.test.js`
  Lock the new page structure and modal markup.

### Task 1: Align Shared Shopping Domain

**Files:**
- Modify: `shared/domain/shopping.js`
- Modify: `tests/shared/shopping-domain.test.js`

- [ ] **Step 1: Write failing shared-domain assertions for original shopping field names**

```js
expect(normalizeShoppingListWrite({ name: 'Weekend', listDate: '2026-04-16', status: 'open' })).toEqual({
  name: 'Weekend',
  listDate: '2026-04-16',
  status: 'open',
  notes: ''
})

expect(normalizeShoppingItemWrite({ name: 'Milk', category: '乳制品', isChecked: true })).toEqual({
  name: 'Milk',
  category: '乳制品',
  quantity: '',
  unit: '',
  isChecked: true,
  sourceType: 'manual',
  sourceRefType: '',
  sourceRefId: '',
  recipeId: null,
  mealPlanId: null,
  notes: '',
  sortOrder: 0
})
```

- [ ] **Step 2: Run the shared shopping test to verify failure**

Run: `npx vitest run tests/shared/shopping-domain.test.js`
Expected: FAIL because the current shared domain still normalizes `title` / `checked`-style writes.

- [ ] **Step 3: Implement the minimal shared-domain rename**

Update `shared/domain/shopping.js` so that:

- `normalizeShoppingListWrite()` returns `name`, `listDate`, `status`, `notes`
- default list status is `open`
- `normalizeShoppingItemWrite()` returns `category`, `isChecked`, `sourceType`, `sourceRefType`, `sourceRefId`, `recipeId`, `mealPlanId`, `sortOrder`
- generated items created from meal plans use `isChecked: false`

- [ ] **Step 4: Sync shared copies after changing root shared code**

Run: `node scripts/sync-shared.cjs`
Expected: `miniprogram/shared` and cloud-function shared mirrors update successfully.

- [ ] **Step 5: Re-run the shared shopping test to verify pass**

Run: `npx vitest run tests/shared/shopping-domain.test.js`
Expected: PASS

- [ ] **Step 6: Commit the shared shopping rename**

```bash
git add shared/domain/shopping.js miniprogram/shared/domain/shopping.js cloudfunctions/api/shared/domain/shopping.js cloudfunctions/fileOps/shared/domain/shopping.js cloudfunctions/memberOps/shared/domain/shopping.js tests/shared/shopping-domain.test.js
git commit -m "refactor: align shopping shared domain fields"
```

### Task 2: Align Cloud Shopping, Statistics, And Backup Services

**Files:**
- Modify: `cloudfunctions/api/services/shopping-service.js`
- Modify: `cloudfunctions/api/services/statistics-service.js`
- Modify: `cloudfunctions/fileOps/services/backup-service.js`
- Modify: `tests/cloudfunctions/shopping-service.test.js`
- Modify: `tests/cloudfunctions/statistics-service.test.js`
- Modify: `tests/cloudfunctions/backup-service.test.js`

- [ ] **Step 1: Write failing cloud-service tests for renamed shopping list and item fields**

Add or update assertions like:

```js
expect(created.item).toEqual(expect.objectContaining({
  name: 'Weekend List',
  listDate: '2026-04-16',
  status: 'open'
}))

expect(generated.items[0]).toEqual(expect.objectContaining({
  name: 'Egg',
  isChecked: false,
  sourceType: 'generated'
}))

expect(toggled.item.isChecked).toBe(true)
```

- [ ] **Step 2: Run the cloud shopping/statistics/backup tests to verify failure**

Run: `npx vitest run tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/cloudfunctions/backup-service.test.js`
Expected: FAIL because services and backup export still assume the old shopping field names.

- [ ] **Step 3: Update shopping service to persist original field names**

In `cloudfunctions/api/services/shopping-service.js`:

- create and update shopping lists with `name`, `listDate`, `status`, `notes`
- create and update shopping items with `isChecked`
- keep `sourceType`, `sourceRefType`, `sourceRefId`, `recipeId`, `mealPlanId`, `sortOrder`
- allow manual item drafts in renamed shape

- [ ] **Step 4: Update statistics and backup for the renamed shopping shape**

Make these minimum fixes:

- `statistics-service.js` reads `isChecked`
- `backup-service.js` exports/imports shopping lists and items with `name`, `listDate`, and `isChecked`

- [ ] **Step 5: Re-run the cloud shopping/statistics/backup tests to verify pass**

Run: `npx vitest run tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/cloudfunctions/backup-service.test.js`
Expected: PASS

- [ ] **Step 6: Commit the cloud shopping alignment**

```bash
git add cloudfunctions/api/services/shopping-service.js cloudfunctions/api/services/statistics-service.js cloudfunctions/fileOps/services/backup-service.js tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/cloudfunctions/backup-service.test.js
git commit -m "refactor: align shopping cloud services with original schema"
```

### Task 3: Align Mini-Program Shopping Service Wrapper

**Files:**
- Modify: `miniprogram/services/shopping.js`
- Modify: `tests/miniprogram/shopping-service.test.js`

- [ ] **Step 1: Write failing mini-program service expectations for `name` / `isChecked`**

Update the test so the wrapper sends:

```js
shoppingList: { name: 'Weekend', listDate: '2026-04-16', status: 'open' }
```

and expects toggle responses shaped like:

```js
{ item: { _id: 'item-1', isChecked: true } }
```

- [ ] **Step 2: Run the mini-program shopping service test to verify failure**

Run: `npx vitest run tests/miniprogram/shopping-service.test.js`
Expected: FAIL because the wrapper test still asserts `title` and `checked`.

- [ ] **Step 3: Apply the minimal wrapper updates**

Keep method names stable, but update request payload examples and response expectations to the renamed shopping shape.

- [ ] **Step 4: Re-run the mini-program shopping service test to verify pass**

Run: `npx vitest run tests/miniprogram/shopping-service.test.js`
Expected: PASS

- [ ] **Step 5: Commit the wrapper alignment**

```bash
git add miniprogram/services/shopping.js tests/miniprogram/shopping-service.test.js
git commit -m "refactor: align shopping mini-program service payloads"
```

### Task 4: Extract Reusable Pantry-Form Helpers For Inline Inventory Entry

**Files:**
- Create: `miniprogram/utils/pantry-form.js`
- Modify: `miniprogram/pages/pantry-edit/index.js`
- Create: `tests/miniprogram/pantry-form.test.js`

- [ ] **Step 1: Write failing helper tests for empty pantry form defaults and expiration-date derivation**

```js
expect(createEmptyPantryForm()).toEqual(expect.objectContaining({
  name: '',
  quantity: '1',
  usageStatus: 'normal'
}))

expect(resolveExpirationDate({
  productionDate: '2026-04-16',
  shelfLifeMonths: '2',
  expirationDate: ''
})).toBe('2026-06-16')
```

- [ ] **Step 2: Run the helper test to verify failure**

Run: `npx vitest run tests/miniprogram/pantry-form.test.js`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Extract the pure pantry-form functions**

Move the following pure helpers out of `pages/pantry-edit/index.js` into `miniprogram/utils/pantry-form.js`:

- `createEmptyForm` → exported as `createEmptyPantryForm`
- `addMonthsToIsoDate`
- `resolveExpirationDate`
- picker-label helpers needed by both pages

Then update `pages/pantry-edit/index.js` to import and use them.

- [ ] **Step 4: Re-run the pantry-form helper test and pantry page-flow test**

Run: `npx vitest run tests/miniprogram/pantry-form.test.js tests/miniprogram/pantry-page-flow.test.js`
Expected: PASS

- [ ] **Step 5: Commit the pantry-form helper extraction**

```bash
git add miniprogram/utils/pantry-form.js miniprogram/pages/pantry-edit/index.js tests/miniprogram/pantry-form.test.js
git commit -m "refactor: extract reusable pantry form helpers"
```

### Task 5: Rebuild Shopping Page UI And Shopping-List Modal

**Files:**
- Modify: `miniprogram/pages/shopping/index.js`
- Modify: `miniprogram/pages/shopping/index.wxml`
- Modify: `miniprogram/pages/shopping/index.wxss`
- Modify: `miniprogram/pages/shopping/index.json`
- Create: `tests/miniprogram/shopping-page-flow.test.js`
- Create: `tests/miniprogram/shopping-template.test.js`

- [ ] **Step 1: Write failing page-flow and template tests for the new shopping page structure**

Add coverage for:

- hero title `采购清单`
- no `切换空间` button
- status filters `全部 / 进行中 / 已完成 / 已归档`
- shopping list modal fields `name / listDate / status / notes`
- card rendering with progress and inline items

- [ ] **Step 2: Run the shopping page tests to verify failure**

Run: `npx vitest run tests/miniprogram/shopping-page-flow.test.js tests/miniprogram/shopping-template.test.js`
Expected: FAIL because the current shopping page still uses the old hero, picker card, and standalone actions.

- [ ] **Step 3: Implement shopping page view state and list modal flow**

Update `miniprogram/pages/shopping/index.js` so it:

- computes hero metrics from all loaded lists
- filters lists by `open`, `completed`, `archived`
- opens a custom create/edit modal instead of `wx.showModal`
- stores manual item draft rows inside the modal state
- saves shopping lists using `name`, `listDate`, `status`, `notes`

- [ ] **Step 4: Replace template and styles with the approved market-panel layout**

Update `index.wxml` and `index.wxss` to render:

- green hero with metrics panel
- inline status tabs with counts
- shopping list cards with status badge and progress bar
- white modal shell matching the approved screenshots

- [ ] **Step 5: Re-run the shopping page tests to verify pass**

Run: `npx vitest run tests/miniprogram/shopping-page-flow.test.js tests/miniprogram/shopping-template.test.js`
Expected: PASS

- [ ] **Step 6: Commit the shopping page redesign**

```bash
git add miniprogram/pages/shopping/index.js miniprogram/pages/shopping/index.wxml miniprogram/pages/shopping/index.wxss miniprogram/pages/shopping/index.json tests/miniprogram/shopping-page-flow.test.js tests/miniprogram/shopping-template.test.js
git commit -m "feat: redesign shopping page and list modal"
```

### Task 6: Add Inline Pantry-Entry Modal And Auto-Check Flow

**Files:**
- Modify: `miniprogram/pages/shopping/index.js`
- Modify: `miniprogram/pages/shopping/index.wxml`
- Modify: `miniprogram/pages/shopping/index.wxss`
- Test: `tests/miniprogram/shopping-page-flow.test.js`

- [ ] **Step 1: Extend the page-flow test with a failing pantry-entry scenario**

Add assertions that:

- tapping `录入库存` opens the pantry-entry modal
- modal fields are prefilled from the shopping item
- submitting creates a pantry item
- the shopping item is toggled to `isChecked: true`
- the page reloads with updated progress

- [ ] **Step 2: Run the shopping page-flow test to verify failure**

Run: `npx vitest run tests/miniprogram/shopping-page-flow.test.js`
Expected: FAIL because no inline pantry-entry modal exists yet.

- [ ] **Step 3: Implement the minimum pantry-entry modal**

In `miniprogram/pages/shopping/index.js`:

- load pantry categories and locations on demand
- build a pantry draft with `createEmptyPantryForm()`
- prefill from the selected shopping item
- submit through `createPantryService().createPantryItem(...)`
- then call `createShoppingService().toggleShoppingItemChecked(...)` with `true`

In `index.wxml` / `index.wxss`:

- add the pantry-entry modal shell
- reuse pantry-style form rows and footer buttons

- [ ] **Step 4: Re-run the shopping page-flow test and pantry page-flow regression**

Run: `npx vitest run tests/miniprogram/shopping-page-flow.test.js tests/miniprogram/pantry-page-flow.test.js`
Expected: PASS

- [ ] **Step 5: Commit the inline pantry-entry flow**

```bash
git add miniprogram/pages/shopping/index.js miniprogram/pages/shopping/index.wxml miniprogram/pages/shopping/index.wxss tests/miniprogram/shopping-page-flow.test.js
git commit -m "feat: add inline pantry entry from shopping items"
```

### Task 7: Run Focused Verification And Full-Suite Check

**Files:**
- Test: `tests/shared/shopping-domain.test.js`
- Test: `tests/cloudfunctions/shopping-service.test.js`
- Test: `tests/cloudfunctions/statistics-service.test.js`
- Test: `tests/cloudfunctions/backup-service.test.js`
- Test: `tests/miniprogram/shopping-service.test.js`
- Test: `tests/miniprogram/pantry-form.test.js`
- Test: `tests/miniprogram/shopping-page-flow.test.js`
- Test: `tests/miniprogram/shopping-template.test.js`
- Test: `tests/miniprogram/pantry-page-flow.test.js`

- [ ] **Step 1: Run the focused shopping and pantry verification set**

Run: `npx vitest run tests/shared/shopping-domain.test.js tests/cloudfunctions/shopping-service.test.js tests/cloudfunctions/statistics-service.test.js tests/cloudfunctions/backup-service.test.js tests/miniprogram/shopping-service.test.js tests/miniprogram/pantry-form.test.js tests/miniprogram/shopping-page-flow.test.js tests/miniprogram/shopping-template.test.js tests/miniprogram/pantry-page-flow.test.js`
Expected: PASS

- [ ] **Step 2: Run the full repository verification**

Run: `npx vitest run`
Expected: PASS, or if unrelated pre-existing failures remain, capture them explicitly and do not claim full green status.

- [ ] **Step 3: Commit the final shopping alignment verification fixes**

```bash
git add docs/superpowers/specs/2026-04-16-shopping-page-shopping-domain-alignment-design.md docs/superpowers/plans/2026-04-16-shopping-page-shopping-domain-alignment.md
git commit -m "docs: add shopping page alignment plan"
```
