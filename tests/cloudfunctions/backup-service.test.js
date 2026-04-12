import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import {
  exportSpaceBackup,
  importSpaceBackup,
  listBackupRecords
} from '../../cloudfunctions/fileOps/services/backup-service'
import { ERROR_CODES } from '../../shared/constants/error-codes'

function createRepository() {
  const backupRecords = []
  const imported = {
    recipes: [],
    recipeTags: [],
    recipeImages: [],
    pantryItems: [],
    mealPlans: [],
    shoppingLists: [],
    shoppingItems: []
  }

  return {
    async listRecipes() {
      return [
        {
          _id: 'recipe-1',
          spaceId: 'space-1',
          name: 'Tomato Egg'
        }
      ]
    },
    async listRecipeTags() {
      return [{ _id: 'tag-1', spaceId: 'space-1', name: '家常' }]
    },
    async listRecipeImages() {
      return [
        {
          _id: 'img-1',
          spaceId: 'space-1',
          recipeId: 'recipe-1',
          fileId: 'cloud://img-1',
          cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-1.jpg',
          uploadStatus: 'confirmed'
        }
      ]
    },
    async listPantryItems() {
      return [{ _id: 'pantry-1', spaceId: 'space-1', name: 'Egg' }]
    },
    async listMealPlans() {
      return [{ _id: 'meal-1', spaceId: 'space-1', planDate: '2026-04-12', recipes: [] }]
    },
    async listShoppingLists() {
      return [{ _id: 'list-1', spaceId: 'space-1', title: 'Weekend' }]
    },
    async listShoppingItems() {
      return [{ _id: 'item-1', shoppingListId: 'list-1', name: 'Egg', deletedAt: '' }]
    },
    async createBackupRecord(data) {
      const item = { _id: `backup-${backupRecords.length + 1}`, ...data }
      backupRecords.push(item)
      return item
    },
    async listBackupRecords(spaceId) {
      return backupRecords.filter((item) => item.spaceId === spaceId).map((item) => ({ ...item }))
    },
    async replaceSpaceData(spaceId, payload) {
      imported.recipes = (payload.recipes || []).map((item) => ({ ...item, spaceId }))
      imported.recipeTags = (payload.recipeTags || []).map((item) => ({ ...item, spaceId }))
      imported.recipeImages = (payload.recipeImages || []).map((item) => ({ ...item, spaceId }))
      imported.pantryItems = (payload.pantryItems || []).map((item) => ({ ...item, spaceId }))
      imported.mealPlans = (payload.mealPlans || []).map((item) => ({ ...item, spaceId }))
      imported.shoppingLists = (payload.shoppingLists || []).map((item) => ({ ...item, spaceId }))
      imported.shoppingItems = (payload.shoppingItems || []).map((item) => ({ ...item, spaceId }))
      return imported
    },
    getImported() {
      return imported
    }
  }
}

function createStorageService() {
  const uploadedFiles = []
  const deletedFiles = []
  const downloadMap = new Map()
  return {
    async downloadFile(fileId) {
      if (downloadMap.has(fileId)) {
        return Buffer.from(downloadMap.get(fileId))
      }
      if (fileId === 'cloud://img-1') {
        return Buffer.from('image-bytes')
      }
      throw new Error('file not found')
    },
    async uploadBuffer({ cloudPath, buffer }) {
      const fileId = `cloud://uploaded/${uploadedFiles.length + 1}`
      uploadedFiles.push({ fileId, cloudPath, buffer: Buffer.from(buffer) })
      return {
        fileId,
        cloudPath
      }
    },
    async deleteFile(fileId) {
      deletedFiles.push(fileId)
    },
    getUploadedFiles() {
      return uploadedFiles
    },
    getDeletedFiles() {
      return deletedFiles
    },
    setDownloadedFile(fileId, buffer) {
      downloadMap.set(fileId, Buffer.from(buffer))
    }
  }
}

describe('backup service', () => {
  it('exports a zip with backup.json and uploaded image files', async () => {
    const repository = createRepository()
    const storageService = createStorageService()

    const result = await exportSpaceBackup(
      { spaceId: 'space-1' },
      { openid: 'user-1' },
      repository,
      storageService,
      {
        nowIso: () => '2026-04-12T10:00:00.000Z'
      }
    )

    expect(result.fileId).toBe('cloud://uploaded/1')
    expect(result.fileName.endsWith('.zip')).toBe(true)
    const uploaded = storageService.getUploadedFiles()[0]
    const zip = await JSZip.loadAsync(uploaded.buffer)
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(['backup.json', 'files/recipe-images/img-1.jpg'])
    )
    const backupPayload = JSON.parse(await zip.file('backup.json').async('string'))
    expect(backupPayload.recipes).toHaveLength(1)
    expect(backupPayload.recipeTags).toHaveLength(1)
    expect(backupPayload.recipeImages).toHaveLength(1)
  })

  it('maps export file-read failures to BACKUP_EXPORT_FAILED', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    storageService.downloadFile = async () => {
      throw new Error('download failed')
    }

    await expect(
      exportSpaceBackup(
        { spaceId: 'space-1' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_EXPORT_FAILED
    })
  })

  it('deletes uploaded backup blob when export record creation fails', async () => {
    const repository = createRepository()
    repository.createBackupRecord = async () => {
      throw new Error('record failed')
    }
    const storageService = createStorageService()

    await expect(
      exportSpaceBackup(
        { spaceId: 'space-1' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_EXPORT_FAILED
    })

    expect(storageService.getDeletedFiles()).toContain('cloud://uploaded/1')
  })

  it('maps payload read failures to BACKUP_EXPORT_FAILED', async () => {
    const repository = createRepository()
    repository.listRecipes = async () => {
      throw new Error('db read failed')
    }

    await expect(
      exportSpaceBackup(
        { spaceId: 'space-1' },
        { openid: 'user-1' },
        repository,
        createStorageService()
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_EXPORT_FAILED
    })
  })

  it('rejects import when backup.json is missing from the zip', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file('files/recipe-images/img-1.jpg', 'bytes')
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/missing-backup', buffer)

    await expect(
      importSpaceBackup(
        { spaceId: 'space-1', tempFileId: 'cloud://temp/missing-backup' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_IMPORT_INVALID
    })
  })

  it('rejects invalid zip content with backup-specific invalid code', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    storageService.setDownloadedFile('cloud://temp/invalid-zip', Buffer.from('not-a-zip'))

    await expect(
      importSpaceBackup(
        { spaceId: 'space-1', tempFileId: 'cloud://temp/invalid-zip' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_IMPORT_INVALID
    })
  })

  it('imports a backup payload and restores space-scoped data', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file(
      'backup.json',
      JSON.stringify({
        version: '1.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [{ _id: 'recipe-1', coverImageId: 'img-1', images: [{ _id: 'img-1' }] }],
        recipeTags: [{ _id: 'tag-1', name: '家常' }],
        recipeImages: [
          {
            _id: 'img-1',
            recipeId: 'recipe-1',
            cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-1.jpg',
            uploadStatus: 'confirmed'
          }
        ],
        pantryItems: [{ _id: 'pantry-1' }],
        mealPlans: [{ _id: 'meal-1' }],
        shoppingLists: [{ _id: 'list-1' }],
        shoppingItems: [{ _id: 'item-1' }],
        settings: {}
      })
    )
    zip.file('files/recipe-images/img-1.jpg', 'image-bytes')
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/valid-backup', buffer)

    const result = await importSpaceBackup(
      { spaceId: 'space-1', tempFileId: 'cloud://temp/valid-backup' },
      { openid: 'user-1' },
      repository,
      storageService,
      {
        nowIso: () => '2026-04-12T11:00:00.000Z'
      }
    )

    expect(result.summary).toEqual({
      recipes: 1,
      recipeTags: 1,
      recipeImages: 1,
      pantryItems: 1,
      mealPlans: 1,
      shoppingLists: 1,
      shoppingItems: 1
    })
    expect(repository.getImported().recipes).toHaveLength(1)
    expect(repository.getImported().recipes[0].coverImageId).toBe(repository.getImported().recipeImages[0]._id)
  })

  it('does not fail import when writing the import backup record fails after restore', async () => {
    const repository = createRepository()
    repository.createBackupRecord = async () => {
      throw new Error('record write failed')
    }
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file(
      'backup.json',
      JSON.stringify({
        version: '1.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [],
        recipeTags: [],
        recipeImages: [],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    )
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/no-record', buffer)

    await expect(
      importSpaceBackup(
        { spaceId: 'space-1', tempFileId: 'cloud://temp/no-record' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).resolves.toEqual({
      summary: {
        recipes: 0,
        recipeTags: 0,
        recipeImages: 0,
        pantryItems: 0,
        mealPlans: 0,
        shoppingLists: 0,
        shoppingItems: 0
      }
    })
  })

  it('cleans up already uploaded target-space files when import fails before restore completes', async () => {
    const repository = createRepository()
    repository.replaceSpaceData = async () => {
      throw new Error('replace failed')
    }
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file(
      'backup.json',
      JSON.stringify({
        version: '1.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [{ _id: 'recipe-1', images: [{ _id: 'img-1' }] }],
        recipeTags: [],
        recipeImages: [
          {
            _id: 'img-1',
            recipeId: 'recipe-1',
            cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-1.jpg',
            uploadStatus: 'confirmed'
          }
        ],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    )
    zip.file('files/recipe-images/img-1.jpg', 'image-bytes')
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/cleanup-fail', buffer)

    await expect(
      importSpaceBackup(
        { spaceId: 'space-1', tempFileId: 'cloud://temp/cleanup-fail' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_RESTORE_FAILED
    })

    expect(storageService.getDeletedFiles()).toEqual(
      expect.arrayContaining(['cloud://uploaded/1', 'cloud://temp/cleanup-fail'])
    )
  })

  it('rejects import when a referenced recipe image file is missing', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file(
      'backup.json',
      JSON.stringify({
        version: '1.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [{ _id: 'recipe-1' }],
        recipeTags: [],
        recipeImages: [
          {
            _id: 'img-1',
            recipeId: 'recipe-1',
            cloudPath: 'spaces/space-1/recipes/recipe-1/images/cover/img-1.jpg',
            uploadStatus: 'confirmed'
          }
        ],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    )
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/missing-image', buffer)

    await expect(
      importSpaceBackup(
        { spaceId: 'space-1', tempFileId: 'cloud://temp/missing-image' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_FILE_MISSING
    })
  })

  it('uploads imported image files into the target space path instead of the source space path', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file(
      'backup.json',
      JSON.stringify({
        version: '1.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [{ _id: 'recipe-1', images: [{ _id: 'img-1' }] }],
        recipeTags: [],
        recipeImages: [
          {
            _id: 'img-1',
            recipeId: 'recipe-1',
            cloudPath: 'spaces/source-space/recipes/recipe-1/images/cover/img-1.jpg',
            uploadStatus: 'confirmed'
          }
        ],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    )
    zip.file('files/recipe-images/img-1.jpg', 'image-bytes')
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/other-space', buffer)

    await importSpaceBackup(
      { spaceId: 'target-space', tempFileId: 'cloud://temp/other-space' },
      { openid: 'user-1' },
      repository,
      storageService
    )

    expect(storageService.getUploadedFiles()[0].cloudPath).toContain('spaces/target-space/')
    expect(storageService.getUploadedFiles()[0].cloudPath).not.toContain('spaces/source-space/')
    expect(repository.getImported().recipes[0]._id).not.toBe('recipe-1')
    expect(repository.getImported().recipeImages[0].recipeId).toBe(repository.getImported().recipes[0]._id)
  })

  it('rejects unsupported backup versions with a specific code', async () => {
    const repository = createRepository()
    const storageService = createStorageService()
    const zip = new JSZip()
    zip.file(
      'backup.json',
      JSON.stringify({
        version: '2.0.0',
        exportTime: '2026-04-12T00:00:00.000Z',
        recipes: [],
        pantryItems: [],
        mealPlans: [],
        shoppingLists: [],
        shoppingItems: [],
        settings: {}
      })
    )
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    storageService.setDownloadedFile('cloud://temp/bad-version', buffer)

    await expect(
      importSpaceBackup(
        { spaceId: 'space-1', tempFileId: 'cloud://temp/bad-version' },
        { openid: 'user-1' },
        repository,
        storageService
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.BACKUP_VERSION_UNSUPPORTED
    })
  })

  it('lists backup records for a space', async () => {
    const repository = createRepository()
    await repository.createBackupRecord({
      spaceId: 'space-1',
      type: 'export',
      status: 'completed',
      createdAt: '2026-04-12T00:00:00.000Z'
    })
    await repository.createBackupRecord({
      spaceId: 'space-1',
      type: 'import',
      status: 'completed',
      createdAt: '2026-04-12T01:00:00.000Z'
    })

    const result = await listBackupRecords(
      { spaceId: 'space-1' },
      { openid: 'user-1' },
      repository
    )

    expect(result.items).toHaveLength(2)
    expect(result.items[0].createdAt >= result.items[1].createdAt).toBe(true)
  })
})
