import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildApp } from './app.js'
import { MemoryCache } from './lib/cache.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from './providers/flooding-monitor-provider.js'
import type { ForecastProvider } from './providers/forecast-provider.js'
import type {
  OfficialAlertsProvider,
  OfficialWeatherAlert,
} from './providers/official-alerts-provider.js'

function createDeterministicProviders() {
  const forecastProvider: ForecastProvider = {
    providerName: 'open-meteo',
    getHourlyForecast: vi.fn(async (lat, lon) => ({
      provider: 'open-meteo',
      gridLatitude: Number((lat - 0.01).toFixed(4)),
      gridLongitude: Number((lon - 0.01).toFixed(4)),
      timezone: 'America/Sao_Paulo',
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
        resetTime: '10:00:00',
        temperatureC: 24.5,
        humidityPercent: 82,
      }),
    ),
  }

  return {
    forecastProvider,
    officialAlertsProvider,
    floodingMonitorProvider,
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

  it('GET /v1/health retorna 200 no padrão ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      success: true,
      message: null,
      data: {
        status: 'ok',
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
    ])

    await app.inject({ method: 'GET', url: '/v1/alerts/regions/zona-oeste-butanta' })

    const afterCall = await app.inject({ method: 'GET', url: '/v1/sources/status' })
    expect(afterCall.statusCode).toBe(200)
    expect(
      afterCall.json().data.providers.every((p: { status: string }) => p.status === 'ok'),
    ).toBe(true)
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

  it('rejeita simulate e cgeDate com 400 quando ENABLE_SIMULATION_PARAMS=false', async () => {
    const lockedApp = await buildApp({
      ...createDeterministicProviders(),
      cache: new MemoryCache(),
      enableSimulationParams: false,
    })
    await lockedApp.ready()

    try {
      const resSim = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?simulate=critical',
      })
      expect(resSim.statusCode).toBe(400)

      const resDate = await lockedApp.inject({
        method: 'GET',
        url: '/v1/alerts/regions/centro-se?cgeDate=15/01/2026',
      })
      expect(resDate.statusCode).toBe(400)
    } finally {
      await lockedApp.close()
    }
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
