import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { playerAssetsQuerySchema } from '../../routes/schemas/player.js'
import type { ListPlayerAssetsService } from '../../services/player/list-player-assets-service.js'
import { successResponse } from '../../utils/api-response.js'

type PlayerAssetsQuery = z.infer<typeof playerAssetsQuerySchema>

export class ListPlayerAssetsController {
  constructor(private readonly listPlayerAssetsService: ListPlayerAssetsService) {}

  async handle(request: FastifyRequest<{ Querystring: PlayerAssetsQuery }>, reply: FastifyReply) {
    const assets = await this.listPlayerAssetsService.execute({
      date: request.query.date,
      time: request.query.time,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    return reply.status(200).send(
      successResponse({
        total: assets.length,
        assets,
      }),
    )
  }
}
