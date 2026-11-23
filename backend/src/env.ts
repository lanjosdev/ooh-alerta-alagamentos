import { config } from 'dotenv'
import { z } from 'zod'

config({ quiet: true })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().min(1).default('0.0.0.0'),
  CORS_ORIGIN: z.string().min(1).default('*'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  ENABLE_SIMULATION_PARAMS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  FORECAST_PROVIDER: z.enum(['open-meteo', 'tomorrow-io', 'google-weather']).default('open-meteo'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Falha ao validar variáveis de ambiente:\n${issues}`)
}

export const env = parsed.data
