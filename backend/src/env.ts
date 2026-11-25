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
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  CACHE_TTL_FORECAST_SECONDS: z.coerce.number().int().positive().default(900),
  CACHE_TTL_INMET_SECONDS: z.coerce.number().int().positive().default(600),
  CACHE_TTL_CGE_SECONDS: z.coerce.number().int().positive().default(300),
  CACHE_TTL_HISTORICAL_SECONDS: z.coerce.number().int().positive().default(86400),
  CACHE_TTL_OVERPASS_SECONDS: z.coerce.number().int().positive().default(86400),
  CACHE_TTL_GEOSAMPA_SECONDS: z.coerce.number().int().positive().default(86400),
  CACHE_TTL_GEOCODE_SECONDS: z.coerce.number().int().positive().default(86400),
  OVERPASS_URLS: z
    .string()
    .min(1)
    .default(
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter,https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter',
    ),
  NOMINATIM_USER_AGENT: z
    .string()
    .min(1)
    .default('ooh-alerta-alagamentos/0.2 (+https://github.com/lanjosdev/ooh-alerta-alagamentos)'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Falha ao validar variáveis de ambiente:\n${issues}`)
}

export const env = parsed.data
