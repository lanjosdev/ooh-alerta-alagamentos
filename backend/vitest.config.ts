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
    },
  },
})
