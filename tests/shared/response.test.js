import { describe, expect, it } from 'vitest'
import {
  buildOkResponse,
  buildErrorResponse
} from '../../shared/utils/response'
import { ERROR_CODES } from '../../shared/constants/error-codes'

describe('buildOkResponse', () => {
  it('wraps payloads with code 0/message empty/retryable false', () => {
    expect(buildOkResponse({ ok: true })).toEqual({
      code: ERROR_CODES.OK,
      message: '',
      data: { ok: true },
      retryable: false
    })
  })

  it('supports custom message', () => {
    expect(buildOkResponse({ ok: true }, 'done')).toEqual({
      code: ERROR_CODES.OK,
      message: 'done',
      data: { ok: true },
      retryable: false
    })
  })
})

describe('buildErrorResponse', () => {
  it('uses explicit error fields', () => {
    expect(buildErrorResponse('bad request', 400, true, { field: 'name' })).toEqual(
      {
        code: 400,
        message: 'bad request',
        data: { field: 'name' },
        retryable: true
      }
    )
  })

  it('uses default error fields when omitted', () => {
    expect(buildErrorResponse('failed')).toEqual({
      code: ERROR_CODES.UNKNOWN,
      message: 'failed',
      data: null,
      retryable: false
    })
  })
})
