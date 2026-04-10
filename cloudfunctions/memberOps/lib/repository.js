const { COLLECTIONS } = require('../shared/constants/collections')

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
    const addResult = await db.collection(COLLECTIONS.SPACES).add({
      data: {
        name,
        inviteCode,
        ownerOpenid
      }
    })

    const spaceId = addResult._id
    try {
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
        await db.collection(COLLECTIONS.SPACES).doc(spaceId).remove()
      } catch (_rollbackError) {
      }
      throw error
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
    const updateResult = await db.collection(COLLECTIONS.SPACES).doc(spaceId).update({
      data: {
        inviteCode
      }
    })

    if (!updateResult.stats || updateResult.stats.updated <= 0) {
      return null
    }

    const getResult = await db.collection(COLLECTIONS.SPACES).doc(spaceId).get()
    return getResult.data || null
  }

  return {
    listMemberships,
    createSpace,
    findSpaceByInviteCode,
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
