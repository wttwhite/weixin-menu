const { ERROR_CODES } = require('../shared/constants/error-codes')

const MESSAGE_BY_CODE = {
  [ERROR_CODES.SPACE_FORBIDDEN]: '你没有权限访问这个空间',
  [ERROR_CODES.UNAUTHORIZED]: '请重新进入小程序后再试',
  [ERROR_CODES.NOT_FOUND]: '没有找到对应的数据',
  [ERROR_CODES.CONFLICT]: '数据状态已变化，请刷新后重试',
  [ERROR_CODES.INVALID_INPUT]: '请检查输入内容后再试',
  [ERROR_CODES.BACKUP_EXPORT_FAILED]: '备份导出失败，请稍后重试',
  [ERROR_CODES.BACKUP_IMPORT_INVALID]: '备份文件格式无效，请检查后重试',
  [ERROR_CODES.BACKUP_VERSION_UNSUPPORTED]: '当前暂不支持该备份版本',
  [ERROR_CODES.BACKUP_FILE_MISSING]: '备份缺少必要图片文件，无法导入',
  [ERROR_CODES.BACKUP_RESTORE_FAILED]: '备份恢复失败，请稍后重试'
}

const MESSAGE_BY_TEXT = {
  SPACE_FORBIDDEN: '你没有权限访问这个空间',
  'Unsupported action': '云函数未更新，请重新部署 api 云函数',
  'Invite code is required': '请输入空间邀请码',
  'Space name is required': '请输入空间名称',
  'Space not found': '未找到对应空间',
  'Missing current user': '当前登录状态已失效，请重新进入小程序'
}

const MISSING_COLLECTION_PATTERN = /(db|database|table).*(not exist|does not exist)|collection.*not exist/i

function normalizeError(error) {
  if (error && error.result) {
    return error.result
  }

  return error || {}
}

function isMissingCollectionError(error) {
  const normalized = normalizeError(error)
  const candidates = [normalized.message, normalized.errMsg]
  return candidates.some((value) => typeof value === 'string' && MISSING_COLLECTION_PATTERN.test(value))
}

function getErrorMessage(error, fallbackMessage = '暂时无法完成操作，请稍后再试') {
  const normalized = normalizeError(error)
  if (isMissingCollectionError(normalized)) {
    return '云数据库缺少必要集合，可点击下方按钮自动初始化'
  }

  if (normalized.message && MESSAGE_BY_TEXT[normalized.message]) {
    return MESSAGE_BY_TEXT[normalized.message]
  }

  if (typeof normalized.code === 'number' && MESSAGE_BY_CODE[normalized.code]) {
    return MESSAGE_BY_CODE[normalized.code]
  }

  if (typeof normalized.errMsg === 'string' && normalized.errMsg) {
    return normalized.errMsg
  }

  if (typeof normalized.message === 'string' && normalized.message) {
    return normalized.message
  }

  return fallbackMessage
}

module.exports = {
  getErrorMessage,
  isMissingCollectionError
}
