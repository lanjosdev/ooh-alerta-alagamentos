import axios, { type AxiosResponse } from 'axios'
import { getValidatedEnv } from '@/env'
import { ApiError, toApiError } from '@/lib/api-error'
import type { ApiResponse } from '@/types/api'

const validatedEnv = getValidatedEnv()

export const apiClient = axios.create({
  baseURL: validatedEnv.VITE_API_BASE_URL,
  timeout: validatedEnv.VITE_API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiError(error)),
)

export function unwrapApiResponse<T>(response: AxiosResponse<ApiResponse<T>>): T {
  const payload = response.data
  if (!payload || payload.success !== true || payload.data === null) {
    const message =
      payload && typeof payload.message === 'string' && payload.message.trim().length > 0
        ? payload.message.trim()
        : 'A API retornou uma resposta sem dados válidos.'

    throw new ApiError(message, { status: response.status })
  }

  return payload.data
}
