import { describe, expect, it, vi } from 'vitest'
import {
  confirmRecipeImageUpload,
  deleteRecipeImage,
  discardRecipeImage,
  prepareRecipeImageUpload
} from '../../cloudfunctions/fileOps/services/recipe-image-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const images = new Map()

  return {
    async createRecipeImage(data) {
      const imageId = data._id
      images.set(imageId, { ...data })
      return { ...images.get(imageId) }
    },
    async getRecipeImage(spaceId, imageId) {
      const item = images.get(imageId)
      if (!item || item.spaceId !== spaceId) {
        return null
      }
      return { ...item }
    },
    async updateRecipeImage(spaceId, imageId, patch) {
      const existing = images.get(imageId)
      if (!existing || existing.spaceId !== spaceId) {
        return null
      }
      images.set(imageId, {
        ...existing,
        ...patch
      })
      return { ...images.get(imageId) }
    }
  }
}

describe('recipe-image-service', () => {
  it('prepareRecipeImageUpload returns image id, upload session id, and scoped cloud path', async () => {
    const repository = createRepository()
    const result = await prepareRecipeImageUpload(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        imageRole: 'cover',
        fileName: 'cover.jpg'
      },
      { openid: 'user-1' },
      repository,
      {
        randomId: vi
          .fn()
          .mockReturnValueOnce('img-1')
          .mockReturnValueOnce('session-1'),
        nowIso: () => '2026-04-12T00:00:00.000Z'
      }
    )

    expect(result.imageId).toBe('img-1')
    expect(result.uploadSessionId).toBe('session-1')
    expect(result.cloudPath).toContain('spaces/space-1/recipes/recipe-1/images/cover/')
    expect(result.cloudPath.endsWith('.jpg')).toBe(true)
  })

  it('confirmRecipeImageUpload marks prepared image as confirmed', async () => {
    const repository = createRepository()
    await prepareRecipeImageUpload(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        imageRole: 'step',
        fileName: 's1.png'
      },
      { openid: 'user-1' },
      repository,
      {
        randomId: vi
          .fn()
          .mockReturnValueOnce('img-2')
          .mockReturnValueOnce('session-2'),
        nowIso: () => '2026-04-12T00:00:00.000Z'
      }
    )

    const confirmed = await confirmRecipeImageUpload(
      {
        spaceId: 'space-1',
        imageId: 'img-2',
        uploadSessionId: 'session-2',
        fileId: 'cloud://recipe-image-2',
        fileSize: 2048,
        mimeType: 'image/png'
      },
      { openid: 'user-1' },
      repository,
      {
        nowIso: () => '2026-04-12T00:01:00.000Z'
      }
    )

    expect(confirmed.item).toEqual(
      expect.objectContaining({
        _id: 'img-2',
        uploadStatus: 'confirmed',
        fileId: 'cloud://recipe-image-2',
        fileSize: 2048,
        mimeType: 'image/png'
      })
    )
  })

  it('discardRecipeImage removes uploaded file and marks image as discarded', async () => {
    const repository = createRepository()
    await prepareRecipeImageUpload(
      {
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        imageRole: 'cover',
        fileName: 'cover.jpg'
      },
      { openid: 'user-1' },
      repository,
      {
        randomId: vi
          .fn()
          .mockReturnValueOnce('img-3')
          .mockReturnValueOnce('session-3'),
        nowIso: () => '2026-04-12T00:00:00.000Z'
      }
    )
    await confirmRecipeImageUpload(
      {
        spaceId: 'space-1',
        imageId: 'img-3',
        uploadSessionId: 'session-3',
        fileId: 'cloud://recipe-image-3',
        fileSize: 1024,
        mimeType: 'image/jpeg'
      },
      { openid: 'user-1' },
      repository,
      {
        nowIso: () => '2026-04-12T00:01:00.000Z'
      }
    )
    const storageService = {
      deleteFile: vi.fn().mockResolvedValue(undefined)
    }

    const result = await discardRecipeImage(
      {
        spaceId: 'space-1',
        imageId: 'img-3'
      },
      { openid: 'user-1' },
      repository,
      storageService,
      {
        nowIso: () => '2026-04-12T00:02:00.000Z'
      }
    )

    expect(storageService.deleteFile).toHaveBeenCalledWith('cloud://recipe-image-3')
    expect(result).toEqual({
      imageId: 'img-3',
      discarded: true
    })
  })

  it('deleteRecipeImage fails when image does not exist', async () => {
    const repository = createRepository()

    await expect(
      deleteRecipeImage(
        {
          spaceId: 'space-1',
          imageId: 'missing-image'
        },
        { openid: 'user-1' },
        repository,
        {
          deleteFile: vi.fn()
        },
        {
          nowIso: () => '2026-04-12T00:02:00.000Z'
        }
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND
    })
  })
})
