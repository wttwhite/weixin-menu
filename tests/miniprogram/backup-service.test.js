import { describe, expect, it, vi } from 'vitest'
import { createBackupService } from '../../miniprogram/services/backup'

describe('createBackupService', () => {
  it('calls fileOps export/import/list actions', async () => {
    const callCloud = vi
      .fn()
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { fileId: 'cloud://backup-1', fileName: 'space-backup.zip' }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { summary: { recipes: 1 } }
        }
      })
      .mockResolvedValueOnce({
        result: {
          code: 0,
          data: { items: [{ _id: 'backup-1' }] }
        }
      })

    const service = createBackupService({ callCloud })
    await service.exportSpaceBackup('space-1')
    await service.importSpaceBackup('space-1', 'cloud://temp-backup')
    await service.listBackupRecords('space-1')

    expect(callCloud).toHaveBeenNthCalledWith(1, 'fileOps', {
      action: 'exportSpaceBackup',
      spaceId: 'space-1'
    })
    expect(callCloud).toHaveBeenNthCalledWith(2, 'fileOps', {
      action: 'importSpaceBackup',
      spaceId: 'space-1',
      tempFileId: 'cloud://temp-backup'
    })
    expect(callCloud).toHaveBeenNthCalledWith(3, 'fileOps', {
      action: 'listBackupRecords',
      spaceId: 'space-1'
    })
  })
})
