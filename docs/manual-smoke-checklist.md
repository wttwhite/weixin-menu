# Manual Smoke Checklist

## Accounts

- Prepare one owner account and one member account.
- Ensure both can enter the same cloud environment.

## Bootstrap

- In a fresh cloud environment without business collections, open the mini program and confirm the boot page shows `初始化云数据库`.
- Tap `初始化云数据库` and verify the app can continue into the space selection flow without manually creating collections.
- Confirm the created business collections are still configured as `所有用户不可读写`.

## Space

- Create a new space with the owner account.
- Join the same space with the member account.
- Verify the active space switches correctly on both sides.

## Pantry

- Add a pantry item.
- Edit the pantry item.
- Delete the pantry item.
- Verify category/location/status filtering.

## Recipes

- Create a recipe with ingredients, steps, and tags.
- Upload at least one cover image and one step/gallery image.
- Edit the recipe and confirm images remain attached.
- Delete a recipe and confirm related images are cleaned up.

## Meal Plans

- Create at least one breakfast plan and one dinner plan.
- Add multiple recipes to a plan.
- Edit a saved plan.
- Verify stale/deleted recipe snapshots render as fallback labels.

## Shopping

- Create a shopping list.
- Add a manual shopping item.
- Generate items from meal plans.
- Toggle checked state.
- Edit an existing shopping item.

## Statistics And Members

- Open statistics and confirm counts/progress render.
- Open member management as owner.
- Rotate invite code.
- Remove a non-owner member.
- Verify a non-owner cannot remove members or import backup.

## Backup

- Export the current space backup.
- Confirm the export record appears in the backup page.
- Copy the export link and verify it is retrievable.
- Import the same backup into a fresh test space.
- Verify recipes, pantry items, meal plans, shopping lists, tags, images, and backup records restore correctly.
- Try an invalid zip and confirm the page shows a clear Chinese error.

## Final Check

- Run `npx vitest run`.
- Confirm all test files pass before push/release.
