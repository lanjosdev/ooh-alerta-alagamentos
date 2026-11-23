import axios from 'axios'

const DEFAULT_ERROR_MESSAGE = 'Não foi possível concluir a solicitação. Tente novamente.'

export interface ApiErrorOptions {
  status?: number | null
  code?: string | null
  isTimeout?: boolean
  isNetworkError?: boolean
  cause?: unknown
}

export class ApiError extends Error {
  readonly status: number | null
  readonly code: string | null
  readonly isTimeout: boolean
  readonly isNetworkError: boolean

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ApiError'
    this.status = options.status ?? null
    this.code = options.code ?? null
    this.isTimeout = options.isTimeout ?? false
    this.isNetworkError = options.isNetworkError ?? false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractEnvelopeMessage(data: unknown): string | null {
  if (!isRecord(data)) {
    return null
  }

  const rawMessage = data.message
  if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
    return rawMessage.trim()
  }

  return null
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? null
    const code = error.code ?? null
    const isTimeout = code === 'ECONNABORTED' || code === 'ETIMEDOUT'
    const isNetworkError = !error.response && !isTimeout
    const envelopeMessage = extractEnvelopeMessage(error.response?.data)

    if (envelopeMessage) {
      return new ApiError(envelopeMessage, { status, code, isTimeout, isNetworkError, cause: error })
    }

    if (isTimeout) {
      return new ApiError(
        'A requisição para a API excedeu o tempo limite. Tente novamente em instantes.',
        { status, code, isTimeout: true, isNetworkError: false, cause: error },
      )
    }

    if (isNetworkError) {
      return new ApiError(
        'Não foi possível conectar ao servidor da API. Verifique se o backend está em execução.',
        { status: null, code, isTimeout: false, isNetworkError: true, cause: error },
      )
    }

    if (status !== null) {
      return new ApiError(`Erro retornado pela API (HTTP ${status}).`, {
        status,
        code,
        isTimeout: false,
        isNetworkError: false,
        cause: error,
      })
    }

    return new ApiError(error.message || DEFAULT_ERROR_MESSAGE, {
      status,
      code,
      cause: error,
    })
  }

  if (error instanceof Error) {
    return new ApiError(error.message || DEFAULT_ERROR_MESSAGE, { cause: error })
  }

  return new ApiError(DEFAULT_ERROR_MESSAGE)
}

export function getApiErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  const apiError = toApiError(error)
  return apiError.message.trim().length > 0 ? apiError.message : fallback
}
