import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import fastify from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { z } from 'zod'
import { GetCityOverviewController } from './controllers/alerts/get-city-overview-controller.js'
import { GetCoordinatesAlertController } from './controllers/alerts/get-coordinates-alert-controller.js'
import { GetRegionAlertController } from './controllers/alerts/get-region-alert-controller.js'
import { GetSourcesStatusController } from './controllers/health/get-sources-status-controller.js'
import { GetPlayerSceneController } from './controllers/player/get-player-scene-controller.js'
import { ListPlayerAssetsController } from './controllers/player/list-player-assets-controller.js'
import { SearchAddressController } from './controllers/player/search-address-controller.js'
import { ListRegionsController } from './controllers/regions/list-regions-controller.js'
import { env } from './env.js'
import { MemoryCache } from './lib/cache.js'
import { logger } from './lib/logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { CgeSpFloodingProvider } from './providers/cge-sp/cge-sp-flooding-provider.js'
import type { FloodSusceptibilityProvider } from './providers/flood-susceptibility-provider.js'
import type { FloodingMonitorProvider } from './providers/flooding-monitor-provider.js'
import type { ForecastProvider } from './providers/forecast-provider.js'
import type { GeocodingProvider } from './providers/geocoding-provider.js'
import { GeoSampaWfsProvider } from './providers/geosampa/geosampa-wfs-provider.js'
import { InmetAlertsProvider } from './providers/inmet/inmet-alerts-provider.js'
import { NominatimGeocodingProvider } from './providers/nominatim/nominatim-geocoding-provider.js'
import type { OfficialAlertsProvider } from './providers/official-alerts-provider.js'
import { OverpassRoadGeometryProvider } from './providers/overpass/overpass-road-geometry-provider.js'
import { createForecastProvider } from './providers/provider-factory.js'
import type { RoadGeometryProvider } from './providers/road-geometry-provider.js'
import { InMemoryOohAssetRepository } from './repositories/in-memory/in-memory-ooh-asset-repository.js'
import { InMemoryRegionRepository } from './repositories/in-memory/in-memory-region-repository.js'
import type { OohAssetRepository } from './repositories/ooh-asset-repository.js'
import type { RegionRepository } from './repositories/region-repository.js'
import { alertRoutes } from './routes/alerts.js'
import { healthRoutes } from './routes/health.js'
import { playerRoutes } from './routes/player.js'
import { regionRoutes } from './routes/regions.js'
import { GetCityOverviewService } from './services/alerts/get-city-overview-service.js'
import { GetLocationAlertService } from './services/alerts/get-location-alert-service.js'
import { GetSourcesStatusService } from './services/health/get-sources-status-service.js'
import { GetPlayerSceneService } from './services/player/get-player-scene-service.js'
import { ListPlayerAssetsService } from './services/player/list-player-assets-service.js'
import { SearchAddressService } from './services/player/search-address-service.js'
import { ListRegionsService } from './services/regions/list-regions-service.js'
import { errorResponse } from './utils/api-response.js'

z.config(z.locales.pt())

const API_PREFIX = '/v1'

export interface AppDependencies {
  regionRepository?: RegionRepository
  oohAssetRepository?: OohAssetRepository
  forecastProvider?: ForecastProvider
  officialAlertsProvider?: OfficialAlertsProvider
  floodingMonitorProvider?: FloodingMonitorProvider
  roadGeometryProvider?: RoadGeometryProvider
  floodSusceptibilityProvider?: FloodSusceptibilityProvider
  geocodingProvider?: GeocodingProvider
  cache?: MemoryCache
  enableSimulationParams?: boolean
}

function parseCorsOrigin(value: string): boolean | string[] {
  return value === '*' ? true : value.split(',').map((origin) => origin.trim())
}

export async function buildApp(dependencies: AppDependencies = {}) {
  const cache = dependencies.cache ?? new MemoryCache()
  const enableSimulationParams = dependencies.enableSimulationParams ?? env.ENABLE_SIMULATION_PARAMS
  const regionRepository = dependencies.regionRepository ?? new InMemoryRegionRepository()
  const oohAssetRepository = dependencies.oohAssetRepository ?? new InMemoryOohAssetRepository()
  const forecastProvider = dependencies.forecastProvider ?? createForecastProvider()
  const officialAlertsProvider = dependencies.officialAlertsProvider ?? new InmetAlertsProvider()
  const floodingMonitorProvider =
    dependencies.floodingMonitorProvider ?? new CgeSpFloodingProvider()
  const roadGeometryProvider =
    dependencies.roadGeometryProvider ?? new OverpassRoadGeometryProvider()
  const floodSusceptibilityProvider =
    dependencies.floodSusceptibilityProvider ?? new GeoSampaWfsProvider()
  const geocodingProvider = dependencies.geocodingProvider ?? new NominatimGeocodingProvider()

  cache.registerProvider(forecastProvider.providerName)
  cache.registerProvider(officialAlertsProvider.providerName)
  cache.registerProvider(floodingMonitorProvider.providerName)
  cache.registerProvider(roadGeometryProvider.providerName)
  cache.registerProvider(floodSusceptibilityProvider.providerName)
  cache.registerProvider(geocodingProvider.providerName)

  const listRegionsService = new ListRegionsService(regionRepository)
  const getSourcesStatusService = new GetSourcesStatusService(cache)
  const getLocationAlertService = new GetLocationAlertService({
    regionRepository,
    forecastProvider,
    officialAlertsProvider,
    floodingMonitorProvider,
    cache,
    enableSimulationParams,
  })
  const getCityOverviewService = new GetCityOverviewService(
    regionRepository,
    getLocationAlertService,
  )
  const listPlayerAssetsService = new ListPlayerAssetsService(
    oohAssetRepository,
    getLocationAlertService,
  )
  const searchAddressService = new SearchAddressService({
    geocodingProvider,
    cache,
  })
  const getPlayerSceneService = new GetPlayerSceneService({
    oohAssetRepository,
    getLocationAlertService,
    roadGeometryProvider,
    floodSusceptibilityProvider,
    cache,
  })

  const listRegionsController = new ListRegionsController(listRegionsService)
  const getSourcesStatusController = new GetSourcesStatusController(getSourcesStatusService)
  const getRegionAlertController = new GetRegionAlertController(getLocationAlertService)
  const getCityOverviewController = new GetCityOverviewController(getCityOverviewService)
  const getCoordinatesAlertController = new GetCoordinatesAlertController(getLocationAlertService)
  const listPlayerAssetsController = new ListPlayerAssetsController(listPlayerAssetsService)
  const searchAddressController = new SearchAddressController(searchAddressService)
  const getPlayerSceneController = new GetPlayerSceneController(getPlayerSceneService)

  const app = fastify({ loggerInstance: logger }).withTypeProvider<ZodTypeProvider>()

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  app.setErrorHandler(errorHandler)
  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(errorResponse(`Rota ${request.method} ${request.url} não encontrada`))
  })

  await app.register(cors, {
    origin: parseCorsOrigin(env.CORS_ORIGIN),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      success: false,
      message: `Muitas requisições. Tente novamente em ${context.after}.`,
      data: null,
    }),
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'OOH Alerta Alagamentos API',
        description:
          'API REST (JSON) e Feeds XML/RSS 2.0 para monitoramento de chuvas intensas e risco de alagamentos em mídia DOOH.',
        version: '0.2.0',
      },
      tags: [
        { name: 'Infra', description: 'Diagnóstico, saúde da aplicação e status das fontes' },
        { name: 'Regiões', description: 'Catálogo de regiões monitoradas' },
        { name: 'Alertas', description: 'Decisões dinâmicas de chuva e alagamentos (JSON)' },
        { name: 'Feeds OOH', description: 'Feeds XML / RSS 2.0 para players DOOH' },
        {
          name: 'Player DOOH',
          description: 'Catálogo de ativos OOH, geocodificação e cenas geoespaciais do Player DOOH',
        },
      ],
    },
    transform: jsonSchemaTransform,
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  await app.register(healthRoutes, {
    prefix: API_PREFIX,
    getSourcesStatusController,
    enableSimulationParams,
  })
  await app.register(regionRoutes, {
    prefix: API_PREFIX,
    listRegionsController,
  })
  await app.register(alertRoutes, {
    prefix: API_PREFIX,
    getRegionAlertController,
    getCityOverviewController,
    getCoordinatesAlertController,
  })
  await app.register(playerRoutes, {
    prefix: API_PREFIX,
    listPlayerAssetsController,
    searchAddressController,
    getPlayerSceneController,
  })

  return app
}
