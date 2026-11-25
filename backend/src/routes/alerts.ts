import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { GetCityOverviewController } from '../controllers/alerts/get-city-overview-controller.js'
import type { GetCoordinatesAlertController } from '../controllers/alerts/get-coordinates-alert-controller.js'
import type { GetRegionAlertController } from '../controllers/alerts/get-region-alert-controller.js'
import {
  cityOverviewQuerySchema,
  cityOverviewResponseSchema,
  coordinatesAlertQuerySchema,
  regionAlertQuerySchema,
  regionIdParamsSchema,
  rssCityOverviewQuerySchema,
  rssCoordinatesAlertQuerySchema,
  rssRegionAlertQuerySchema,
  singleAlertResponseSchema,
} from './schemas/alerts.js'
import { errorResponseSchema } from './schemas/common.js'

export interface AlertRoutesOptions {
  getRegionAlertController: GetRegionAlertController
  getCityOverviewController: GetCityOverviewController
  getCoordinatesAlertController: GetCoordinatesAlertController
}

export const alertRoutes: FastifyPluginAsyncZod<AlertRoutesOptions> = async (app, options) => {
  app.get(
    '/alerts/regions',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Panorama consolidado de risco de todas as regiões monitoradas',
        querystring: cityOverviewQuerySchema,
        response: {
          200: cityOverviewResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getCityOverviewController.handleJson(request, reply),
  )

  app.get(
    '/alerts/regions/:regionId',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Decisão dinâmica de alerta para uma região monitorada',
        params: regionIdParamsSchema,
        querystring: regionAlertQuerySchema,
        response: {
          200: singleAlertResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getRegionAlertController.handleJson(request, reply),
  )

  app.get(
    '/alerts/by-coordinates',
    {
      schema: {
        tags: ['Alertas'],
        summary: 'Decisão hiperlocal de alerta por coordenada geográfica (lat/lon)',
        description:
          'Funciona para qualquer coordenada no Estado de SP/Brasil. Quando o ponto está na Capital SP, aciona automaticamente a estação física e alagamentos do CGE-SP.',
        querystring: coordinatesAlertQuerySchema,
        response: {
          200: singleAlertResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getCoordinatesAlertController.handleJson(request, reply),
  )

  app.get(
    '/alerts/feed.xml',
    {
      schema: {
        tags: ['Feeds OOH'],
        summary: 'Feed XML RSS 2.0 consolidado de todas as regiões',
        description:
          'Entrega XML puro (`Content-Type: application/rss+xml; charset=utf-8`) com tags padrão RSS 2.0 e extensões `<ooh:*>` para players DOOH. Rejeita parâmetros históricos `date` e `time`.',
        querystring: rssCityOverviewQuerySchema,
        response: {
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getCityOverviewController.handleRss(request, reply),
  )

  app.get(
    '/alerts/regions/:regionId/feed.xml',
    {
      schema: {
        tags: ['Feeds OOH'],
        summary: 'Feed XML RSS 2.0 individual de uma região monitorada',
        description:
          'Entrega XML puro (`Content-Type: application/rss+xml; charset=utf-8`) para consumo direto pelo player DOOH da região. Rejeita parâmetros históricos `date` e `time`.',
        params: regionIdParamsSchema,
        querystring: rssRegionAlertQuerySchema,
        response: {
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getRegionAlertController.handleRss(request, reply),
  )

  app.get(
    '/alerts/by-coordinates/feed.xml',
    {
      schema: {
        tags: ['Feeds OOH'],
        summary: 'Feed XML RSS 2.0 individual por coordenada geográfica',
        description:
          'Entrega XML puro (`Content-Type: application/rss+xml; charset=utf-8`) com decisão hiperlocal por coordenada. Rejeita parâmetros históricos `date` e `time`.',
        querystring: rssCoordinatesAlertQuerySchema,
        response: {
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getCoordinatesAlertController.handleRss(request, reply),
  )
}
