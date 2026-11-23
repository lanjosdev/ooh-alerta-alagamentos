import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { cityOverviewQuerySchema } from '../../routes/schemas/alerts.js'
import type { GetCityOverviewService } from '../../services/alerts/get-city-overview-service.js'
import { successResponse } from '../../utils/api-response.js'
import { buildFeedSelfLink, formatAlertsAsRss } from '../../utils/rss-formatter.js'

type CityOverviewQuery = z.infer<typeof cityOverviewQuerySchema>

export class GetCityOverviewController {
  constructor(private readonly getCityOverviewService: GetCityOverviewService) {}

  async handleJson(
    request: FastifyRequest<{ Querystring: CityOverviewQuery }>,
    reply: FastifyReply,
  ) {
    const overview = await this.getCityOverviewService.execute({
      zone: request.query.zone,
      ibgeCode: request.query.ibgeCode,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    return reply.status(200).send(successResponse(overview))
  }

  async handleRss(
    request: FastifyRequest<{ Querystring: CityOverviewQuery }>,
    reply: FastifyReply,
  ) {
    const overview = await this.getCityOverviewService.execute({
      zone: request.query.zone,
      ibgeCode: request.query.ibgeCode,
      cgeDate: request.query.cgeDate,
      simulate: request.query.simulate,
    })

    const xml = formatAlertsAsRss({
      title: 'OOH Alerta Alagamentos — Panorama Consolidado SP',
      link: buildFeedSelfLink(request),
      description:
        'Feed RSS 2.0 consolidado de todas as regiões monitoradas para painéis de mídia DOOH',
      decisions: overview.regions,
      generatedAt: new Date(overview.generatedAt),
    })

    return reply.type('application/rss+xml; charset=utf-8').status(200).send(xml)
  }
}
