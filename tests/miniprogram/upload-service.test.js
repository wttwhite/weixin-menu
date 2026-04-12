import { describe, expect, it, vi } from 'vitest'
import { createUploadService } from '../../miniprogram/services/upload'

describe('upload service', () => {
  it('calls prepare -> upload -> confirm in order', async () => {
    const callCloud = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            imageId: 'img-1',
            uploadSessionId: 'session-1',
            cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-1.jpg'
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            item: {
              _id: 'img-1',
              uploadStatus: 'confirmed',
              fileId: 'cloud://image-1'
            }
          }
        }
      })
    const uploadFile = vi.fn().mockResolvedValue({
      fileID: 'cloud://image-1',
      statusCode: 200
    })

    const service = createUploadService({
      callCloud,
      uploadFile
    })
    const result = await service.uploadRecipeImage({
      spaceId: 'space-1',
      recipeId: 'recipe-1',
      imageRole: 'cover',
      filePath: '/tmp/cover.jpg',
      fileName: 'cover.jpg'
    })

    expect(callCloud).toHaveBeenNthCalledWith(1, 'fileOps', {
      action: 'prepareRecipeImageUpload',
      spaceId: 'space-1',
      recipeId: 'recipe-1',
      imageRole: 'cover',
      fileName: 'cover.jpg'
    })
    expect(uploadFile).toHaveBeenCalledWith({
      cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-1.jpg',
      filePath: '/tmp/cover.jpg'
    })
    expect(callCloud).toHaveBeenNthCalledWith(2, 'fileOps', {
      action: 'confirmRecipeImageUpload',
      spaceId: 'space-1',
      imageId: 'img-1',
      uploadSessionId: 'session-1',
      fileId: 'cloud://image-1',
      fileSize: 0,
      mimeType: ''
    })
    expect(result).toEqual(
      expect.objectContaining({
        _id: 'img-1',
        uploadStatus: 'confirmed',
        fileId: 'cloud://image-1'
      })
    )
  })

  it('surfaces clear error when upload fails', async () => {
    const callCloud = vi.fn().mockResolvedValue({
      result: {
        code: 0,
        data: {
          imageId: 'img-2',
          uploadSessionId: 'session-2',
          cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-2.jpg'
        }
      }
    })
    const uploadFile = vi.fn().mockRejectedValue(new Error('upload failed'))

    const service = createUploadService({
      callCloud,
      uploadFile
    })

    await expect(
      service.uploadRecipeImage({
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        imageRole: 'cover',
        filePath: '/tmp/cover.jpg',
        fileName: 'cover.jpg'
      })
    ).rejects.toThrow('图片上传失败，请重试')
  })

  it('surfaces clear error when confirm fails', async () => {
    const callCloud = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: {
            imageId: 'img-3',
            uploadSessionId: 'session-3',
            cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-3.jpg'
          }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 500,
          message: 'confirm failed'
        }
      })
    const uploadFile = vi.fn().mockResolvedValue({
      fileID: 'cloud://image-3',
      statusCode: 200
    })

    const service = createUploadService({
      callCloud,
      uploadFile
    })

    await expect(
      service.uploadRecipeImage({
        spaceId: 'space-1',
        recipeId: 'recipe-1',
        imageRole: 'cover',
        filePath: '/tmp/cover.jpg',
        fileName: 'cover.jpg'
      })
    ).rejects.toThrow('图片已上传但登记失败，请重试')
  })
})
