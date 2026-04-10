const { callCloud } = require('./cloud')
const { createStorage } = require('../utils/storage')
const MALFORMED_RESPONSE_MESSAGE = '云函数响应格式无效，请稍后重试'
const MALFORMED_BOOTSTRAP_MESSAGE = '空间数据格式无效，请稍后重试'

function getSpaceId(space) {
  if (!space) {
    return ''
  }

  return space.id || space.spaceId || space._id || ''
}

function normalizeSpace(space) {
  return {
    id: getSpaceId(space),
    name: space.name || '',
    role: space.role || '',
    status: space.status || ''
  }
}

function resolveActiveSpaceId(storedSpaceId, spaces) {
  const availableSpaces = Array.isArray(spaces) ? spaces : []
  if (availableSpaces.length === 0) {
    return ''
  }

  const preferredSpaceId = storedSpaceId || ''
  const matchedSpace = availableSpaces.find((space) => getSpaceId(space) === preferredSpaceId)
  return matchedSpace ? getSpaceId(matchedSpace) : getSpaceId(availableSpaces[0])
}

function unwrapResponse(response) {
  const result = response && response.result ? response.result : response
  if (!result || typeof result !== 'object' || typeof result.code !== 'number') {
    throw new Error(MALFORMED_RESPONSE_MESSAGE)
  }

  if (result.code !== 0) {
    const error = new Error(result.message || 'Request failed')
    error.code = result.code
    error.data = result.data || null
    throw error
  }

  if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new Error(MALFORMED_RESPONSE_MESSAGE)
  }

  return result.data
}

function setStoredActiveSpace(storage, activeSpaceId) {
  if (activeSpaceId) {
    storage.setActiveSpaceId(activeSpaceId)
    return activeSpaceId
  }

  if (typeof storage.clearActiveSpaceId === 'function') {
    storage.clearActiveSpaceId()
  } else {
    storage.setActiveSpaceId('')
  }
  return ''
}

function createSessionService(dependencies = {}) {
  const cloudCall = dependencies.callCloud || callCloud
  const defaultStorage = createStorage()
  const storage =
    dependencies.storage ||
    {
      getActiveSpaceId:
        dependencies.getActiveSpaceId ||
        defaultStorage.getActiveSpaceId,
      setActiveSpaceId:
        dependencies.setActiveSpaceId ||
        defaultStorage.setActiveSpaceId,
      clearActiveSpaceId:
        dependencies.clearActiveSpaceId ||
        defaultStorage.clearActiveSpaceId
    }

  return {
    async bootstrap() {
      const storedSpaceId = storage.getActiveSpaceId() || ''
      const data = unwrapResponse(
        await cloudCall('memberOps', {
          action: 'bootstrap',
          preferredSpaceId: storedSpaceId
        })
      )
      if (!Array.isArray(data.spaces)) {
        throw new Error(MALFORMED_BOOTSTRAP_MESSAGE)
      }

      const spaces = (data.spaces || []).map(normalizeSpace)
      const activeSpaceId = resolveActiveSpaceId(data.activeSpaceId || storedSpaceId, spaces)

      return {
        spaces,
        role: data.role || '',
        activeSpaceId: setStoredActiveSpace(storage, activeSpaceId)
      }
    },

    async createSpace(name) {
      const data = unwrapResponse(
        await cloudCall('memberOps', {
          action: 'createSpace',
          name
        })
      )
      const activeSpaceId = data.activeSpaceId || data.spaceId || ''
      return {
        ...data,
        activeSpaceId: setStoredActiveSpace(storage, activeSpaceId)
      }
    },

    async joinSpace(inviteCode) {
      const data = unwrapResponse(
        await cloudCall('memberOps', {
          action: 'joinSpace',
          inviteCode
        })
      )
      const activeSpaceId = data.activeSpaceId || data.spaceId || ''
      return {
        ...data,
        activeSpaceId: setStoredActiveSpace(storage, activeSpaceId)
      }
    },

    async switchSpace(spaceId) {
      return {
        activeSpaceId: setStoredActiveSpace(storage, spaceId || '')
      }
    },

    async listMembers(spaceId) {
      const data = unwrapResponse(
        await cloudCall('memberOps', {
          action: 'listMembers',
          spaceId
        })
      )

      return {
        ...data,
        members: Array.isArray(data.members) ? data.members : []
      }
    }
  }
}

async function bootstrap(dependencies = {}) {
  return createSessionService(dependencies).bootstrap()
}

async function createSpace(name, dependencies = {}) {
  return createSessionService(dependencies).createSpace(name)
}

async function joinSpace(inviteCode, dependencies = {}) {
  return createSessionService(dependencies).joinSpace(inviteCode)
}

async function switchSpace(spaceId, dependencies = {}) {
  return createSessionService(dependencies).switchSpace(spaceId)
}

async function listMembers(spaceId, dependencies = {}) {
  return createSessionService(dependencies).listMembers(spaceId)
}

module.exports = {
  bootstrap,
  createSessionService,
  createSpace,
  joinSpace,
  switchSpace,
  listMembers,
  resolveActiveSpaceId
}
