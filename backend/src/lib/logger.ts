import { pino } from 'pino'
import { env } from '../env.js'

const levels = {
  development: 'debug',
  test: 'silent',
  production: 'info',
} as const

export const logger = pino({
  level: levels[env.NODE_ENV],
  base: { service: 'ooh-alerta-alagamentos-backend', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'apiKey',
      '*.password',
      '*.token',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:dd/mm/yyyy HH:MM:ss',
            ignore: 'pid,hostname,service,env',
          },
        }
      : undefined,
})
