import { describe, expect, it } from 'vitest'
import { DEFAULT_API_BASE_URL, DEFAULT_API_TIMEOUT_MS, parseEnv } from './env'

describe('parseEnv', () => {
  it('applies safe defaults when environment variables are omitted', () => {
    const result = parseEnv({})

    expect(result).toEqual({
      success: true,
      data: {
        VITE_API_BASE_URL: DEFAULT_API_BASE_URL,
        VITE_API_TIMEOUT_MS: DEFAULT_API_TIMEOUT_MS,
      },
    })
  })

  it('normalizes trailing slash from a valid HTTP/HTTPS VITE_API_BASE_URL', () => {
    const result = parseEnv({
      VITE_API_BASE_URL: 'https://api.alerta-ooh.dev/v1/',
      VITE_API_TIMEOUT_MS: '8000',
    })

    expect(result).toEqual({
      success: true,
      data: {
        VITE_API_BASE_URL: 'https://api.alerta-ooh.dev/v1',
        VITE_API_TIMEOUT_MS: 8000,
      },
    })
  })

  it('rejects empty string or invalid URL protocols in VITE_API_BASE_URL', () => {
    const emptyResult = parseEnv({ VITE_API_BASE_URL: '' })
    expect(emptyResult.success).toBe(false)
    if (!emptyResult.success) {
      expect(emptyResult.issues[0]?.path).toBe('VITE_API_BASE_URL')
    }

    const ftpResult = parseEnv({ VITE_API_BASE_URL: 'ftp://localhost:3333/v1' })
    expect(ftpResult.success).toBe(false)
    if (!ftpResult.success) {
      expect(ftpResult.issues[0]?.path).toBe('VITE_API_BASE_URL')
    }
  })

  it('rejects out-of-range or non-numeric VITE_API_TIMEOUT_MS values', () => {
    const tooSmallResult = parseEnv({ VITE_API_TIMEOUT_MS: '500' })
    expect(tooSmallResult.success).toBe(false)
    if (!tooSmallResult.success) {
      expect(tooSmallResult.issues[0]?.path).toBe('VITE_API_TIMEOUT_MS')
    }

    const invalidResult = parseEnv({ VITE_API_TIMEOUT_MS: 'nao-numero' })
    expect(invalidResult.success).toBe(false)
    if (!invalidResult.success) {
      expect(invalidResult.issues[0]?.path).toBe('VITE_API_TIMEOUT_MS')
    }
  })
})
