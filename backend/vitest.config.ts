import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      PORT: '3333',
      HOST: '127.0.0.1',
      CORS_ORIGIN: '*',
      RATE_LIMIT_MAX: '120',
      ENABLE_SIMULATION_PARAMS: 'true',
      FORECAST_PROVIDER: 'open-meteo',
      HTTP_TIMEOUT_MS: '8000',
      CACHE_TTL_FORECAST_SECONDS: '900',
      CACHE_TTL_INMET_SECONDS: '600',
      CACHE_TTL_CGE_SECONDS: '300',
    },
  },
})
