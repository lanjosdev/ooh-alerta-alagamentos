import { z } from 'zod'

export const DEFAULT_API_BASE_URL = 'http://localhost:3333/v1'
export const DEFAULT_API_TIMEOUT_MS = 15000

const apiBaseUrlSchema = z
  .string()
  .trim()
  .min(1, 'VITE_API_BASE_URL não pode ser vazio.')
  .refine((value) => {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }, 'VITE_API_BASE_URL deve ser uma URL HTTP ou HTTPS válida (ex.: http://localhost:3333/v1).')
  .transform((value) => value.replace(/\/+$/, ''))

const apiTimeoutSchema = z.preprocess(
  (value) => (value === undefined || value === '' ? DEFAULT_API_TIMEOUT_MS : value),
  z.coerce
    .number({ message: 'VITE_API_TIMEOUT_MS deve ser um número inteiro em milissegundos.' })
    .int('VITE_API_TIMEOUT_MS deve ser um número inteiro.')
    .min(1000, 'VITE_API_TIMEOUT_MS deve ser no mínimo 1000 ms.')
    .max(120000, 'VITE_API_TIMEOUT_MS deve ser no máximo 120000 ms.'),
)

export const envSchema = z.object({
  VITE_API_BASE_URL: z.preprocess(
    (value) => (value === undefined ? DEFAULT_API_BASE_URL : value),
    apiBaseUrlSchema,
  ),
  VITE_API_TIMEOUT_MS: apiTimeoutSchema,
})

export type AppEnv = z.infer<typeof envSchema>

export interface EnvValidationIssue {
  path: string
  message: string
}

export type EnvValidationResult =
  | { success: true; data: AppEnv }
  | { success: false; issues: EnvValidationIssue[] }

export function parseEnv(rawEnv: Record<string, unknown>): EnvValidationResult {
  const result = envSchema.safeParse({
    VITE_API_BASE_URL: rawEnv.VITE_API_BASE_URL,
    VITE_API_TIMEOUT_MS: rawEnv.VITE_API_TIMEOUT_MS,
  })

  if (result.success) {
    return { success: true, data: result.data }
  }

  const issues: EnvValidationIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : 'env',
    message: issue.message,
  }))

  return { success: false, issues }
}

export const envValidation: EnvValidationResult = parseEnv(import.meta.env)

export function getValidatedEnv(): AppEnv {
  if (envValidation.success) {
    return envValidation.data
  }

  return {
    VITE_API_BASE_URL: DEFAULT_API_BASE_URL,
    VITE_API_TIMEOUT_MS: DEFAULT_API_TIMEOUT_MS,
  }
}
