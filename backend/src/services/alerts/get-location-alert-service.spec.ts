import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from '../../lib/cache.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from '../../providers/flooding-monitor-provider.js'
import type {
  ForecastProvider,
  HistoricalForecastDay,
  RegionForecast,
} from '../../providers/forecast-provider.js'
import type {
  OfficialAlertsProvider,
  OfficialWeatherAlert,
} from '../../providers/official-alerts-provider.js'
import { InMemoryRegionRepository } from '../../repositories/in-memory/in-memory-region-repository.js'
import { BadRequestError, NotFoundError } from '../../utils/application-error.js'
import { GetLocationAlertService } from './get-location-alert-service.js'

function createStubProviders() {
  const forecastData: RegionForecast = {
    provider: 'open-meteo',
    gridLatitude: -23.58,
    gridLongitude: -46.75,
    timezone: 'America/Sao_Paulo',
    current: null,
    maxRainProbabilityNext2hPercent: 80,
    expectedRainNext2hMm: 18,
    peakRainIntensityNext2hMmPerHour: 12,
    maxRainProbabilityNext6hPercent: 80,
    expectedRainNext6hMm: 22,
    hourly: [],
  }

  const officialAlertsData: OfficialWeatherAlert[] = [
    {
      id: '56489',
      code: 'urn:oid:test',
      title: 'Chuvas Intensas',
      severity: 'Perigo Potencial',
      severityRank: 1,
      colorHex: '#FFFE00',
      startsAt: '2026-11-23 09:30',
      endsAt: '2026-11-23 23:59',
      risks: ['Alagamento'],
      instructions: ['Evite áreas de risco'],
      matchedBy: ['ibge'],
    },
  ]

  const floodingPointsData: FloodingPoint[] = [
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
    {
      zone: 'Zona Norte',
      neighborhood: 'Santana',
      street: 'AV CRUZEIRO DO SUL',
      direction: 'AMBOS',
      reference: 'METRO',
      timeWindow: 'Desde 16:05',
      status: 'ativo-intransitavel',
      active: true,
      passable: false,
    },
  ]

  const stationData: StationRainfall = {
    stationId: '1000842',
    stationName: 'Butantã',
    currentPeriodMm: 14.2,
    previousPeriodMm: 4.0,
    recentDeltaMm: null,
    resetTime: '10:00:00',
    temperatureC: 23.4,
    humidityPercent: 88,
  }

  const historicalDay: HistoricalForecastDay = {
    provider: 'open-meteo-historical',
    dateIso: '2025-01-24',
    gridLatitude: -23.58,
    gridLongitude: -46.75,
    timezone: 'America/Sao_Paulo',
    hourly: [
      {
        time: '2025-01-24T12:00',
        precipitationProbabilityPercent: 10,
        precipitationMm: 0,
        rainMm: 0,
        weatherCode: 2,
        temperatureC: 28,
        humidityPercent: 55,
        isDay: true,
      },
      {
        time: '2025-01-24T19:00',
        precipitationProbabilityPercent: 80,
        precipitationMm: 6.5,
        rainMm: 6.5,
        weatherCode: 80,
        temperatureC: 24,
        humidityPercent: 84,
        isDay: false,
      },
      {
        time: '2025-01-24T20:00',
        precipitationProbabilityPercent: 95,
        precipitationMm: 22.0,
        rainMm: 22.0,
        weatherCode: 95,
        temperatureC: 22,
        humidityPercent: 92,
        isDay: false,
      },
      {
        time: '2025-01-24T21:00',
        precipitationProbabilityPercent: 70,
        precipitationMm: 4.0,
        rainMm: 4.0,
        weatherCode: 61,
        temperatureC: 21.5,
        humidityPercent: 90,
        isDay: false,
      },
    ],
  }

  const forecastProvider: ForecastProvider = {
    providerName: 'open-meteo',
    getHourlyForecast: vi.fn(async () => forecastData),
    getHistoricalHourly: vi.fn(async (_lat, _lon, dateIso) => ({
      ...historicalDay,
      dateIso,
      hourly: historicalDay.hourly.map((point) => ({
        ...point,
        time: `${dateIso}${point.time.slice(10)}`,
      })),
    })),
  }

  const officialAlertsProvider: OfficialAlertsProvider = {
    providerName: 'inmet',
    getActiveAlerts: vi.fn(async () => officialAlertsData),
  }

  const floodingMonitorProvider: FloodingMonitorProvider = {
    providerName: 'cge-sp',
    getFloodingPoints: vi.fn(async () => floodingPointsData),
    getStationRainfall: vi.fn(async (stationId: string) => ({
      ...stationData,
      stationId,
    })),
  }

  return {
    forecastProvider,
    officialAlertsProvider,
    floodingMonitorProvider,
  }
}

describe('GetLocationAlertService', () => {
  it('consulta região existente, filtra alagamentos pela zona e cruza todas as fontes', async () => {
    const stubs = createStubProviders()
    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      enableSimulationParams: true,
      ...stubs,
    })

    const decision = await service.execute({ mode: 'region', regionId: 'zona-oeste-butanta' })

    expect(decision.location).toMatchObject({
      id: 'zona-oeste-butanta',
      zone: 'Zona Oeste',
      cgeStationId: '1000842',
      cgeStationName: 'Butantã',
    })
    expect(decision.severityLevel).toBe(3)
    expect(decision.severityLabel).toBe('CRITICO')
    expect(decision.triggerOverride).toBe(true)
    expect(decision.flooding.activeInZoneCount).toBe(1)
    expect(decision.flooding.pointsInZone.map((p) => p.street)).toEqual([
      'AV CORIFEU DE AZEVEDO MARQUES',
    ])
    expect(decision.sources.forecast.status).toBe('ok')
    expect(decision.sources.officialAlerts.status).toBe('ok')
    expect(decision.sources.floodingMonitor.status).toBe('ok')
  })

  it('lança NotFoundError para região inexistente', async () => {
    const stubs = createStubProviders()
    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      ...stubs,
    })

    await expect(service.execute({ mode: 'region', regionId: 'desconhecida' })).rejects.toThrow(
      NotFoundError,
    )
  })

  it('resolve coordenadas em bairro da Capital SP (Vila Leopoldina) para estação Lapa e aciona CGE-SP', async () => {
    const stubs = createStubProviders()
    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      ...stubs,
    })

    const decision = await service.execute({
      mode: 'coordinates',
      lat: -23.5317,
      lon: -46.7294,
    })

    expect(decision.location).toMatchObject({
      ibgeCode: '3550308',
      zone: 'Zona Oeste',
      cgeStationId: '1000848',
      cgeStationName: 'Lapa',
      historicalRiskWeight: 0.9,
    })
    expect(stubs.floodingMonitorProvider.getFloodingPoints).toHaveBeenCalledTimes(1)
    expect(stubs.floodingMonitorProvider.getStationRainfall).toHaveBeenCalledWith('1000848')
    expect(decision.sources.floodingMonitor.status).toBe('ok')
  })

  it('executa em modo multi-município fora da Capital SP sem chamar CGE-SP (status skipped)', async () => {
    const stubs = createStubProviders()
    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      ...stubs,
    })

    const decision = await service.execute({
      mode: 'coordinates',
      lat: -22.9099,
      lon: -47.0626,
    })

    expect(decision.location).toMatchObject({
      ibgeCode: null,
      zone: null,
      cgeStationId: null,
      historicalRiskWeight: 0.5,
    })
    expect(stubs.floodingMonitorProvider.getFloodingPoints).not.toHaveBeenCalled()
    expect(stubs.floodingMonitorProvider.getStationRainfall).not.toHaveBeenCalled()
    expect(decision.sources.floodingMonitor.status).toBe('skipped')
    expect(decision.sources.forecast.status).toBe('ok')
    expect(decision.sources.officialAlerts.status).toBe('ok')
  })

  it('bloqueia apenas simulate quando ENABLE_SIMULATION_PARAMS=false, mantendo replay histórico sempre habilitado', async () => {
    const stubs = createStubProviders()
    const disabledService = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      enableSimulationParams: false,
      nowFn: () => new Date('2026-11-25T15:00:00Z'),
      ...stubs,
    })

    await expect(
      disabledService.execute({
        mode: 'region',
        regionId: 'centro-se',
        simulate: 'critical',
      }),
    ).rejects.toThrow(BadRequestError)

    const historicalAllowed = await disabledService.execute({
      mode: 'region',
      regionId: 'centro-se',
      cgeDate: '15/01/2026',
    })
    expect(historicalAllowed.temporal.mode).toBe('historical')
    expect(historicalAllowed.temporal.date).toBe('2026-01-15')
    expect(historicalAllowed.flooding.cgeDate).toBe('15/01/2026')

    const enabledService = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      enableSimulationParams: true,
      nowFn: () => new Date('2026-11-25T15:00:00Z'),
      ...stubs,
    })

    const simulated = await enabledService.execute({
      mode: 'region',
      regionId: 'centro-se',
      simulate: 'critical',
      cgeDate: '15/01/2026',
    })

    expect(simulated.simulated).toBe(true)
    expect(simulated.temporal.mode).toBe('simulated')
    expect(simulated.severityLevel).toBe(3)
    expect(simulated.flooding.cgeDate).toBe('15/01/2026')
  })

  it('reconstrói replay histórico com date/time, isola caches e marca INMET e estação CGE como skipped/null', async () => {
    const stubs = createStubProviders()
    vi.mocked(stubs.floodingMonitorProvider.getFloodingPoints).mockResolvedValue([
      {
        zone: 'Zona Oeste',
        neighborhood: 'Pinheiros',
        street: 'AV MARGINAL PINHEIROS',
        direction: 'AMBOS',
        reference: 'PTE ESTAIADA',
        timeWindow: 'De 19:50 a 21:15',
        status: 'inativo-intransitavel',
        active: false,
        passable: false,
      },
    ])

    const cache = new MemoryCache()
    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache,
      enableSimulationParams: false,
      nowFn: () => new Date('2026-11-25T15:00:00Z'),
      ...stubs,
    })

    // Sem time: resolve automaticamente para o minuto de pico do CGE (19:50)
    const peakDecision = await service.execute({
      mode: 'region',
      regionId: 'zona-oeste-pinheiros',
      date: '2025-01-24',
    })

    expect(peakDecision.temporal).toEqual({
      mode: 'historical',
      date: '2025-01-24',
      time: null,
      resolvedTime: '19:50',
      referenceAt: '2025-01-24T19:50:00-03:00',
    })
    expect(peakDecision.flooding.cgeDate).toBe('24/01/2025')
    expect(peakDecision.flooding.activeInZoneCount).toBe(1)
    expect(peakDecision.flooding.pointsInZone[0].status).toBe('ativo-intransitavel')
    expect(peakDecision.flooding.stationRainfall).toBeNull()
    expect(peakDecision.officialAlerts).toEqual([])
    expect(peakDecision.sources.officialAlerts.status).toBe('skipped')
    expect(peakDecision.sources.forecast.provider).toBe('open-meteo-historical')
    expect(stubs.floodingMonitorProvider.getStationRainfall).not.toHaveBeenCalled()
    expect(stubs.officialAlertsProvider.getActiveAlerts).not.toHaveBeenCalled()

    // Isolamento: saúde do provedor em tempo real não foi alterada pela consulta histórica
    expect(cache.getProviderHealth('open-meteo').status).toBe('unknown')
    expect(cache.getProviderHealth('open-meteo-historical').status).toBe('ok')

    // Fora da janela (18:00): ponto CGE permanece inativo-intransitavel
    const offWindowDecision = await service.execute({
      mode: 'region',
      regionId: 'zona-oeste-pinheiros',
      date: '2025-01-24',
      time: '18:00',
    })
    expect(offWindowDecision.temporal.resolvedTime).toBe('18:00')
    expect(offWindowDecision.flooding.activeInZoneCount).toBe(0)
    expect(offWindowDecision.flooding.pointsInZone[0].status).toBe('inativo-intransitavel')
  })

  it('quando CGE histórico está vazio no dia, usa pico de precipitação Open-Meteo (ou 12:00 se seco)', async () => {
    const stubs = createStubProviders()
    vi.mocked(stubs.floodingMonitorProvider.getFloodingPoints).mockResolvedValue([])

    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      nowFn: () => new Date('2026-11-25T15:00:00Z'),
      ...stubs,
    })

    const rainyPeak = await service.execute({
      mode: 'region',
      regionId: 'centro-se',
      date: '2025-01-24',
    })
    expect(rainyPeak.temporal.resolvedTime).toBe('20:00')

    vi.mocked(stubs.forecastProvider.getHistoricalHourly!).mockResolvedValueOnce({
      provider: 'open-meteo-historical',
      dateIso: '2025-01-10',
      gridLatitude: -23.55,
      gridLongitude: -46.63,
      timezone: 'America/Sao_Paulo',
      hourly: [
        {
          time: '2025-01-10T10:00',
          precipitationProbabilityPercent: 0,
          precipitationMm: 0,
          rainMm: 0,
          weatherCode: 1,
          temperatureC: 27,
          humidityPercent: 55,
          isDay: true,
        },
      ],
    })

    const dryDay = await service.execute({
      mode: 'region',
      regionId: 'centro-se',
      date: '2025-01-10',
    })
    expect(dryDay.temporal.resolvedTime).toBe('12:00')
  })

  it('rejeita date no futuro, time sem date e date+cgeDate juntos com BadRequestError', async () => {
    const stubs = createStubProviders()
    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      nowFn: () => new Date('2026-11-25T15:00:00Z'),
      ...stubs,
    })

    await expect(
      service.execute({ mode: 'region', regionId: 'centro-se', date: '2026-12-01' }),
    ).rejects.toThrow(BadRequestError)

    await expect(
      service.execute({ mode: 'region', regionId: 'centro-se', time: '20:00' }),
    ).rejects.toThrow(BadRequestError)

    await expect(
      service.execute({
        mode: 'region',
        regionId: 'centro-se',
        date: '2025-01-24',
        cgeDate: '24/01/2025',
      }),
    ).rejects.toThrow(BadRequestError)
  })

  it('degrada graciosamente quando um provedor falha sem derrubar os demais dados', async () => {
    const stubs = createStubProviders()
    vi.mocked(stubs.officialAlertsProvider.getActiveAlerts).mockRejectedValueOnce(
      new Error('INMET timeout'),
    )

    const service = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      ...stubs,
    })

    const decision = await service.execute({ mode: 'region', regionId: 'zona-oeste-butanta' })

    expect(decision.sources.officialAlerts).toMatchObject({
      provider: 'inmet',
      status: 'error',
      error: 'INMET timeout',
    })
    expect(decision.officialAlerts).toEqual([])
    expect(decision.sources.forecast.status).toBe('ok')
    expect(decision.sources.floodingMonitor.status).toBe('ok')
    expect(decision.severityLevel).toBe(3)
  })
})
