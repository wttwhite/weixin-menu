const { buildOkResponse, buildErrorResponse } = require('./shared/utils/response')
const { ERROR_CODES } = require('./shared/constants/error-codes')
const { createContext } = require('./lib/context')
const { createRepository } = require('./lib/repository')
const { bootstrapSession, toAppError } = require('./services/bootstrap-service')
const {
  createSpace,
  joinSpace,
  renameSpace,
  rotateInviteCode
} = require('./services/space-service')
const { listMembers, removeMember } = require('./services/member-service')

function normalizeError(error) {
  if (error && typeof error.code === 'number') {
    return buildErrorResponse(error.message || 'Request failed', error.code, false, error.data || null)
  }

  return buildErrorResponse(
    (error && error.message) || 'Unknown error',
    ERROR_CODES.UNKNOWN,
    false,
    null
  )
}

function createMemberOpsHandler(options = {}) {
  const createContextFn = options.createContext || createContext
  const createRepositoryFn = options.createRepository || createRepository

  return async function main(event = {}) {
    const action = event.action
    const supportedActions = new Set([
      'bootstrap',
      'initCollections',
      'createSpace',
      'joinSpace',
      'listMembers',
      'removeMember',
      'renameSpace',
      'rotateInviteCode'
    ])

    try {
      if (!supportedActions.has(action)) {
        return buildErrorResponse('Unsupported action', ERROR_CODES.NOT_FOUND)
      }

      const context = await createContextFn(event)
      if (!context.openid) {
        throw toAppError('Missing current user', ERROR_CODES.UNAUTHORIZED)
      }
      const repository = await createRepositoryFn(context)

      switch (action) {
        case 'bootstrap': {
          const data = await bootstrapSession(
            {
              openid: context.openid,
              preferredSpaceId: context.preferredSpaceId || event.preferredSpaceId || null
            },
            repository
          )
          return buildOkResponse(data)
        }
        case 'initCollections': {
          const data = await repository.ensureCollections()
          return buildOkResponse(data)
        }
        case 'createSpace': {
          const data = await createSpace(event, context, repository)
          return buildOkResponse(data)
        }
        case 'joinSpace': {
          const data = await joinSpace(event, context, repository)
          return buildOkResponse(data)
        }
        case 'listMembers': {
          const data = await listMembers(event, context, repository)
          return buildOkResponse(data)
        }
        case 'removeMember': {
          const data = await removeMember(event, context, repository)
          return buildOkResponse(data)
        }
        case 'renameSpace': {
          const data = await renameSpace(event, context, repository)
          return buildOkResponse(data)
        }
        case 'rotateInviteCode': {
          const data = await rotateInviteCode(event, context, repository)
          return buildOkResponse(data)
        }
      }
    } catch (error) {
      return normalizeError(error)
    }
  }
}

const defaultHandler = createMemberOpsHandler()

module.exports = {
  main: defaultHandler,
  createMemberOpsHandler
}
