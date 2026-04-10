import { describe, expect, it } from 'vitest'
import {
  createRecipe,
  createRecipeTag,
  deleteRecipe,
  deleteRecipeTag,
  getRecipeDetail,
  listRecipeTags,
  listRecipes,
  updateRecipe
} from '../../cloudfunctions/api/services/recipe-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const recipes = []
  const tags = []
  let recipeIndex = 1
  let tagIndex = 1

  return {
    async listRecipes(spaceId) {
      return recipes
        .filter((item) => item.spaceId === spaceId && item.deletedAt === '')
        .map((item) => ({ ...item }))
    },
    async getRecipe(spaceId, recipeId) {
      const matched = recipes.find((item) => item.spaceId === spaceId && item._id === recipeId)
      return matched ? { ...matched } : null
    },
    async createRecipe(data) {
      const item = {
        _id: `recipe-${recipeIndex++}`,
        ...data
      }
      recipes.push(item)
      return { ...item }
    },
    async updateRecipe(spaceId, recipeId, patch) {
      const index = recipes.findIndex((item) => item.spaceId === spaceId && item._id === recipeId)
      if (index === -1) {
        return null
      }
      recipes[index] = {
        ...recipes[index],
        ...patch
      }
      return { ...recipes[index] }
    },
    async listRecipeTags(spaceId) {
      return tags
        .filter((item) => item.spaceId === spaceId && item.deletedAt === '')
        .map((item) => ({ ...item }))
    },
    async getRecipeTag(spaceId, tagId) {
      const matched = tags.find((item) => item.spaceId === spaceId && item._id === tagId)
      return matched ? { ...matched } : null
    },
    async createRecipeTag(data) {
      const item = {
        _id: `tag-${tagIndex++}`,
        ...data
      }
      tags.push(item)
      return { ...item }
    },
    async updateRecipeTag(spaceId, tagId, patch) {
      const index = tags.findIndex((item) => item.spaceId === spaceId && item._id === tagId)
      if (index === -1) {
        return null
      }
      tags[index] = {
        ...tags[index],
        ...patch
      }
      return { ...tags[index] }
    }
  }
}

describe('recipe service', () => {
  it('supports recipe CRUD and detail with resolved tags', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const firstTag = await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '快手',
          color: '#FF8A65'
        }
      },
      context,
      repository
    )
    await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '家常',
          color: '#4DB6AC'
        }
      },
      context,
      repository
    )

    const created = await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Mapo Tofu',
          category: 'Sichuan',
          isFavorite: true,
          ingredients: [
            { name: 'Tofu', sortOrder: 2 },
            { name: 'Pork', sortOrder: 1 }
          ],
          steps: [
            { content: 'Cook', sortOrder: 2 },
            { content: 'Prep', sortOrder: 1 }
          ],
          tagIds: [firstTag.item._id]
        }
      },
      context,
      repository
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        _id: 'recipe-1',
        name: 'Mapo Tofu',
        isFavorite: true
      })
    )
    expect(created.item.ingredients.map((item) => item.name)).toEqual(['Pork', 'Tofu'])
    expect(created.item.steps.map((item) => item.content)).toEqual(['Prep', 'Cook'])

    const listed = await listRecipes(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )
    expect(listed.items).toHaveLength(1)
    expect(listed.items[0].tags).toEqual([
      expect.objectContaining({
        _id: firstTag.item._id,
        name: '快手'
      })
    ])

    const detailed = await getRecipeDetail(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1'
      },
      context,
      repository
    )
    expect(detailed.item._id).toBe('recipe-1')
    expect(detailed.item.tags).toHaveLength(1)

    const updated = await updateRecipe(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        recipe: {
          name: 'Mapo Tofu (Less Oil)',
          isFavorite: false,
          ingredients: [{ name: 'Tofu', sortOrder: 1 }],
          steps: [{ content: 'Steam', sortOrder: 1 }],
          tagIds: []
        }
      },
      context,
      repository
    )
    expect(updated.item).toEqual(
      expect.objectContaining({
        name: 'Mapo Tofu (Less Oil)',
        isFavorite: false
      })
    )

    const removed = await deleteRecipe(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1'
      },
      context,
      repository
    )
    expect(removed).toEqual({
      recipeId: 'recipe-1',
      deleted: true
    })
  })

  it('supports recipe-tag list and soft delete', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '低卡'
        }
      },
      context,
      repository
    )
    expect(created.item.color).toBe('#E6A23C')

    const listed = await listRecipeTags(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )
    expect(listed.items).toHaveLength(1)

    await deleteRecipeTag(
      {
        spaceId: 'space-1',
        tagId: created.item._id
      },
      context,
      repository
    )

    const listedAfterDelete = await listRecipeTags(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )
    expect(listedAfterDelete.items).toEqual([])
  })

  it('validates required fields and returns INVALID_INPUT', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: '   '
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('does not persist denormalized tags array on recipe create and update writes', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Tomato Egg',
          tags: [{ id: 'tag-1', name: '家常' }],
          tagIds: ['tag-1']
        }
      },
      context,
      repository
    )

    expect(created.item.tagIds).toEqual(['tag-1'])
    expect(Object.prototype.hasOwnProperty.call(created.item, 'tags')).toBe(false)

    const updated = await updateRecipe(
      {
        spaceId: 'space-1',
        recipeId: created.item._id,
        recipe: {
          name: 'Tomato Egg 2',
          tags: [{ id: 'tag-2', name: '快手' }],
          tagIds: ['tag-2']
        }
      },
      context,
      repository
    )

    expect(updated.item.tagIds).toEqual(['tag-2'])
    expect(Object.prototype.hasOwnProperty.call(updated.item, 'tags')).toBe(false)
  })
})
