const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DEFAULT_INVITE_CODE_LENGTH = 6

function createInviteCode(length = DEFAULT_INVITE_CODE_LENGTH) {
  let value = ''

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * INVITE_CODE_CHARS.length)
    value += INVITE_CODE_CHARS[randomIndex]
  }

  return value
}

module.exports = {
  createInviteCode
}
