import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import type { GetPlayerSceneController } from '../controllers/player/get-player-scene-controller.js'
import type { ListPlayerAssetsController } from '../controllers/player/list-player-assets-controller.js'
import type { SearchAddressController } from '../controllers/player/search-address-controller.js'
import { errorResponseSchema } from './schemas/common.js'
import {
  playerAssetsQuerySchema,
  playerAssetsResponseSchema,
  playerGeocodeQuerySchema,
  playerGeocodeResponseSchema,
  playerSceneQuerySchema,
  playerSceneResponseSchema,
} from './schemas/player.js'

export interface PlayerRoutesOptions {
  listPlayerAssetsController: ListPlayerAssetsController
  searchAddressController: SearchAddressController
  getPlayerSceneController: GetPlayerSceneController
}

export const playerRoutes: FastifyPluginAsyncZod<PlayerRoutesOptions> = async (app, options) => {
  app.get(
    '/player/assets',
    {
      schema: {
        tags: ['Player DOOH'],
        summary: 'Lista os 7 pontos OOH curados com resumo atual/histórico de risco',
        querystring: playerAssetsQuerySchema,
        response: {
          200: playerAssetsResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.listPlayerAssetsController.handle(request, reply),
  )

  app.get(
    '/player/geocode',
    {
      schema: {
        tags: ['Player DOOH'],
        summary: 'Busca textual de endereços e corredores em SP via Nominatim/OSM',
        querystring: playerGeocodeQuerySchema,
        response: {
          200: playerGeocodeResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.searchAddressController.handle(request, reply),
  )

  app.get(
    '/player/scene',
    {
      schema: {
        tags: ['Player DOOH'],
        summary: 'Cena completa do Player DOOH (decisão, textos PT-BR, câmera e GeoJSON viário)',
        description:
          'Aceita assetId OU o par lat+lon (exclusivo). Suporta replay histórico por date/time e simulação.',
        querystring: playerSceneQuerySchema,
        response: {
          200: playerSceneResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request, reply) => options.getPlayerSceneController.handle(request, reply),
  )
}
