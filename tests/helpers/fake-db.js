import { ROLES } from '../../shared/constants/roles'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function createFakeDb(seed = {}) {
  const spaces = new Map()
  const memberships = []
  let nextSpaceId = 1

  for (const space of seed.spaces || []) {
    spaces.set(space._id, clone(space))
  }

  for (const membership of seed.memberships || []) {
    memberships.push(clone(membership))
  }

  function listMemberships(openid) {
    return memberships
      .filter((item) => item.openid === openid && item.status === 'active')
      .map((item) => {
        const space = spaces.get(item.spaceId)
        return {
          spaceId: item.spaceId,
          role: item.role,
          status: item.status,
          name: space ? space.name : ''
        }
      })
  }

  function findMembership(spaceId, openid) {
    return memberships.find(
      (item) => item.spaceId === spaceId && item.openid === openid && item.status === 'active'
    )
  }

  function createSpace({ name, inviteCode, ownerOpenid }) {
    const spaceId = `space-${nextSpaceId++}`
    spaces.set(spaceId, {
      _id: spaceId,
      name,
      inviteCode,
      ownerOpenid
    })
    memberships.push({
      spaceId,
      openid: ownerOpenid,
      role: ROLES.OWNER,
      status: 'active'
    })
    return clone(spaces.get(spaceId))
  }

  function findSpaceByInviteCode(inviteCode) {
    for (const item of spaces.values()) {
      if (item.inviteCode === inviteCode) {
        return clone(item)
      }
    }
    return null
  }

  function addOrActivateMembership({ spaceId, openid, role }) {
    const existing = memberships.find((item) => item.spaceId === spaceId && item.openid === openid)
    if (existing) {
      existing.role = role
      existing.status = 'active'
      return clone(existing)
    }

    const membership = {
      spaceId,
      openid,
      role,
      status: 'active'
    }
    memberships.push(membership)
    return clone(membership)
  }

  function listMembers(spaceId) {
    return memberships
      .filter((item) => item.spaceId === spaceId && item.status === 'active')
      .map((item) => clone(item))
  }

  function removeMember(spaceId, openid) {
    const existing = memberships.find((item) => item.spaceId === spaceId && item.openid === openid)
    if (!existing) {
      return false
    }
    existing.status = 'removed'
    return true
  }

  function renameSpace(spaceId, name) {
    const space = spaces.get(spaceId)
    if (!space) {
      return null
    }
    space.name = name
    return clone(space)
  }

  function rotateInviteCode(spaceId, inviteCode) {
    const space = spaces.get(spaceId)
    if (!space) {
      return null
    }
    space.inviteCode = inviteCode
    return clone(space)
  }

  function getSnapshot() {
    return {
      spaces: Array.from(spaces.values()).map((item) => clone(item)),
      memberships: memberships.map((item) => clone(item))
    }
  }

  function repository() {
    return {
      listMemberships,
      findMembership,
      createSpace,
      findSpaceByInviteCode,
      addOrActivateMembership,
      listMembers,
      removeMember,
      renameSpace,
      rotateInviteCode
    }
  }

  return {
    repository,
    getSnapshot
  }
}
