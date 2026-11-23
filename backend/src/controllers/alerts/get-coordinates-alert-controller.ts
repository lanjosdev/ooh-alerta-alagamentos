import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { coordinatesAlertQuerySchema } from '../../routes/schemas/alerts.js'
import type { GetLocationAlertService } from '../../services/alerts/get-location-alert-service.js'
import { successResponse } from '../../utils/api-response.js'
import { buildFeedSelfLink, formatAlertsAsRss } from '../../utils/rss-formatter.js'

type CoordinatesAlertQuery = z.infer<typeof coordinatesAlertQuerySchema>

export class GetCoordinatesAlertController {
  constructor(private readonly getLocationAlertService: GetLocationAlertService) {}

  async handleJson(
    request: FastifyRequest<{ Querystring: CoordinatesAlertQuery }>,
    reply: FastifyReply,
  ) {
    const decision = await this.getLocationAlertService.execute({
      mode: 'coordinates',
      lat: request.query.lat,
      lon: request.query.lon,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    return reply.status(200).send(successResponse(decision))
  }

  async handleRss(
    request: FastifyRequest<{ Querystring: CoordinatesAlertQuery }>,
    reply: FastifyReply,
  ) {
    const decision = await this.getLocationAlertService.execute({
      mode: 'coordinates',
      lat: request.query.lat,
      lon: request.query.lon,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    const xml = formatAlertsAsRss({
      title: `OOH Alerta Alagamentos — ${decision.location.name}`,
      link: buildFeedSelfLink(request),
      description: `Feed RSS 2.0 hiperlocal para coordenadas (${decision.location.latitude}, ${decision.location.longitude})`,
      decisions: [decision],
    })

    return reply.type('application/rss+xml; charset=utf-8').status(200).send(xml)
  }
}
