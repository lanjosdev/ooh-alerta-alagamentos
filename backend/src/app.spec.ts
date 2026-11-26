import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app.js'
import { MemoryCache } from './lib/cache.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from './providers/flooding-monitor-provider.js'
import type {
  FloodSusceptibilityPolygon,
  FloodSusceptibilityProvider,
} from './providers/flood-susceptibility-provider.js'
import type { ForecastProvider } from './providers/forecast-provider.js'
import type { GeocodingProvider } from './providers/geocoding-provider.js'
import type {
  OfficialAlertsProvider,
  OfficialWeatherAlert,
} from './providers/official-alerts-provider.js'
import type { RoadGeometryProvider, RoadSegment } from './providers/road-geometry-provider.js'

function createDeterministicProviders() {
  const forecastProvider: ForecastProvider = {
    providerName: 'open-meteo',
    getHourlyForecast: vi.fn(async (lat, lon) => ({
      provider: 'open-meteo',
      gridLatitude: Number((lat - 0.01).toFixed(4)),
      gridLongitude: Number((lon - 0.01).toFixed(4)),
      timezone: 'America/Sao_Paulo',
      current: {
        observedAt: '2026-11-23T15:00',
        temperatureC: 23.8,
        humidityPercent: 82,
        precipitationMm: lat < -23.56 && lon < -46.72 ? 2.4 : 0,
        rainMm: lat < -23.56 && lon < -46.72 ? 2.4 : 0,
        weatherCode: lat < -23.56 && lon < -46.72 ? 80 : 2,
        isDay: true,
        isRaining: lat < -23.56 && lon < -46.72,
      },
      maxRainProbabilityNext2hPercent: lat < -23.56 && lon < -46.72 ? 85 : 30,
      expectedRainNext2hMm: lat < -23.56 && lon < -46.72 ? 20 : 1,
      peakRainIntensityNext2hMmPerHour: lat < -23.56 && lon < -46.72 ? 16 : 0.8,
      maxRainProbabilityNext6hPercent: 85,
      expectedRainNext6hMm: 22,
      hourly: [
        {
          time: '2026-11-23T15:00',
          precipitationProbabilityPercent: 85,
          precipitationMm: 16,
          weatherCode: 95,
        },
      ],
    })),
    getHistoricalHourly: vi.fn(async (lat, lon, dateIso) => ({
      provider: 'open-meteo-historical',
      dateIso,
      gridLatitude: Number((lat - 0.01).toFixed(4)),
      gridLongitude: Number((lon - 0.01).toFixed(4)),
      timezone: 'America/Sao_Paulo',
      hourly: [
        {
          time: `${dateIso}T20:00`,
          precipitationProbabilityPercent: 90,
          precipitationMm: 20,
          rainMm: 20,
          weatherCode: 95,
          temperatureC: 22.5,
          humidityPercent: 90,
          isDay: false,
        },
      ],
    })),
  }

  const officialAlertsProvider: OfficialAlertsProvider = {
    providerName: 'inmet',
    getActiveAlerts: vi.fn(async (input): Promise<OfficialWeatherAlert[]> => {
      if (input.ibgeCode === '3550308') {
        return [
          {
            id: '56489',
            code: 'urn:oid:sp',
            title: 'Chuvas Intensas',
            severity: 'Perigo Potencial',
            severityRank: 1,
            colorHex: '#FFFE00',
            startsAt: '2026-11-23 09:30',
            endsAt: '2026-11-23 23:59',
            risks: ['Chuva entre 20 e 30 mm/h'],
            instructions: ['Evite áreas sujeitas a alagamentos'],
            matchedBy: ['ibge'],
          },
        ]
      }

      return []
    }),
  }

  const floodingPoints: FloodingPoint[] = [
    {
      zone: 'Zona Oeste',
      neighborhood: 'Butantã',
      street: 'AV CORIFEU DE AZEVEDO MARQUES',
      direction: 'AMBOS',
      reference: 'N 1200',
      timeWindow: 'Desde 16:00',
      status: 'ativo-intransitavel',
      active: true,
      passable: false,
    },
  ]

  const floodingMonitorProvider: FloodingMonitorProvider = {
    providerName: 'cge-sp',
    getFloodingPoints: vi.fn(async () => floodingPoints),
    getStationRainfall: vi.fn(
      async (stationId): Promise<StationRainfall> => ({
        stationId,
        stationName: 'Estação Teste',
        currentPeriodMm: 12.4,
        previousPeriodMm: 3.1,
        recentDeltaMm: null,
        resetTime: '10:00:00',
        temperatureC: 24.5,
        humidityPercent: 82,
      }),
    ),
  }

  const roadGeometryProvider: RoadGeometryProvider = {
    providerName: 'overpass',
    getNearbyRoads: vi.fn(async (): Promise<RoadSegment[]> => [
      {
        osmId: '9901',
        streetName: 'Avenida Paulista',
        highway: 'primary',
        coordinates: [
          [-46.658, -23.562],
          [-46.654, -23.56],
        ],
      },
    ]),
  }

  const floodSusceptibilityProvider: FloodSusceptibilityProvider = {
    providerName: 'geosampa-wfs',
    getFloodZones: vi.fn(async (): Promise<FloodSusceptibilityPolygon[]> => [
      {
        id: 'mancha_teste.1',
        layerName: 'geoportal:mancha_inundacao_25',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-46.6585, -23.5625],
              [-46.6535, -23.5625],
              [-46.6535, -23.5595],
              [-46.6585, -23.5595],
              [-46.6585, -23.5625],
            ],
          ],
        },
      },
    ]),
  }

  const geocodingProvider: GeocodingProvider = {
    providerName: 'nominatim',
    searchAddress: vi.fn(async () => [
      {
        id: 'way:123456',
        displayName: 'Avenida Paulista, Bela Vista, São Paulo, SP, Brasil',
        primaryName: 'Avenida Paulista',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'São Paulo',
        latitude: -23.5614,
        longitude: -46.6559,
      },
    ]),
  }

  return {
    forecastProvider,
    officialAlertsProvider,
    floodingMonitorProvider,
    roadGeometryProvider,
    floodSusceptibilityProvider,
    geocodingProvider,
  }
}

describe('HTTP', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /v1/health retorna 200 com capabilities.simulation no padrão ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      success: true,
      message: null,
      data: {
        status: 'ok',
        capabilities: {
          simulation: expect.any(Boolean),
        },
      },
    })
    expect(typeof response.json().data.uptime).toBe('number')
    expect(typeof response.json().data.timestamp).toBe('string')
  })

  it('rotas sem o prefixo /v1 retornam 404 em ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      success: false,
      message: 'Rota GET /health não encontrada',
      data: null,
    })
  })

  it('rota inexistente retorna 404 no padrão ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nao-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      success: false,
      message: 'Rota GET /v1/nao-existe não encontrada',
      data: null,
    })
  })

  it('gera a documentação OpenAPI em /docs/json com todas as rotas /v1', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' })

    expect(response.statusCode).toBe(200)
    const paths = Object.keys(response.json().paths)
    expect(paths).toContain('/v1/health')
    expect(paths).toContain('/v1/sources/status')
    expect(paths).toContain('/v1/regions')
    expect(paths).toContain('/v1/alerts/regions')
    expect(paths).toContain('/v1/alerts/regions/{regionId}')
    expect(paths).toContain('/v1/alerts/by-coordinates')
    expect(paths).toContain('/v1/alerts/feed.xml')
    expect(paths).toContain('/v1/alerts/regions/{regionId}/feed.xml')
    expect(paths).toContain('/v1/alerts/by-coordinates/feed.xml')
    expect(paths).toContain('/v1/player/assets')
    expect(paths).toContain('/v1/player/geocode')
    expect(paths).toContain('/v1/player/scene')
  })

  it('CORS responde corretamente ao preflight OPTIONS', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/health',
      headers: {
        origin: 'http://ooh-player.test',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://ooh-player.test')
    expect(response.headers['access-control-allow-methods']).toContain('GET')
  })
})

describe('Regions, Alerts and Feeds OOH (Integração Offline)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let stubs: ReturnType<typeof createDeterministicProviders>

  beforeAll(async () => {
    stubs = createDeterministicProviders()
    app = await buildApp({
      ...stubs,
      cache: new MemoryCache(),
      enableSimulationParams: true,
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /v1/sources/status retorna provedores registrados inicialmente como unknown e ok após consultas', async () => {
    const initial = await app.inject({ method: 'GET', url: '/v1/sources/status' })
    expect(initial.statusCode).toBe(200)
    expect(initial.json().data.providers.map((p: { provider: string }) => p.provider)).toEqual([
      'open-meteo',
      'inmet',
      'cge-sp',
      'overpass',
      'geosampa-wfs',
      'nominatim',
    ])
    expect(
      initial.json().data.providers.every((p: { status: string }) => p.status === 'unknown'),
    ).toBe(true)

    await app.inject({ method: 'GET', url: '/v1/alerts/regions/zona-oeste-butanta' })

    const afterAlertsCall = await app.inject({ method: 'GET', url: '/v1/sources/status' })
    expect(afterAlertsCall.statusCode).toBe(200)
    const statusByProvider = Object.fromEntries(
      afterAlertsCall
        .json()
        .data.providers.map((p: { provider: string; status: string }) => [p.provider, p.status]),
    )
    expect(statusByProvider).toEqual({
      'open-meteo': 'ok',
      inmet: 'ok',
      'cge-sp': 'ok',
      overpass: 'unknown',
      'geosampa-wfs': 'unknown',
      nominatim: 'unknown',
    })
  })

  it('GET /v1/regions lista as 12 regiões e aplica filtros por zone e ibgeCode', async () => {
    const all = await app.inject({ method: 'GET', url: '/v1/regions' })
    expect(all.statusCode).toBe(200)
    expect(all.json().data.total).toBe(12)

    const filteredZone = await app.inject({ method: 'GET', url: '/v1/regions?zone=Zona%20Oeste' })
    expect(filteredZone.statusCode).toBe(200)
    expect(filteredZone.json().data.total).toBe(3)

    const emptyIbge = await app.inject({ method: 'GET', url: '/v1/regions?ibgeCode=3509502' })
    expect(emptyIbge.statusCode).toBe(200)
    expect(emptyIbge.json().data.total).toBe(0)
  })

  it('GET /v1/alerts/regions retorna panorama consolidado ordenado por severidade e score', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/alerts/regions' })

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.success).toBe(true)
    expect(body.data.summary.totalRegions).toBe(12)
    expect(body.data.summary.highestSeverityLabel).toBe('CRITICO')
    expect(body.data.regions[0].severityLevel).toBe(3)
    expect(body.data.regions[0].location.zone).toBe('Zona Oeste')
  })

  it('GET /v1/alerts/regions/:regionId retorna 200 para região válida e 404 para inexistente', async () => {
    const ok = await app.inject({ method: 'GET', url: '/v1/alerts/regions/zona-oeste-butanta' })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().data).toMatchObject({
      severityLevel: 3,
      severityLabel: 'CRITICO',
      triggerOverride: true,
      location: {
        id: 'zona-oeste-butanta',
        zone: 'Zona Oeste',
        cgeStationId: '1000842',
      },
    })

    const notFound = await app.inject({ method: 'GET', url: '/v1/alerts/regions/inexistente' })
    expect(notFound.statusCode).toBe(404)
    expect(notFound.json()).toMatchObject({
      success: false,
      data: null,
    })
  })

  it('GET /v1/alerts/by-coordinates resolve SP Capital (Vila Leopoldina -> Lapa) e multi-município (Campinas -> CGE skipped)', async () => {
    const spCoord = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates?lat=-23.5317&lon=-46.7294',
    })
    expect(spCoord.statusCode).toBe(200)
    expect(spCoord.json().data.location).toMatchObject({
      ibgeCode: '3550308',
      zone: 'Zona Oeste',
      cgeStationId: '1000848',
      cgeStationName: 'Lapa',
    })
    expect(spCoord.json().data.sources.floodingMonitor.status).toBe('ok')

    const campinasCoord = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates?lat=-22.9099&lon=-47.0626',
    })
    expect(campinasCoord.statusCode).toBe(200)
    expect(campinasCoord.json().data.location).toMatchObject({
      ibgeCode: null,
      zone: null,
      cgeStationId: null,
    })
    expect(campinasCoord.json().data.sources.floodingMonitor.status).toBe('skipped')

    const invalidEmpty = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates?lat=&lon=-46.63',
    })
    expect(invalidEmpty.statusCode).toBe(400)

    const outOfRange = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates?lat=95&lon=-46.63',
    })
    expect(outOfRange.statusCode).toBe(400)
  })

  it('suporta simulação e cgeDate quando habilitado e rejeita formato inválido de data', async () => {
    const simulated = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/centro-se?simulate=critical&cgeDate=15/01/2026',
    })
    expect(simulated.statusCode).toBe(200)
    expect(simulated.json().data).toMatchObject({
      simulated: true,
      severityLevel: 3,
      severityLabel: 'CRITICO',
      flooding: {
        cgeDate: '15/01/2026',
      },
    })

    const badDate = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/centro-se?cgeDate=2026-01-15',
    })
    expect(badDate.statusCode).toBe(400)
  })

  it('rejeita simulate com 400 quando ENABLE_SIMULATION_PARAMS=false, mas mantém date/cgeDate habilitados', async () => {
    const lockedApp = await buildApp({
      ...createDeterministicProviders(),
      cache: new MemoryCache(),
      enableSimulationParams: false,
    })
    await lockedApp.ready()

    try {
      const healthRes = await lockedApp.inject({ method: 'GET', url: '/v1/health' })
      expect(healthRes.statusCode).toBe(200)
      expect(healthRes.json().data.capabilities).toEqual({ simulation: false })

      const resSim = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?simulate=critical',
      })
      expect(resSim.statusCode).toBe(400)

      const resHistorical = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?date=2025-01-24&time=20:00',
      })
      expect(resHistorical.statusCode).toBe(200)
      expect(resHistorical.json().data.temporal).toMatchObject({
        mode: 'historical',
        date: '2025-01-24',
        time: '20:00',
        resolvedTime: '20:00',
      })
      expect(resHistorical.json().data.sources.officialAlerts.status).toBe('skipped')

      const resCgeDate = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?cgeDate=15/01/2026',
      })
      expect(resCgeDate.statusCode).toBe(200)
      expect(resCgeDate.json().data.flooding.cgeDate).toBe('15/01/2026')

      const resFutureDate = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?date=2099-01-01',
      })
      expect(resFutureDate.statusCode).toBe(400)

      const resTimeWithoutDate = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?time=20:00',
      })
      expect(resTimeWithoutDate.statusCode).toBe(400)

      const resBothDates = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?date=2025-01-24&cgeDate=24/01/2025',
      })
      expect(resBothDates.statusCode).toBe(400)
    } finally {
      await lockedApp.close()
    }
  })

  it('rejeita date e time com HTTP 400 em todos os feeds /feed.xml', async () => {
    const overviewWithDate = await app.inject({
      method: 'GET',
      url: '/v1/alerts/feed.xml?date=2025-01-24',
    })
    expect(overviewWithDate.statusCode).toBe(400)

    const regionWithTime = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/centro-se/feed.xml?date=2025-01-24&time=20:00',
    })
    expect(regionWithTime.statusCode).toBe(400)

    const coordsWithDate = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates/feed.xml?lat=-23.55&lon=-46.63&date=2025-01-24',
    })
    expect(coordsWithDate.statusCode).toBe(400)
  })

  it('entrega feeds XML RSS 2.0 puros em todas as rotas /feed.xml e 404 para região inexistente', async () => {
    const overviewFeed = await app.inject({ method: 'GET', url: '/v1/alerts/feed.xml' })
    expect(overviewFeed.statusCode).toBe(200)
    expect(overviewFeed.headers['content-type']).toBe('application/rss+xml; charset=utf-8')
    expect(overviewFeed.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(overviewFeed.body).toContain('xmlns:ooh="https://ooh-alerta-alagamentos.local/ns/1.0"')
    expect(overviewFeed.body).toContain('<ooh:triggerOverride>true</ooh:triggerOverride>')
    expect(overviewFeed.body.match(/<item>/g)).toHaveLength(12)

    const regionFeed = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/zona-oeste-butanta/feed.xml',
    })
    expect(regionFeed.statusCode).toBe(200)
    expect(regionFeed.headers['content-type']).toBe('application/rss+xml; charset=utf-8')
    expect(regionFeed.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(regionFeed.body).toContain('<ooh:regionId>zona-oeste-butanta</ooh:regionId>')
    expect(regionFeed.body).toContain('<ooh:isRainingNow>true</ooh:isRainingNow>')
    expect(regionFeed.body.match(/<item>/g)).toHaveLength(1)

    const coordFeed = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates/feed.xml?lat=-23.5317&lon=-46.7294',
    })
    expect(coordFeed.statusCode).toBe(200)
    expect(coordFeed.headers['content-type']).toBe('application/rss+xml; charset=utf-8')
    expect(coordFeed.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(coordFeed.body).toContain('<ooh:zone>Zona Oeste</ooh:zone>')

    const notFoundFeed = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/inexistente/feed.xml',
    })
    expect(notFoundFeed.statusCode).toBe(404)
    expect(notFoundFeed.json()).toMatchObject({ success: false, data: null })
  })
})

describe('Player DOOH (/v1/player/* — Integração Offline)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({
      ...createDeterministicProviders(),
      cache: new MemoryCache(),
      enableSimulationParams: true,
    })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /v1/player/assets lista os 7 ativos curados com severidade e bounds da câmera', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/player/assets' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data.total).toBe(7)
    expect(body.data.assets).toHaveLength(7)
    expect(body.data.assets[0]).toMatchObject({
      id: 'av-roberto-marinho',
      corridorName: 'Av. Jornalista Roberto Marinho',
      camera: {
        center: [expect.any(Number), expect.any(Number)],
        bounds: [
          [expect.any(Number), expect.any(Number)],
          [expect.any(Number), expect.any(Number)],
        ],
      },
    })
  })

  it('GET /v1/player/geocode busca endereços e valida tamanho de q (3..120 chars)', async () => {
    const okRes = await app.inject({
      method: 'GET',
      url: '/v1/player/geocode?q=Avenida%20Paulista',
    })
    expect(okRes.statusCode).toBe(200)
    expect(okRes.json().data).toMatchObject({
      query: 'Avenida Paulista',
      total: 1,
      candidates: [
        {
          id: 'way:123456',
          primaryName: 'Avenida Paulista',
        },
      ],
    })

    const shortRes = await app.inject({ method: 'GET', url: '/v1/player/geocode?q=ab' })
    expect(shortRes.statusCode).toBe(400)

    const longQuery = 'a'.repeat(121)
    const longRes = await app.inject({
      method: 'GET',
      url: `/v1/player/geocode?q=${longQuery}`,
    })
    expect(longRes.statusCode).toBe(400)
  })

  it('GET /v1/player/scene entrega cena completa para ativo curado, replay histórico e rejeita XOR inválido / ativo inexistente', async () => {
    const assetScene = await app.inject({
      method: 'GET',
      url: '/v1/player/scene?assetId=av-roberto-marinho&date=2025-01-24&time=20:30',
    })
    expect(assetScene.statusCode).toBe(200)
    expect(assetScene.json().data).toMatchObject({
      assetId: 'av-roberto-marinho',
      targetKind: 'asset',
      editorial: {
        corridorName: 'Av. Jornalista Roberto Marinho',
        telemetryModeLabel: 'REPLAY • 24/01/2025 20:30',
        telemetryStatusPill: 'REPLAY HISTÓRICO',
      },
      decision: {
        temporal: {
          mode: 'historical',
          date: '2025-01-24',
          time: '20:30',
          resolvedTime: '20:30',
        },
      },
      sources: {
        roadGeometry: { provider: 'osm-curated-snapshot', status: 'ok' },
        floodSusceptibility: { provider: 'geosampa-wfs', status: 'ok' },
      },
    })
    expect(assetScene.json().data.roads.features.length).toBeGreaterThan(0)

    const coordScene = await app.inject({
      method: 'GET',
      url: '/v1/player/scene?lat=-23.5614&lon=-46.6559',
    })
    expect(coordScene.statusCode).toBe(200)
    expect(coordScene.json().data).toMatchObject({
      assetId: null,
      targetKind: 'coordinates',
      sources: {
        roadGeometry: { provider: 'overpass', status: 'ok' },
        floodSusceptibility: { provider: 'geosampa-wfs', status: 'ok' },
      },
    })

    const notFound = await app.inject({
      method: 'GET',
      url: '/v1/player/scene?assetId=nao-existe',
    })
    expect(notFound.statusCode).toBe(404)

    const bothParams = await app.inject({
      method: 'GET',
      url: '/v1/player/scene?assetId=av-roberto-marinho&lat=-23.56&lon=-46.65',
    })
    expect(bothParams.statusCode).toBe(400)

    const missingTarget = await app.inject({
      method: 'GET',
      url: '/v1/player/scene',
    })
    expect(missingTarget.statusCode).toBe(400)
  })

  it('GET /v1/player/scene retorna HTTP 200 degradado com roads.features=[] quando Overpass falha totalmente', async () => {
    const stubs = createDeterministicProviders()
    vi.mocked(stubs.roadGeometryProvider.getNearbyRoads).mockRejectedValue(
      new Error('Todos os mirrors Overpass falharam (502)'),
    )

    const degradedApp = await buildApp({
      ...stubs,
      cache: new MemoryCache(),
      enableSimulationParams: true,
    })
    await degradedApp.ready()

    try {
      const res = await degradedApp.inject({
        method: 'GET',
        url: '/v1/player/scene?lat=-23.5614&lon=-46.6559',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().data.roads).toEqual({
        type: 'FeatureCollection',
        features: [],
      })
      expect(res.json().data.sources.roadGeometry).toMatchObject({
        provider: 'overpass',
        status: 'error',
        error: 'Todos os mirrors Overpass falharam (502)',
      })
    } finally {
      await degradedApp.close()
    }
  })
})
