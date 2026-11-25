import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { playerGeocodeQuerySchema } from '../../routes/schemas/player.js'
import type { SearchAddressService } from '../../services/player/search-address-service.js'
import { successResponse } from '../../utils/api-response.js'

type PlayerGeocodeQuery = z.infer<typeof playerGeocodeQuerySchema>

export class SearchAddressController {
  constructor(private readonly searchAddressService: SearchAddressService) {}

  async handle(request: FastifyRequest<{ Querystring: PlayerGeocodeQuery }>, reply: FastifyReply) {
    const candidates = await this.searchAddressService.execute(request.query.q)

    return reply.status(200).send(
      successResponse({
        query: request.query.q,
        total: candidates.length,
        candidates,
      }),
    )
  }
}
