import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { ApiError, getApiErrorMessage, toApiError } from './api-error'

function createAxiosError(overrides: Partial<AxiosError> = {}): AxiosError {
  const error = new AxiosError(
    overrides.message ?? 'Request failed',
    overrides.code,
    undefined,
    undefined,
    overrides.response,
  )
  return error
}

describe('api-error', () => {
  it('returns existing ApiError instance unchanged', () => {
    const original = new ApiError('Erro já tratado', { status: 400 })
    expect(toApiError(original)).toBe(original)
  })

  it('extracts message from Fastify ApiResponse envelope on HTTP error', () => {
    const axiosError = createAxiosError({
      message: 'Request failed with status code 400',
      response: {
        status: 400,
        statusText: 'Bad Request',
        headers: new AxiosHeaders(),
        config: { headers: new AxiosHeaders() },
        data: {
          success: false,
          message: 'Parâmetros de simulação estão desabilitados neste ambiente.',
          data: null,
        },
      },
    })

    const parsed = toApiError(axiosError)
    expect(parsed).toBeInstanceOf(ApiError)
    expect(parsed.status).toBe(400)
    expect(parsed.message).toBe('Parâmetros de simulação estão desabilitados neste ambiente.')
    expect(parsed.isTimeout).toBe(false)
    expect(parsed.isNetworkError).toBe(false)
  })

  it('maps timeout Axios errors cleanly', () => {
    const axiosError = createAxiosError({
      code: 'ECONNABORTED',
      message: 'timeout of 15000ms exceeded',
    })

    const parsed = toApiError(axiosError)
    expect(parsed.isTimeout).toBe(true)
    expect(parsed.isNetworkError).toBe(false)
    expect(parsed.message).toContain('tempo limite')
  })

  it('maps network errors without HTTP response cleanly', () => {
    const axiosError = createAxiosError({
      code: 'ERR_NETWORK',
      message: 'Network Error',
    })

    const parsed = toApiError(axiosError)
    expect(parsed.isNetworkError).toBe(true)
    expect(parsed.isTimeout).toBe(false)
    expect(parsed.status).toBeNull()
    expect(parsed.message).toContain('backend')
  })

  it('handles generic errors and unknown values safely', () => {
    expect(getApiErrorMessage(new Error('Falha inesperada'))).toBe('Falha inesperada')
    expect(getApiErrorMessage('desconhecido')).toContain('Não foi possível concluir')
  })
})
