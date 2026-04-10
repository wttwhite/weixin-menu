const { COLLECTIONS } = require('../shared/constants/collections')
const { ERROR_CODES } = require('../shared/constants/error-codes')

let hasInitialized = false

function getCloudSdk(cloudSdk) {
  return cloudSdk || require('wx-server-sdk')
}

function ensureCloudInit(cloudSdk) {
  if (hasInitialized) {
    return
  }

  cloudSdk.init({
    env: cloudSdk.DYNAMIC_CURRENT_ENV
  })
  hasInitialized = true
}

function firstRow(result) {
  if (!result || !Array.isArray(result.data) || result.data.length === 0) {
    return null
  }

  return result.data[0]
}

function createConflictError(message, reason) {
  const error = new Error(message)
  error.code = ERROR_CODES.CONFLICT
  error.data = reason ? { reason } : null
  return error
}

function isDuplicateKeyError(error) {
  if (!error) {
    return false
  }

  const errorCode = error.errCode || error.code
  if (errorCode === 'DUPLICATE_KEY' || errorCode === -502005) {
    return true
  }

  const message = String(error.message || '').toLowerCase()
  return message.includes('duplicate')
}

function createRepository(options = {}) {
  const cloudSdk = getCloudSdk(options.cloudSdk)
  ensureCloudInit(cloudSdk)
  const db = options.db || cloudSdk.database()
  const command = db.command

  async function listMemberships(openid) {
    const membershipResult = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        openid,
        status: 'active'
      })
      .get()

    const memberships = membershipResult.data || []
    if (memberships.length === 0) {
      return []
    }

    const spaceIds = memberships.map((item) => item.spaceId)
    const spacesResult = await db
      .collection(COLLECTIONS.SPACES)
      .where({
        _id: command.in(spaceIds)
      })
      .get()

    const nameBySpaceId = new Map()
    for (const space of spacesResult.data || []) {
      nameBySpaceId.set(space._id, space.name)
    }

    return memberships.map((item) => ({
      spaceId: item.spaceId,
      role: item.role,
      status: item.status,
      name: nameBySpaceId.get(item.spaceId) || ''
    }))
  }

  async function createSpace({ name, inviteCode, ownerOpenid }) {
    try {
      await db.collection(COLLECTIONS.INVITE_CODE_CLAIMS).add({
        data: {
          _id: inviteCode,
          spaceId: '',
          status: 'active'
        }
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw createConflictError('Invite code already in use', 'INVITE_CODE_TAKEN')
      }
      throw error
    }

    let spaceId = ''
    try {
      const addResult = await db.collection(COLLECTIONS.SPACES).add({
        data: {
          name,
          inviteCode,
          ownerOpenid
        }
      })

      spaceId = addResult._id
      await db.collection(COLLECTIONS.SPACE_MEMBERS).add({
        data: {
          spaceId,
          openid: ownerOpenid,
          role: 'owner',
          status: 'active'
        }
      })
    } catch (error) {
      try {
        if (spaceId) {
          await db.collection(COLLECTIONS.SPACES).doc(spaceId).remove()
        }
      } catch (_rollbackError) {
      }
      try {
        await db.collection(COLLECTIONS.INVITE_CODE_CLAIMS).doc(inviteCode).remove()
      } catch (_rollbackError) {
      }
      throw error
    }

    try {
      await db.collection(COLLECTIONS.INVITE_CODE_CLAIMS).doc(inviteCode).update({
        data: {
          spaceId
        }
      })
    } catch (_claimUpdateError) {
    }

    return {
      _id: spaceId,
      name,
      inviteCode,
      ownerOpenid
    }
  }

  async function findSpaceByInviteCode(inviteCode) {
    const result = await db
      .collection(COLLECTIONS.SPACES)
      .where({
        inviteCode
      })
      .get()

    return firstRow(result)
  }

  async function getSpaceById(spaceId) {
    const result = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get()
    return result.data || null
  }

  async function findMembership(spaceId, openid) {
    const result = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        spaceId,
        openid,
        status: 'active'
      })
      .get()

    return firstRow(result)
  }

  async function addOrActivateMembership({ spaceId, openid, role }) {
    const existingResult = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        spaceId,
        openid
      })
      .get()

    const existing = firstRow(existingResult)
    if (existing) {
      await db.collection(COLLECTIONS.SPACE_MEMBERS).doc(existing._id).update({
        data: {
          role,
          status: 'active'
        }
      })
      return {
        ...existing,
        role,
        status: 'active'
      }
    }

    await db.collection(COLLECTIONS.SPACE_MEMBERS).add({
      data: {
        spaceId,
        openid,
        role,
        status: 'active'
      }
    })

    return {
      spaceId,
      openid,
      role,
      status: 'active'
    }
  }

  async function listMembers(spaceId) {
    const result = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        spaceId,
        status: 'active'
      })
      .get()

    return result.data || []
  }

  async function removeMember(spaceId, openid) {
    const existingResult = await db
      .collection(COLLECTIONS.SPACE_MEMBERS)
      .where({
        spaceId,
        openid
      })
      .get()
    const existing = firstRow(existingResult)
    if (!existing) {
      return false
    }

    await db.collection(COLLECTIONS.SPACE_MEMBERS).doc(existing._id).update({
      data: {
        status: 'removed'
      }
    })

    return true
  }

  async function renameSpace(spaceId, name) {
    const updateResult = await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
      data: {
        name
      }
    })

    if (!updateResult.stats || updateResult.stats.updated <= 0) {
      return null
    }

    const getResult = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get()
    return getResult.data || null
  }

  async function rotateInviteCode(spaceId, inviteCode) {
    const currentSpace = await getSpaceById(spaceId)
    if (!currentSpace) {
      return null
    }

    if (currentSpace.inviteCode === inviteCode) {
      throw createConflictError('Invite code already in use', 'INVITE_CODE_TAKEN')
    }

    try {
      await db.collection(COLLECTIONS.INVITE_CODE_CLAIMS).add({
        data: {
          _id: inviteCode,
          spaceId,
          status: 'active'
        }
      })
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw createConflictError('Invite code already in use', 'INVITE_CODE_TAKEN')
      }
      throw error
    }

    try {
      const updateResult = await db.collection(COLLECTIONS.SPACES).where({
        _id: spaceId,
        inviteCode: currentSpace.inviteCode
      }).update({
        data: {
          inviteCode
        }
      })

      if (!updateResult.stats || updateResult.stats.updated <= 0) {
        throw createConflictError('Space changed during invite code rotation', 'SPACE_VERSION_CONFLICT')
      }

      if (currentSpace.inviteCode) {
        try {
          await db.collection(COLLECTIONS.INVITE_CODE_CLAIMS).doc(currentSpace.inviteCode).remove()
        } catch (_rollbackError) {
        }
      }

      const getResult = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get()
      return getResult.data || null
    } catch (error) {
      try {
        await db.collection(COLLECTIONS.INVITE_CODE_CLAIMS).doc(inviteCode).remove()
      } catch (_rollbackError) {
      }
      throw error
    }
  }

  return {
    listMemberships,
    createSpace,
    findSpaceByInviteCode,
    getSpaceById,
    findMembership,
    addOrActivateMembership,
    listMembers,
    removeMember,
    renameSpace,
    rotateInviteCode
  }
}

module.exports = {
  createRepository
}
