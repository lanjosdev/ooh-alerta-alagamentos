import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { ListRegionsController } from '../controllers/regions/list-regions-controller.js'
import { errorResponseSchema } from './schemas/common.js'
import { listRegionsQuerySchema, listRegionsResponseSchema } from './schemas/regions.js'

export interface RegionRoutesOptions {
  listRegionsController: ListRegionsController
}

export const regionRoutes: FastifyPluginAsyncZod<RegionRoutesOptions> = async (app, options) => {
  app.get(
    '/regions',
    {
      schema: {
        tags: ['Regiões'],
        summary: 'Lista o catálogo de regiões monitoradas',
        description:
          'Retorna as regiões monitoradas na Capital de São Paulo com suporte a filtros opcionais por zona e código IBGE.',
        querystring: listRegionsQuerySchema,
        response: {
          200: listRegionsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.listRegionsController.handle(request, reply),
  )
}
