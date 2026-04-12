# Cloud Collections

## Business Collections

- `spaces`
  Shared family/team spaces.
- `space_members`
  Membership, role, and active access records.
- `recipes`
  Recipe documents with text structure, canonical image references, and tag ids.
- `recipe_tags`
  Space-scoped tag dictionary.
- `recipe_images`
  Image metadata managed through `fileOps`.
- `pantry_items`
  Shared pantry records.
- `meal_plans`
  Plan documents with `planDate`, `mealType`, and embedded `recipes[]` snapshots.
- `shopping_lists`
  Shopping list headers.
- `shopping_items`
  Shopping list items.
- `backup_records`
  Export/import history records.

## Expected Space Scoping

- Every business document should carry `spaceId`.
- Data reads and writes should be gated through cloud functions.

## File Storage Paths

- Recipe images:
  `spaces/{spaceId}/recipes/{recipeId|draft}/images/{role}/...`
- Backup zips:
  `spaces/{spaceId}/backup/...`
- Temporary import zips:
  `spaces/{spaceId}/backup/tmp/...`

## Notes

- Recipe image authority is the `recipe_images` collection plus cloud storage, not client-submitted image metadata.
- Backup import/export is implemented in `cloudfunctions/fileOps/services/backup-service.js`.
