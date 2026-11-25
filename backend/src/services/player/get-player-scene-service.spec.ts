import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from '../../lib/cache.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
} from '../../providers/flooding-monitor-provider.js'
import type {
  FloodSusceptibilityPolygon,
  FloodSusceptibilityProvider,
} from '../../providers/flood-susceptibility-provider.js'
import type { ForecastProvider } from '../../providers/forecast-provider.js'
import type { OfficialAlertsProvider } from '../../providers/official-alerts-provider.js'
import type { RoadGeometryProvider, RoadSegment } from '../../providers/road-geometry-provider.js'
import { InMemoryOohAssetRepository } from '../../repositories/in-memory/in-memory-ooh-asset-repository.js'
import { InMemoryRegionRepository } from '../../repositories/in-memory/in-memory-region-repository.js'
import { NotFoundError } from '../../utils/application-error.js'
import { GetLocationAlertService } from '../alerts/get-location-alert-service.js'
import { GetPlayerSceneService } from './get-player-scene-service.js'

function createDeps(options?: { failOverpass?: boolean; failGeoSampa?: boolean }) {
  const cache = new MemoryCache()

  const forecastProvider: ForecastProvider = {
    providerName: 'open-meteo',
    getHourlyForecast: vi.fn(async (lat, lon) => ({
      provider: 'open-meteo',
      gridLatitude: lat,
      gridLongitude: lon,
      timezone: 'America/Sao_Paulo',
      current: null,
      maxRainProbabilityNext2hPercent: 85,
      expectedRainNext2hMm: 18,
      peakRainIntensityNext2hMmPerHour: 16,
      maxRainProbabilityNext6hPercent: 85,
      expectedRainNext6hMm: 22,
      hourly: [],
    })),
    getHistoricalHourly: vi.fn(async (lat, lon, dateIso) => ({
      provider: 'open-meteo-historical',
      dateIso,
      gridLatitude: lat,
      gridLongitude: lon,
      timezone: 'America/Sao_Paulo',
      hourly: [
        {
          time: `${dateIso}T18:00`,
          precipitationProbabilityPercent: 90,
          precipitationMm: 20,
          rainMm: 20,
          weatherCode: 95,
          temperatureC: 23,
          humidityPercent: 90,
          isDay: false,
        },
      ],
    })),
  }

  const officialAlertsProvider: OfficialAlertsProvider = {
    providerName: 'inmet',
    getActiveAlerts: vi.fn(async () => []),
  }

  const floodingMonitorProvider: FloodingMonitorProvider = {
    providerName: 'cge-sp',
    getFloodingPoints: vi.fn(async (): Promise<FloodingPoint[]> => [
      {
        zone: 'Zona Leste',
        neighborhood: 'Mooca',
        street: 'AV ALCANTARA MACHADO',
        direction: 'BAIRRO/CENTRO',
        reference: 'VD ALCANTARA MACHADO',
        timeWindow: 'Desde 18:00',
        status: 'ativo-intransitavel',
        active: true,
        passable: false,
      },
    ]),
    getStationRainfall: vi.fn(async () => null),
  }

  const roadGeometryProvider: RoadGeometryProvider = {
    providerName: 'overpass',
    getNearbyRoads: options?.failOverpass
      ? vi.fn(async (): Promise<RoadSegment[]> => {
          throw new Error('Overpass timeout')
        })
      : vi.fn(async (): Promise<RoadSegment[]> => [
          {
            osmId: '9001',
            streetName: 'Avenida Paulista',
            highway: 'primary',
            coordinates: [
              [-46.658, -23.562],
              [-46.655, -23.561],
            ],
          },
          {
            osmId: '9002',
            streetName: 'Rua Augusta',
            highway: 'secondary',
            coordinates: [
              [-46.662, -23.558],
              [-46.66, -23.556],
            ],
          },
        ]),
  }

  const floodSusceptibilityProvider: FloodSusceptibilityProvider = {
    providerName: 'geosampa-wfs',
    getFloodZones: options?.failGeoSampa
      ? vi.fn(async (): Promise<FloodSusceptibilityPolygon[]> => {
          throw new Error('GeoSampa WFS offline')
        })
      : vi.fn(async (): Promise<FloodSusceptibilityPolygon[]> => [
          {
            id: 'mancha.1',
            layerName: 'geoportal:mancha_inundacao_25',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-46.6585, -23.5625],
                  [-46.6545, -23.5625],
                  [-46.6545, -23.5605],
                  [-46.6585, -23.5605],
                  [-46.6585, -23.5625],
                ],
              ],
            },
          },
        ]),
  }

  const getLocationAlertService = new GetLocationAlertService({
    regionRepository: new InMemoryRegionRepository(),
    forecastProvider,
    officialAlertsProvider,
    floodingMonitorProvider,
    cache,
    enableSimulationParams: true,
    nowFn: () => new Date('2026-11-25T18:00:00Z'),
  })

  return {
    service: new GetPlayerSceneService({
      oohAssetRepository: new InMemoryOohAssetRepository(),
      getLocationAlertService,
      roadGeometryProvider,
      floodSusceptibilityProvider,
      cache,
    }),
    roadGeometryProvider,
    floodSusceptibilityProvider,
  }
}

describe('GetPlayerSceneService', () => {
  it('resolve ativo curado com snapshot OSM, matching CGE-SP por alias e nome editorial do corredor', async () => {
    const { service, roadGeometryProvider } = createDeps()

    const scene = await service.execute({
      assetId: 'av-radial-leste',
      date: '2026-01-16',
      time: '18:15',
    })

    expect(scene.assetId).toBe('av-radial-leste')
    expect(scene.targetKind).toBe('asset')
    expect(scene.editorial.corridorName).toBe('Av. Radial Leste')
    expect(scene.editorial.telemetryModeLabel).toBe('REPLAY • 16/01/2026 18:15')
    expect(scene.sources.roadGeometry).toEqual({
      provider: 'osm-curated-snapshot',
      status: 'ok',
      cached: true,
      stale: false,
      fetchedAt: null,
      error: null,
    })
    expect(roadGeometryProvider.getNearbyRoads).not.toHaveBeenCalled()
    expect(scene.roads.features.length).toBeGreaterThan(0)
    expect(
      scene.roads.features.some(
        (feature) =>
          feature.properties.isPrimaryCorridor &&
          feature.properties.matchedCge &&
          feature.properties.riskIntensity === 1,
      ),
    ).toBe(true)
  })

  it('lança NotFoundError para ativo inexistente', async () => {
    const { service } = createDeps()
    await expect(service.execute({ assetId: 'ativo-inexistente' })).rejects.toThrow(NotFoundError)
  })

  it('resolve coordenadas na Capital SP via Overpass e marca GeoSampa como skipped fora da Capital SP', async () => {
    const { service, floodSusceptibilityProvider } = createDeps()

    const spScene = await service.execute({
      lat: -23.5615,
      lon: -46.6565,
    })

    expect(spScene.targetKind).toBe('coordinates')
    expect(spScene.assetId).toBeNull()
    expect(spScene.sources.roadGeometry.provider).toBe('overpass')
    expect(spScene.sources.roadGeometry.status).toBe('ok')
    expect(spScene.sources.floodSusceptibility.status).toBe('ok')
    expect(spScene.geoSampaZonesCount).toBe(1)
    expect(spScene.roads.features[0].properties.isPrimaryCorridor).toBe(true)
    expect(spScene.roads.features[0].properties.inGeoSampaZone).toBe(true)

    // Campinas (fora da Capital SP) -> GeoSampa skipped
    const campinasScene = await service.execute({
      lat: -22.9099,
      lon: -47.0626,
    })
    expect(campinasScene.sources.floodSusceptibility.status).toBe('skipped')
    expect(campinasScene.geoSampaZonesCount).toBe(0)
    expect(floodSusceptibilityProvider.getFloodZones).toHaveBeenCalledTimes(1)
  })

  it('degrada graciosamente quando Overpass e GeoSampa falham em clique livre', async () => {
    const { service } = createDeps({ failOverpass: true, failGeoSampa: true })

    const scene = await service.execute({
      lat: -23.5615,
      lon: -46.6565,
    })

    expect(scene.roads).toEqual({ type: 'FeatureCollection', features: [] })
    expect(scene.geoSampaZonesCount).toBe(0)
    expect(scene.sources.roadGeometry.status).toBe('error')
    expect(scene.sources.roadGeometry.error).toContain('Overpass timeout')
    expect(scene.sources.floodSusceptibility.status).toBe('error')
    expect(scene.sources.floodSusceptibility.error).toContain('GeoSampa WFS offline')
  })
})
