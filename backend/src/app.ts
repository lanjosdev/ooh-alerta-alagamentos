import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from './env.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { healthRoutes } from './routes/health.js'
import { errorResponse } from './utils/api-response.js'

z.config(z.locales.pt())

const API_PREFIX = '/v1'

function parseCorsOrigin(value: string): boolean | string[] {
  return value === '*' ? true : value.split(',').map((origin) => origin.trim())
}

export async function buildApp() {
  const app = fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send(errorResponse(`Rota ${request.method} ${request.url} não encontrada`))
  })

  await app.register(cors, {
    origin: parseCorsOrigin(env.CORS_ORIGIN),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      success: false,
      message: `Muitas requisições. Tente novamente em ${context.after}.`,
      data: null,
    }),
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'OOH Alerta Alagamentos API',
        description:
          'API REST (JSON) e Feeds XML/RSS 2.0 para monitoramento de chuvas intensas e risco de alagamentos em mídia DOOH.',
        version: '0.1.0',
      },
      tags: [{ name: 'Infra', description: 'Diagnóstico e saúde da aplicação' }],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(healthRoutes, { prefix: API_PREFIX })

  return app
}
