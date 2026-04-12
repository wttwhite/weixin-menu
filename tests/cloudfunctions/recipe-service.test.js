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
  const recipeImages = []
  const deletedCloudFiles = []
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
    async listRecipeImagesByIds(spaceId, imageIds = []) {
      const idSet = new Set(imageIds)
      return recipeImages
        .filter((item) => item.spaceId === spaceId && idSet.has(item._id))
        .map((item) => ({ ...item }))
    },
    async listRecipeImagesByRecipeId(spaceId, recipeId) {
      return recipeImages
        .filter((item) => item.spaceId === spaceId && item.recipeId === recipeId)
        .map((item) => ({ ...item }))
    },
    async updateRecipeImage(spaceId, imageId, patch) {
      const index = recipeImages.findIndex((item) => item.spaceId === spaceId && item._id === imageId)
      if (index === -1) {
        return null
      }
      recipeImages[index] = {
        ...recipeImages[index],
        ...patch
      }
      return { ...recipeImages[index] }
    },
    async deleteCloudFiles(fileIds = []) {
      deletedCloudFiles.push(...fileIds)
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
    },
    async isRecipeTagInUse(spaceId, tagId) {
      return recipes.some((item) => {
        if (item.spaceId !== spaceId || item.deletedAt) {
          return false
        }
        const tagIds = Array.isArray(item.tagIds) ? item.tagIds : []
        return tagIds.includes(tagId)
      })
    },
    __seedRecipeImage(image) {
      recipeImages.push({ ...image })
    },
    __getRecipeImage(imageId) {
      return recipeImages.find((item) => item._id === imageId) || null
    },
    __getDeletedCloudFiles() {
      return [...deletedCloudFiles]
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
    const createdTag = await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '家常'
        }
      },
      context,
      repository
    )

    const created = await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Tomato Egg',
          tags: [{ id: createdTag.item._id, name: '家常' }],
          tagIds: [createdTag.item._id]
        }
      },
      context,
      repository
    )

    expect(created.item.tagIds).toEqual([createdTag.item._id])
    expect(Object.prototype.hasOwnProperty.call(created.item, 'tags')).toBe(false)

    const secondTag = await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '快手'
        }
      },
      context,
      repository
    )

    const updated = await updateRecipe(
      {
        spaceId: 'space-1',
        recipeId: created.item._id,
        recipe: {
          name: 'Tomato Egg 2',
          tags: [{ id: secondTag.item._id, name: '快手' }],
          tagIds: [secondTag.item._id]
        }
      },
      context,
      repository
    )

    expect(updated.item.tagIds).toEqual([secondTag.item._id])
    expect(Object.prototype.hasOwnProperty.call(updated.item, 'tags')).toBe(false)
  })

  it('rejects invalid, stale, and foreign tagIds on recipe create and update', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const homeTag = await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '家常'
        }
      },
      context,
      repository
    )
    const foreignTag = await createRecipeTag(
      {
        spaceId: 'space-2',
        tag: {
          name: '异空间'
        }
      },
      context,
      repository
    )

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: 'Bad Foreign Tag',
            tagIds: [foreignTag.item._id]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: 'Bad Missing Tag',
            tagIds: ['not-exist-tag']
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })

    await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Safe Tag Recipe',
          tagIds: []
        }
      },
      context,
      repository
    )
    await deleteRecipeTag(
      {
        spaceId: 'space-1',
        tagId: homeTag.item._id
      },
      context,
      repository
    )

    await expect(
      updateRecipe(
        {
          spaceId: 'space-1',
          recipeId: 'recipe-1',
          recipe: {
            name: 'Use Stale Tag',
            tagIds: [homeTag.item._id]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('rejects deleting a recipe tag when active recipes still reference it', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const createdTag = await createRecipeTag(
      {
        spaceId: 'space-1',
        tag: {
          name: '快手'
        }
      },
      context,
      repository
    )
    await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Mapo',
          tagIds: [createdTag.item._id]
        }
      },
      context,
      repository
    )

    await expect(
      deleteRecipeTag(
        {
          spaceId: 'space-1',
          tagId: createdTag.item._id
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT
    })
  })

  it('rejects deleting an in-use tag even when listRecipes is capped to first 100 rows', async () => {
    const context = { openid: 'user-1' }
    const tags = [
      {
        _id: 'tag-1',
        spaceId: 'space-1',
        name: '家常',
        color: '#E6A23C',
        deletedAt: ''
      }
    ]
    const recipes = Array.from({ length: 120 }, (_, index) => ({
      _id: `recipe-${index + 1}`,
      spaceId: 'space-1',
      name: `Recipe ${index + 1}`,
      tagIds: index === 119 ? ['tag-1'] : [],
      deletedAt: ''
    }))

    const repository = {
      async getRecipeTag(spaceId, tagId) {
        const matched = tags.find((item) => item.spaceId === spaceId && item._id === tagId)
        return matched ? { ...matched } : null
      },
      async listRecipes(spaceId) {
        return recipes
          .filter((item) => item.spaceId === spaceId && item.deletedAt === '')
          .slice(0, 100)
          .map((item) => ({ ...item }))
      },
      async isRecipeTagInUse(spaceId, tagId) {
        return recipes.some((item) => {
          if (item.spaceId !== spaceId || item.deletedAt) {
            return false
          }
          const tagIds = Array.isArray(item.tagIds) ? item.tagIds : []
          return tagIds.includes(tagId)
        })
      },
      async updateRecipeTag() {
        throw new Error('should not delete in-use tag')
      }
    }

    await expect(
      deleteRecipeTag(
        {
          spaceId: 'space-1',
          tagId: 'tag-1'
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONFLICT
    })
  })

  it('returns list metadata so capped recipe list can expose truncation', async () => {
    const context = { openid: 'user-1' }
    const tags = [
      {
        _id: 'tag-1',
        spaceId: 'space-1',
        name: '家常',
        color: '#E6A23C',
        deletedAt: ''
      }
    ]
    const recipes = Array.from({ length: 120 }, (_, index) => ({
      _id: `recipe-${index + 1}`,
      spaceId: 'space-1',
      name: `Recipe ${index + 1}`,
      tagIds: index === 0 ? ['tag-1'] : [],
      deletedAt: ''
    }))
    const repository = {
      async listRecipes(spaceId) {
        return recipes
          .filter((item) => item.spaceId === spaceId && item.deletedAt === '')
          .slice(0, 100)
          .map((item) => ({ ...item }))
      },
      async listRecipeTags(spaceId) {
        return tags
          .filter((item) => item.spaceId === spaceId && item.deletedAt === '')
          .map((item) => ({ ...item }))
      },
      async getRecipeListMetadata(spaceId) {
        const total = recipes.filter((item) => item.spaceId === spaceId && item.deletedAt === '').length
        return {
          total
        }
      }
    }

    const listed = await listRecipes(
      {
        spaceId: 'space-1'
      },
      context,
      repository
    )

    expect(listed.items).toHaveLength(100)
    expect(listed.total).toBe(120)
    expect(listed.limit).toBe(100)
    expect(listed.hasMore).toBe(true)
  })

  it('uses repository.createRecipeAtomic when available', async () => {
    const context = { openid: 'user-1' }
    const createRecipeAtomic = async (data) => ({
      _id: 'recipe-atomic-1',
      ...data
    })
    const repository = {
      createRecipeAtomic,
      listRecipeTags: async () => {
        throw new Error('listRecipeTags fallback should not be used')
      },
      createRecipe: async () => {
        throw new Error('createRecipe fallback should not be used')
      }
    }

    const created = await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Atomic Recipe',
          tagIds: ['tag-1']
        }
      },
      context,
      repository
    )

    expect(created.item).toEqual(
      expect.objectContaining({
        _id: 'recipe-atomic-1',
        name: 'Atomic Recipe'
      })
    )
  })

  it('uses repository.updateRecipeAtomic when available', async () => {
    const context = { openid: 'user-1' }
    const repository = {
      updateRecipeAtomic: async (_spaceId, recipeId, patch) => ({
        _id: recipeId,
        ...patch
      }),
      getRecipe: async () => {
        throw new Error('getRecipe fallback should not be used')
      },
      listRecipeTags: async () => {
        throw new Error('listRecipeTags fallback should not be used')
      },
      updateRecipe: async () => {
        throw new Error('updateRecipe fallback should not be used')
      }
    }

    const updated = await updateRecipe(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        recipe: {
          name: 'Atomic Update',
          tagIds: ['tag-1']
        }
      },
      context,
      repository
    )

    expect(updated.item).toEqual(
      expect.objectContaining({
        _id: 'recipe-1',
        name: 'Atomic Update'
      })
    )
  })

  it('uses repository.deleteRecipeTagAtomic when available', async () => {
    const context = { openid: 'user-1' }
    const repository = {
      deleteRecipeTagAtomic: async (_spaceId, tagId, patch) => ({
        _id: tagId,
        ...patch
      }),
      getRecipeTag: async () => {
        throw new Error('getRecipeTag fallback should not be used')
      },
      isRecipeTagInUse: async () => {
        throw new Error('isRecipeTagInUse fallback should not be used')
      },
      updateRecipeTag: async () => {
        throw new Error('updateRecipeTag fallback should not be used')
      }
    }

    const removed = await deleteRecipeTag(
      {
        spaceId: 'space-1',
        tagId: 'tag-1'
      },
      context,
      repository
    )

    expect(removed).toEqual({
      tagId: 'tag-1',
      deleted: true
    })
  })

  it('keeps blank recommendationScore unset on create and update', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }

    const created = await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Blank Score Recipe',
          recommendationScore: ''
        }
      },
      context,
      repository
    )
    expect(created.item.recommendationScore).toBe('')

    const updated = await updateRecipe(
      {
        spaceId: 'space-1',
        recipeId: created.item._id,
        recipe: {
          name: 'Blank Score Recipe Updated',
          recommendationScore: '   '
        }
      },
      context,
      repository
    )
    expect(updated.item.recommendationScore).toBe('')
  })

  it('rejects create with stale/unconfirmed/foreign image refs', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    repository.__seedRecipeImage({
      _id: 'img-unconfirmed',
      spaceId: 'space-1',
      recipeId: '',
      uploadStatus: 'prepared',
      deletedAt: '',
      fileId: 'cloud://img-unconfirmed'
    })
    repository.__seedRecipeImage({
      _id: 'img-foreign',
      spaceId: 'space-2',
      recipeId: '',
      uploadStatus: 'confirmed',
      deletedAt: '',
      fileId: 'cloud://img-foreign'
    })
    repository.__seedRecipeImage({
      _id: 'img-deleted',
      spaceId: 'space-1',
      recipeId: '',
      uploadStatus: 'confirmed',
      deletedAt: '2026-04-10T00:00:00.000Z',
      fileId: 'cloud://img-deleted'
    })

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: 'Bad Image Ref Recipe',
            images: [{ _id: 'img-unconfirmed' }]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: 'Bad Deleted Image Ref Recipe',
            images: [{ _id: 'img-deleted' }]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: 'Bad Missing Image Ref Recipe',
            images: [{ _id: 'img-missing' }, { _id: 'img-foreign' }]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('persists canonical image metadata from repository records', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    repository.__seedRecipeImage({
      _id: 'img-1',
      spaceId: 'space-1',
      recipeId: '',
      stepId: '',
      imageRole: 'cover',
      cloudPath: 'spaces/space-1/recipes/draft/images/cover/img-1.jpg',
      fileId: 'cloud://real-file-1',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      sortOrder: 1,
      uploadStatus: 'confirmed',
      deletedAt: ''
    })

    const created = await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Canonical Image Recipe',
          images: [
            {
              _id: 'img-1',
              fileId: 'cloud://tampered',
              cloudPath: 'tampered-path',
              uploadStatus: 'confirmed'
            }
          ]
        }
      },
      context,
      repository
    )

    expect(created.item.images).toEqual([
      expect.objectContaining({
        _id: 'img-1',
        fileId: 'cloud://real-file-1',
        cloudPath: 'spaces/space-1/recipes/draft/images/cover/img-1.jpg',
        uploadStatus: 'confirmed'
      })
    ])
  })

  it('deleting recipe also cleans up related recipe images and cloud files', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Recipe With Image'
        }
      },
      context,
      repository
    )
    repository.__seedRecipeImage({
      _id: 'img-2',
      spaceId: 'space-1',
      recipeId: 'recipe-1',
      fileId: 'cloud://real-file-2',
      uploadStatus: 'confirmed',
      deletedAt: ''
    })

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
    expect(repository.__getDeletedCloudFiles()).toEqual(['cloud://real-file-2'])
    expect(repository.__getRecipeImage('img-2')).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(String)
      })
    )
  })

  it('rejects same-space confirmed image that is already bound to another recipe', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    repository.__seedRecipeImage({
      _id: 'img-bound',
      spaceId: 'space-1',
      recipeId: 'recipe-other',
      uploadStatus: 'confirmed',
      deletedAt: '',
      fileId: 'cloud://img-bound'
    })

    await expect(
      createRecipe(
        {
          spaceId: 'space-1',
          recipe: {
            name: 'Should Reject Bound Image',
            images: [{ _id: 'img-bound' }]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })

    await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Recipe For Update'
        }
      },
      context,
      repository
    )

    await expect(
      updateRecipe(
        {
          spaceId: 'space-1',
          recipeId: 'recipe-1',
          recipe: {
            name: 'Update Should Reject Bound Image',
            images: [{ _id: 'img-bound' }]
          }
        },
        context,
        repository
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT
    })
  })

  it('delete marks recipe/images deleted before cloud-file cleanup and keeps state consistent on cleanup failure', async () => {
    const repository = createRepository()
    const context = { openid: 'user-1' }
    await createRecipe(
      {
        spaceId: 'space-1',
        recipe: {
          name: 'Recipe Delete Failure Path'
        }
      },
      context,
      repository
    )
    repository.__seedRecipeImage({
      _id: 'img-fail',
      spaceId: 'space-1',
      recipeId: 'recipe-1',
      uploadStatus: 'confirmed',
      deletedAt: '',
      fileId: 'cloud://img-fail'
    })
    repository.deleteCloudFiles = async () => {
      throw new Error('cloud delete failed')
    }

    await expect(
      deleteRecipe(
        {
          spaceId: 'space-1',
          recipeId: 'recipe-1'
        },
        context,
        repository
      )
    ).rejects.toThrow('cloud delete failed')

    const recipeAfterDelete = await repository.getRecipe('space-1', 'recipe-1')
    expect(recipeAfterDelete).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(String)
      })
    )
    expect(repository.__getRecipeImage('img-fail')).toEqual(
      expect.objectContaining({
        deletedAt: expect.any(String)
      })
    )
  })
})
