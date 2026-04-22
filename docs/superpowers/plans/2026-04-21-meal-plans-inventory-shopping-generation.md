# Meal Plans Inventory Shopping Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the meal-plans inventory check modal so missing ingredients are selectable by default, then generate a brand-new shopping list from the selected missing items and jump to the shopping tab.

**Architecture:** Keep the ingredient availability calculation in `pages/meal-plans/index.js`, but decorate the computed inventory items with selection state at the page layer. Reuse the existing shopping service wrapper (`createShoppingList` + `updateShoppingList` itemDraft flow) to create a new shopping list and append one manual shopping item per selected missing ingredient, avoiding new cloud APIs.

**Tech Stack:** WeChat mini program pages, existing shopping/meal-plan service wrappers, Vitest

---

## File Structure

- Modify: `miniprogram/pages/meal-plans/index.js`
- Modify: `miniprogram/pages/meal-plans/index.wxml`
- Modify: `miniprogram/pages/meal-plans/index.wxss`
- Modify: `tests/miniprogram/meal-plan-page-flow.test.js`
- Modify: `tests/miniprogram/meal-plans-template.test.js`

### Task 1: Add Failing Inventory-Modal Tests

**Files:**
- Modify: `tests/miniprogram/meal-plan-page-flow.test.js`
- Modify: `tests/miniprogram/meal-plans-template.test.js`

- [ ] **Step 1: Write failing tests for missing-item selection and shopping generation**

Add assertions that:

- missing inventory items are marked selected by default when the modal opens
- in-stock items are not selectable
- the generate button reflects the selected missing count
- generating shopping items creates a new shopping list and appends manual item drafts
- after success, the page switches to `/pages/shopping/index`
- template/style includes a selectable missing-item checkbox and a wider modal panel

- [ ] **Step 2: Run the focused meal-plans tests to verify failure**

Run: `pnpm vitest run tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js`
Expected: FAIL because inventory items have no selection state and `generateShoppingList()` is still a placeholder.

### Task 2: Implement Missing-Item Selection State In The Inventory Modal

**Files:**
- Modify: `miniprogram/pages/meal-plans/index.js`
- Modify: `miniprogram/pages/meal-plans/index.wxml`
- Modify: `miniprogram/pages/meal-plans/index.wxss`

- [ ] **Step 1: Add page-state fields for inventory selection**

Introduce:

- `inventorySelectedKeys`
- page helpers that decorate inventory items with `selectable`, `selected`, and checkbox class names
- a derived `inventoryGenerateButtonText` based on selected missing count

- [ ] **Step 2: Default-select missing items when the modal opens**

When `openInventoryCheck()` resolves:

- mark each missing item as selectable
- initialize `inventorySelectedKeys` from all missing-item keys
- keep in-stock items unselectable

- [ ] **Step 3: Add checkbox interaction and modal width update**

In WXML/WXSS:

- render a checkbox only for missing items
- toggle the checkbox state without affecting in-stock rows
- widen the modal panel to better match the approved reference

- [ ] **Step 4: Re-run the focused meal-plans tests to verify partial pass**

Run: `pnpm vitest run tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js`
Expected: the UI-state assertions pass, while generation behavior may still fail until Task 3 is implemented.

### Task 3: Generate A Brand-New Shopping List From Selected Missing Items

**Files:**
- Modify: `miniprogram/pages/meal-plans/index.js`

- [ ] **Step 1: Implement `generateShoppingList()` using existing shopping service calls**

Flow:

1. Guard against empty selection
2. Create a new shopping list with a generated name like `${selectedDate} 食材补货`
3. Sequentially call `updateShoppingList(... itemDraft ...)` once per selected missing item
4. Use the returned `updatedAt` from each step for the next append
5. Switch to `/pages/shopping/index` on success

- [ ] **Step 2: Map missing inventory items into manual shopping drafts**

Each selected missing item should produce:

- `name`: ingredient name
- `quantity`: required quantity text
- `unit`: ingredient unit
- `category`: `''`
- `isChecked`: `false`
- `sourceType`: `manual`
- `notes`: `来自 ${selectedDate} 库存检查`

- [ ] **Step 3: Preserve current modal state on errors**

If creation fails:

- keep the modal open
- keep selected checkboxes intact
- stop loading state
- show an error toast

- [ ] **Step 4: Re-run the focused meal-plans tests to verify pass**

Run: `pnpm vitest run tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js`
Expected: PASS

### Task 4: Final Verification

**Files:**
- Modify all touched files above

- [ ] **Step 1: Run meal-plans and shopping regressions**

Run: `pnpm vitest run tests/miniprogram/meal-plan-page-flow.test.js tests/miniprogram/meal-plans-template.test.js tests/miniprogram/shopping-page-flow.test.js tests/miniprogram/shopping-template.test.js tests/miniprogram/shopping-service.test.js`
Expected: PASS

- [ ] **Step 2: Run the full Vitest suite**

Run: `pnpm vitest run`
Expected: PASS
