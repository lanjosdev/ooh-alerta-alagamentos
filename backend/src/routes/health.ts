import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { successResponse } from '../utils/api-response.js'
import { successResponseSchema } from './schemas/common.js'

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Infra'],
        summary: 'Healthcheck da API',
        response: {
          200: successResponseSchema(
            z.object({
              status: z.literal('ok'),
              uptime: z.number(),
              timestamp: z.iso.datetime(),
            }),
          ),
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send(
        successResponse({
          status: 'ok' as const,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }),
      )
    },
  )
}
