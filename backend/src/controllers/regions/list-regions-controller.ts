import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { listRegionsQuerySchema } from '../../routes/schemas/regions.js'
import type { ListRegionsService } from '../../services/regions/list-regions-service.js'
import { successResponse } from '../../utils/api-response.js'

type ListRegionsQuery = z.infer<typeof listRegionsQuerySchema>

export class ListRegionsController {
  constructor(private readonly listRegionsService: ListRegionsService) {}

  async handle(request: FastifyRequest<{ Querystring: ListRegionsQuery }>, reply: FastifyReply) {
    const regions = await this.listRegionsService.execute({
      zone: request.query.zone,
      ibgeCode: request.query.ibgeCode,
    })

    return reply.status(200).send(
      successResponse({
        total: regions.length,
        regions,
      }),
    )
  }
}
