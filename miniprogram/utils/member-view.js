function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveMemberDisplayName(member = {}) {
  return (
    normalizeText(member.displayName) ||
    normalizeText(member.nickName) ||
    normalizeText(member.name) ||
    normalizeText(member.openid) ||
    '匿名成员'
  )
}

function buildRoleLabel(role = '') {
  return role === 'owner' ? '创建者' : '成员'
}

function decorateSpaceMembers(members = [], currentOpenid = '') {
  return (members || []).map((member) => ({
    ...member,
    id: member.openid || member._id || '',
    name: resolveMemberDisplayName(member),
    roleLabel: buildRoleLabel(member.role),
    isCurrentUser: member.openid === currentOpenid
  }))
}

module.exports = {
  buildRoleLabel,
  decorateSpaceMembers,
  resolveMemberDisplayName
}
