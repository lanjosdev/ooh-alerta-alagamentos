import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type {
  regionIdParamsSchema,
  simulationQuerySchema,
} from '../../routes/schemas/alerts.js'
import type { GetLocationAlertService } from '../../services/alerts/get-location-alert-service.js'
import { successResponse } from '../../utils/api-response.js'
import { buildFeedSelfLink, formatAlertsAsRss } from '../../utils/rss-formatter.js'

type RegionParams = z.infer<typeof regionIdParamsSchema>
type SimulationQuery = z.infer<typeof simulationQuerySchema>

export class GetRegionAlertController {
  constructor(private readonly getLocationAlertService: GetLocationAlertService) {}

  async handleJson(
    request: FastifyRequest<{ Params: RegionParams; Querystring: SimulationQuery }>,
    reply: FastifyReply,
  ) {
    const decision = await this.getLocationAlertService.execute({
      mode: 'region',
      regionId: request.params.regionId,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    return reply.status(200).send(successResponse(decision))
  }

  async handleRss(
    request: FastifyRequest<{ Params: RegionParams; Querystring: SimulationQuery }>,
    reply: FastifyReply,
  ) {
    const decision = await this.getLocationAlertService.execute({
      mode: 'region',
      regionId: request.params.regionId,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    const xml = formatAlertsAsRss({
      title: `OOH Alerta Alagamentos — ${decision.location.name}`,
      link: buildFeedSelfLink(request),
      description: `Feed RSS 2.0 individual para player DOOH da região ${decision.location.name}`,
      decisions: [decision],
    })

    return reply.type('application/rss+xml; charset=utf-8').status(200).send(xml)
  }
}
