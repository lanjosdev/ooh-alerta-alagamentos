import type { FastifyReply, FastifyRequest } from 'fastify'
import type { GetSourcesStatusService } from '../../services/health/get-sources-status-service.js'
import { successResponse } from '../../utils/api-response.js'

export class GetSourcesStatusController {
  constructor(private readonly getSourcesStatusService: GetSourcesStatusService) {}

  async handle(_request: FastifyRequest, reply: FastifyReply) {
    const result = this.getSourcesStatusService.execute()
    return reply.status(200).send(successResponse(result))
  }
}
