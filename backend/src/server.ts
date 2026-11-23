import { buildApp } from './app.js'
import { env } from './env.js'
import { logger } from './lib/logger.js'

const app = await buildApp()

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (error) {
  logger.fatal({ err: error }, 'Falha ao iniciar o servidor')
  process.exit(1)
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    logger.info({ signal }, 'Encerrando o servidor')
    await app.close()
    process.exit(0)
  })
}
