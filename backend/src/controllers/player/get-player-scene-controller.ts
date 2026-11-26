import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { playerSceneQuerySchema } from '../../routes/schemas/player.js'
import type { GetPlayerSceneService } from '../../services/player/get-player-scene-service.js'
import { successResponse } from '../../utils/api-response.js'

type PlayerSceneQuery = z.infer<typeof playerSceneQuerySchema>

export class GetPlayerSceneController {
  constructor(private readonly getPlayerSceneService: GetPlayerSceneService) {}

  async handle(request: FastifyRequest<{ Querystring: PlayerSceneQuery }>, reply: FastifyReply) {
    const { assetId, lat, lon, date, time, cgeDate, simulate } = request.query

    const scene = await this.getPlayerSceneService.execute(
      assetId !== undefined
        ? { assetId, date, time, cgeDate, simulate }
        : { lat: lat!, lon: lon!, date, time, cgeDate, simulate },
    )

    return reply.status(200).send(successResponse(scene))
  }
}
