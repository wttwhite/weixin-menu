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
          name: space ? space.name : '',
          inviteCode: space ? space.inviteCode || '' : '',
          displayName: item.displayName || ''
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
    if (!existing || existing.status === 'removed') {
      return false
    }
    existing.status = 'removed'
    return true
  }

  function updateMemberDisplayName(spaceId, openid, displayName) {
    const existing = memberships.find(
      (item) => item.spaceId === spaceId && item.openid === openid && item.status === 'active'
    )
    if (!existing) {
      return null
    }
    existing.displayName = displayName
    return clone(existing)
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
      updateMemberDisplayName,
      renameSpace,
      rotateInviteCode
    }
  }

  return {
    repository,
    getSnapshot
  }
}

export function createFakeCloudDbAdapter(seed = {}) {
  const spaces = new Map()
  const memberships = new Map()
  const inviteCodeClaims = new Map()
  const calls = []
  let nextSpaceId = 1
  let nextMembershipId = 1
  let failNextMemberAdd = Boolean(seed.failNextMemberAdd)

  for (const space of seed.spaces || []) {
    spaces.set(space._id, clone(space))
  }

  for (const membership of seed.memberships || []) {
    memberships.set(membership._id, clone(membership))
  }

  for (const claim of seed.inviteCodeClaims || []) {
    inviteCodeClaims.set(claim._id, clone(claim))
  }

  function matchesWhere(record, where = {}) {
    return Object.entries(where).every(([key, expected]) => {
      const actual = record[key]
      if (expected && typeof expected === 'object' && expected.__op === 'in') {
        return expected.value.includes(actual)
      }
      return actual === expected
    })
  }

  function addSpace(data) {
    const id = data._id || `space-${nextSpaceId++}`
    spaces.set(id, { _id: id, ...clone(data) })
    calls.push({ type: 'add', collection: 'spaces', id })
    return { _id: id }
  }

  function addMembership(data) {
    if (failNextMemberAdd) {
      failNextMemberAdd = false
      throw new Error('member write failed')
    }

    const id = data._id || `member-${nextMembershipId++}`
    memberships.set(id, { _id: id, ...clone(data) })
    calls.push({ type: 'add', collection: 'space_members', id })
    return { _id: id }
  }

  function collection(name) {
    if (name === 'spaces') {
      return {
        where(query) {
          return {
            async get() {
              const data = Array.from(spaces.values())
                .filter((item) => matchesWhere(item, query))
                .map((item) => clone(item))
              return { data }
            },
            async update({ data }) {
              let updated = 0
              for (const [id, existing] of spaces.entries()) {
                if (!matchesWhere(existing, query)) {
                  continue
                }
                spaces.set(id, { ...existing, ...clone(data) })
                updated += 1
                calls.push({ type: 'update', collection: 'spaces', id, viaWhere: true })
              }
              return { stats: { updated } }
            }
          }
        },
        async add({ data }) {
          return addSpace(data)
        },
        doc(id) {
          return {
            async update({ data }) {
              const existing = spaces.get(id)
              if (!existing) {
                return { stats: { updated: 0 } }
              }
              spaces.set(id, { ...existing, ...clone(data) })
              calls.push({ type: 'update', collection: 'spaces', id })
              return { stats: { updated: 1 } }
            },
            async get() {
              return { data: clone(spaces.get(id) || null) }
            },
            async remove() {
              const existed = spaces.delete(id)
              calls.push({ type: 'remove', collection: 'spaces', id, existed })
              return { stats: { removed: existed ? 1 : 0 } }
            }
          }
        }
      }
    }

    if (name === 'space_members') {
      return {
        where(query) {
          return {
            async get() {
              const data = Array.from(memberships.values())
                .filter((item) => matchesWhere(item, query))
                .map((item) => clone(item))
              return { data }
            }
          }
        },
        async add({ data }) {
          return addMembership(data)
        },
        doc(id) {
          return {
            async update({ data }) {
              const existing = memberships.get(id)
              if (!existing) {
                return { stats: { updated: 0 } }
              }
              memberships.set(id, { ...existing, ...clone(data) })
              calls.push({ type: 'update', collection: 'space_members', id })
              return { stats: { updated: 1 } }
            },
            async remove() {
              const existed = memberships.delete(id)
              calls.push({ type: 'remove', collection: 'space_members', id, existed })
              return { stats: { removed: existed ? 1 : 0 } }
            }
          }
        }
      }
    }

    if (name === 'invite_code_claims') {
      return {
        where(query) {
          return {
            async get() {
              const data = Array.from(inviteCodeClaims.values())
                .filter((item) => matchesWhere(item, query))
                .map((item) => clone(item))
              return { data }
            }
          }
        },
        async add({ data }) {
          const id = data._id
          if (!id) {
            throw new Error('invite-code claim _id is required')
          }
          if (inviteCodeClaims.has(id)) {
            const error = new Error('duplicate key')
            error.code = 'DUPLICATE_KEY'
            throw error
          }
          inviteCodeClaims.set(id, { _id: id, ...clone(data) })
          calls.push({ type: 'add', collection: 'invite_code_claims', id })
          return { _id: id }
        },
        doc(id) {
          return {
            async update({ data }) {
              const existing = inviteCodeClaims.get(id)
              if (!existing) {
                return { stats: { updated: 0 } }
              }
              inviteCodeClaims.set(id, { ...existing, ...clone(data) })
              calls.push({ type: 'update', collection: 'invite_code_claims', id })
              return { stats: { updated: 1 } }
            },
            async get() {
              return { data: clone(inviteCodeClaims.get(id) || null) }
            },
            async remove() {
              const existed = inviteCodeClaims.delete(id)
              calls.push({ type: 'remove', collection: 'invite_code_claims', id, existed })
              return { stats: { removed: existed ? 1 : 0 } }
            }
          }
        }
      }
    }

    throw new Error(`Unsupported collection: ${name}`)
  }

  const db = {
    command: {
      in(values) {
        return {
          __op: 'in',
          value: values
        }
      }
    },
    collection
  }

  const cloudSdk = {
    DYNAMIC_CURRENT_ENV: 'test-env',
    init() {
      calls.push({ type: 'init' })
    },
    database() {
      return db
    }
  }

  function snapshot() {
    return {
      spaces: Array.from(spaces.values()).map((item) => clone(item)),
      memberships: Array.from(memberships.values()).map((item) => clone(item)),
      inviteCodeClaims: Array.from(inviteCodeClaims.values()).map((item) => clone(item))
    }
  }

  return {
    cloudSdk,
    db,
    calls,
    snapshot,
    setFailNextMemberAdd(value) {
      failNextMemberAdd = Boolean(value)
    }
  }
}
