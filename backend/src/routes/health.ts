import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import type { GetSourcesStatusController } from '../controllers/health/get-sources-status-controller.js'
import { successResponse } from '../utils/api-response.js'
import { successResponseSchema } from './schemas/common.js'

export interface HealthRoutesOptions {
  getSourcesStatusController: GetSourcesStatusController
}

const sourceHealthSnapshotSchema = z.object({
  provider: z.string(),
  status: z.enum(['ok', 'degraded', 'unknown']),
  cachedKeys: z.number().int(),
  lastSuccessAt: z.string().nullable(),
  lastErrorAt: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
  lastLatencyMs: z.number().nullable(),
})

export const healthRoutes: FastifyPluginAsyncZod<HealthRoutesOptions> = async (app, options) => {
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

  app.get(
    '/sources/status',
    {
      schema: {
        tags: ['Infra'],
        summary: 'Estado de saúde e cache das fontes meteorológicas e hidrológicas',
        response: {
          200: successResponseSchema(
            z.object({
              checkedAt: z.string(),
              providers: z.array(sourceHealthSnapshotSchema),
            }),
          ),
        },
      },
    },
    (request, reply) => options.getSourcesStatusController.handle(request, reply),
  )
}
