const INVITE_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const DEFAULT_INVITE_CODE_LENGTH = 6

function getNodeWebCrypto() {
  if (typeof require !== 'function') {
    return null
  }

  try {
    const nodeCrypto = require('crypto')
    return nodeCrypto.webcrypto || null
  } catch (error) {
    return null
  }
}

function getRandomIndex(maxExclusive) {
  const runtimeCrypto = globalThis.crypto || getNodeWebCrypto()

  if (runtimeCrypto && typeof runtimeCrypto.getRandomValues === 'function') {
    const value = new Uint32Array(1)
    runtimeCrypto.getRandomValues(value)
    return value[0] % maxExclusive
  }

  return Math.floor(Math.random() * maxExclusive)
}

function createInviteCode(length = DEFAULT_INVITE_CODE_LENGTH) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new TypeError('Invite code length must be a positive integer')
  }

  let value = ''

  for (let index = 0; index < length; index += 1) {
    const randomIndex = getRandomIndex(INVITE_CODE_CHARS.length)
    value += INVITE_CODE_CHARS[randomIndex]
  }

  return value
}

module.exports = {
  createInviteCode
}
