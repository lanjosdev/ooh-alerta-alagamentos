import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from '../../lib/cache.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from '../../providers/flooding-monitor-provider.js'
import type { ForecastProvider, RegionForecast } from '../../providers/forecast-provider.js'
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
    resetTime: '10:00:00',
    temperatureC: 23.4,
    humidityPercent: 88,
  }

  const forecastProvider: ForecastProvider = {
    providerName: 'open-meteo',
    getHourlyForecast: vi.fn(async () => forecastData),
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

  it('bloqueia cgeDate/simulate quando ENABLE_SIMULATION_PARAMS=false e permite quando true', async () => {
    const stubs = createStubProviders()
    const disabledService = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      enableSimulationParams: false,
      ...stubs,
    })

    await expect(
      disabledService.execute({
        mode: 'region',
        regionId: 'centro-se',
        simulate: 'critical',
      }),
    ).rejects.toThrow(BadRequestError)

    await expect(
      disabledService.execute({
        mode: 'region',
        regionId: 'centro-se',
        cgeDate: '15/01/2026',
      }),
    ).rejects.toThrow(BadRequestError)

    const enabledService = new GetLocationAlertService({
      regionRepository: new InMemoryRegionRepository(),
      cache: new MemoryCache(),
      enableSimulationParams: true,
      ...stubs,
    })

    const simulated = await enabledService.execute({
      mode: 'region',
      regionId: 'centro-se',
      simulate: 'critical',
      cgeDate: '15/01/2026',
    })

    expect(simulated.simulated).toBe(true)
    expect(simulated.severityLevel).toBe(3)
    expect(simulated.flooding.cgeDate).toBe('15/01/2026')
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
