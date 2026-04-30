const { createBackupService } = require('../../services/backup')
const { createMembersService } = require('../../services/members')
const { getActiveSpaceId } = require('../../utils/app-session')
const { getErrorMessage } = require('../../utils/error')
const { syncPageTheme } = require('../../utils/theme')

const IMPORT_REFRESH_ROUTES = new Set([
  'pages/recipes/index',
  'pages/pantry/index',
  'pages/meal-plans/index',
  'pages/shopping/index'
])

function markDataPagesForRefreshAfterImport() {
  if (typeof getCurrentPages !== 'function') {
    return
  }

  const pages = getCurrentPages() || []
  pages.forEach((page) => {
    if (
      page &&
      IMPORT_REFRESH_ROUTES.has(page.route) &&
      typeof page.markNeedsRefreshOnNextShow === 'function'
    ) {
      page.markNeedsRefreshOnNextShow()
    }
  })
}

function formatBackupTime(value = '') {
  if (typeof value !== 'string') {
    return ''
  }

  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) {
    return normalized.slice(0, 19).replace('T', ' ')
  }

  const beijingTime = new Date(parsed.getTime() + 8 * 60 * 60 * 1000)
  const pad = (number) => String(number).padStart(2, '0')
  return [
    beijingTime.getUTCFullYear(),
    pad(beijingTime.getUTCMonth() + 1),
    pad(beijingTime.getUTCDate())
  ].join('-') + ' ' + [
    pad(beijingTime.getUTCHours()),
    pad(beijingTime.getUTCMinutes()),
    pad(beijingTime.getUTCSeconds())
  ].join(':')
}

function decorateBackupRecord(record = {}) {
  const timeText = formatBackupTime(record.updatedAt || record.createdAt || '')
  return {
    ...record,
    timeText
  }
}

Page({
  data: {
    loading: true,
    themeKey: 'default',
    themeStyle: '',
    activeSpaceId: '',
    records: [],
    importing: false,
    exporting: false,
    errorMessage: '',
    role: ''
  },

  onShow() {
    syncPageTheme(this)
    this.loadRecords()
  },

  async loadRecords() {
    const activeSpaceId = getActiveSpaceId()
    this.setData({
      loading: true,
      errorMessage: '',
      activeSpaceId
    })

    if (!activeSpaceId) {
      this.setData({
        loading: false,
        records: []
      })
      return
    }

    try {
      const [result, session] = await Promise.all([
        createBackupService().listBackupRecords(activeSpaceId),
        createMembersService().bootstrapSession(activeSpaceId)
      ])
      this.setData({
        loading: false,
        records: (result.items || []).map((item) => decorateBackupRecord(item)),
        role: session.role || ''
      })
    } catch (error) {
      this.setData({
        loading: false,
        records: [],
        errorMessage: getErrorMessage(error),
        role: ''
      })
    }
  },

  async handleExport() {
    if (this.data.exporting || !this.data.activeSpaceId) {
      return
    }
    this.setData({ exporting: true })
    try {
      const result = await createBackupService().exportSpaceBackup(this.data.activeSpaceId)
      await this.loadRecords()
      if (result.fileId && wx.cloud && typeof wx.cloud.getTempFileURL === 'function') {
        const tempResult = await wx.cloud.getTempFileURL({
          fileList: [result.fileId]
        })
        const tempUrl = tempResult.fileList && tempResult.fileList[0] && tempResult.fileList[0].tempFileURL
        if (tempUrl && wx.setClipboardData) {
          await wx.setClipboardData({
            data: tempUrl
          })
        }
      }
      wx.showToast({
        title: result.fileName || '导出完成',
        icon: 'none'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({ exporting: false })
    }
  },

  async handleImport() {
    if (this.data.importing || !this.data.activeSpaceId || this.data.role !== 'owner') {
      return
    }

    const modal = await wx.showModal({
      title: '导入备份',
      content: '导入会覆盖当前空间数据，确认继续？',
      confirmColor: '#b44343'
    })
    if (!modal.confirm) {
      return
    }

    this.setData({ importing: true })
    try {
      const chooser = await wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['zip']
      })
      const file = chooser.tempFiles && chooser.tempFiles[0]
      if (!file || !file.path) {
        return
      }
      const upload = await wx.cloud.uploadFile({
        cloudPath: `spaces/${this.data.activeSpaceId}/backup/tmp/${Date.now()}-${file.name || 'import'}.zip`,
        filePath: file.path
      })
      await createBackupService().importSpaceBackup(this.data.activeSpaceId, upload.fileID)
      markDataPagesForRefreshAfterImport()
      await this.loadRecords()
      wx.showToast({
        title: '导入完成',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    } finally {
      this.setData({ importing: false })
    }
  },

  async handleCopyRecordUrl(event) {
    const fileId = event.currentTarget.dataset.fileId
    if (!fileId || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
      return
    }

    try {
      const result = await wx.cloud.getTempFileURL({
        fileList: [fileId]
      })
      const tempUrl = result.fileList && result.fileList[0] && result.fileList[0].tempFileURL
      if (!tempUrl || !wx.setClipboardData) {
        return
      }
      await wx.setClipboardData({
        data: tempUrl
      })
      wx.showToast({
        title: '下载链接已复制',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({
        title: getErrorMessage(error),
        icon: 'none'
      })
    }
  }
})
