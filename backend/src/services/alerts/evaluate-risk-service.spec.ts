import { describe, expect, it } from 'vitest'
import type { FloodingPoint } from '../../providers/flooding-monitor-provider.js'
import type { RegionForecast } from '../../providers/forecast-provider.js'
import type { OfficialWeatherAlert } from '../../providers/official-alerts-provider.js'
import { EvaluateRiskService } from './evaluate-risk-service.js'

function makeForecast(overrides: Partial<RegionForecast> = {}): RegionForecast {
  return {
    provider: 'open-meteo',
    gridLatitude: -23.56,
    gridLongitude: -46.72,
    timezone: 'America/Sao_Paulo',
    maxRainProbabilityNext2hPercent: 10,
    expectedRainNext2hMm: 0,
    peakRainIntensityNext2hMmPerHour: 0,
    maxRainProbabilityNext6hPercent: 20,
    expectedRainNext6hMm: 0,
    hourly: [],
    ...overrides,
  }
}

function makeFloodingPoint(overrides: Partial<FloodingPoint> = {}): FloodingPoint {
  return {
    zone: 'Zona Oeste',
    neighborhood: 'Butantã',
    street: 'AV VITAL BRASIL',
    direction: 'AMBOS',
    reference: 'METRO',
    timeWindow: 'Desde 16:00',
    status: 'ativo-intransitavel',
    active: true,
    passable: false,
    ...overrides,
  }
}

function makeOfficialAlert(rank: 1 | 2 | 3): OfficialWeatherAlert {
  return {
    id: `alert-${rank}`,
    code: `code-${rank}`,
    title: 'Tempestade',
    severity: rank === 3 ? 'Grande Perigo' : rank === 2 ? 'Perigo' : 'Perigo Potencial',
    severityRank: rank,
    colorHex: '#FF9900',
    startsAt: '2026-11-23 12:00',
    endsAt: '2026-11-23 23:59',
    risks: ['Alagamentos'],
    instructions: ['Evite áreas de risco'],
    matchedBy: ['ibge'],
  }
}

describe('EvaluateRiskService', () => {
  const service = new EvaluateRiskService()

  it('classifica nível 0 (NORMAL) quando nenhum critério é atingido e ignora alagamento inativo', () => {
    const result = service.execute({
      forecast: makeForecast({ maxRainProbabilityNext2hPercent: 40, peakRainIntensityNext2hMmPerHour: 2 }),
      officialAlerts: [],
      floodingPointsInZone: [
        makeFloodingPoint({ status: 'inativo-intransitavel', active: false, passable: false }),
      ],
      stationRainfall: {
        stationId: '1000842',
        stationName: 'Butantã',
        currentPeriodMm: 2.5,
        previousPeriodMm: 0,
        resetTime: '10:00:00',
        temperatureC: 24,
        humidityPercent: 75,
      },
      historicalRiskWeight: 0.8,
    })

    expect(result.severityLevel).toBe(0)
    expect(result.severityLabel).toBe('NORMAL')
    expect(result.triggerOverride).toBe(false)
    expect(result.simulated).toBe(false)
    expect(result.riskScore).toBeGreaterThanOrEqual(0)
    expect(result.riskScore).toBeLessThanOrEqual(29)
  })

  it('classifica nível 1 (ATENCAO) por previsão moderada (>=60% e >=5 mm/h) ou INMET rank 1', () => {
    const byForecast = service.execute({
      forecast: makeForecast({ maxRainProbabilityNext2hPercent: 60, peakRainIntensityNext2hMmPerHour: 5 }),
      officialAlerts: [],
      floodingPointsInZone: [],
      stationRainfall: null,
      historicalRiskWeight: 0.75,
    })

    expect(byForecast).toMatchObject({
      severityLevel: 1,
      severityLabel: 'ATENCAO',
      triggerOverride: true,
    })
    expect(byForecast.riskScore).toBeGreaterThanOrEqual(30)
    expect(byForecast.riskScore).toBeLessThanOrEqual(59)

    const byInmet = service.execute({
      forecast: null,
      officialAlerts: [makeOfficialAlert(1)],
      floodingPointsInZone: [],
      stationRainfall: null,
      historicalRiskWeight: 0.5,
    })

    expect(byInmet.severityLevel).toBe(1)
    expect(byInmet.triggerOverride).toBe(true)
  })

  it('classifica nível 2 (ALERTA) por alagamento ativo transitável, chuva CGE >=20mm, previsão forte ou INMET >=2', () => {
    const byPassableFlood = service.execute({
      forecast: null,
      officialAlerts: [],
      floodingPointsInZone: [
        makeFloodingPoint({ status: 'ativo-transitavel', active: true, passable: true }),
      ],
      stationRainfall: null,
      historicalRiskWeight: 0.8,
    })
    expect(byPassableFlood).toMatchObject({
      severityLevel: 2,
      severityLabel: 'ALERTA',
      triggerOverride: true,
    })

    const byStationRain = service.execute({
      forecast: makeForecast(),
      officialAlerts: [],
      floodingPointsInZone: [],
      stationRainfall: {
        stationId: '503',
        stationName: 'Sé / Centro',
        currentPeriodMm: 22,
        previousPeriodMm: 0,
        resetTime: '10:00:00',
        temperatureC: 22,
        humidityPercent: 90,
      },
      historicalRiskWeight: 0.85,
    })
    expect(byStationRain.severityLevel).toBe(2)

    const byHeavyForecast = service.execute({
      forecast: makeForecast({ maxRainProbabilityNext2hPercent: 65, peakRainIntensityNext2hMmPerHour: 15 }),
      officialAlerts: [],
      floodingPointsInZone: [],
      stationRainfall: null,
      historicalRiskWeight: 0.7,
    })
    expect(byHeavyForecast.severityLevel).toBe(2)

    const byInmet = service.execute({
      forecast: null,
      officialAlerts: [makeOfficialAlert(2)],
      floodingPointsInZone: [],
      stationRainfall: null,
      historicalRiskWeight: 0.5,
    })
    expect(byInmet.severityLevel).toBe(2)
    expect(byInmet.riskScore).toBeGreaterThanOrEqual(60)
    expect(byInmet.riskScore).toBeLessThanOrEqual(84)
  })

  it('classifica nível 3 (CRITICO) por alagamento ativo intransitável ou CGE >=40mm + previsão >=10mm/h', () => {
    const byImpassable = service.execute({
      forecast: makeForecast(),
      officialAlerts: [],
      floodingPointsInZone: [makeFloodingPoint({ status: 'ativo-intransitavel', active: true, passable: false })],
      stationRainfall: null,
      historicalRiskWeight: 0.9,
    })
    expect(byImpassable).toMatchObject({
      severityLevel: 3,
      severityLabel: 'CRITICO',
      triggerOverride: true,
    })
    expect(byImpassable.riskScore).toBeGreaterThanOrEqual(85)

    const byCombinedRain = service.execute({
      forecast: makeForecast({ maxRainProbabilityNext2hPercent: 90, peakRainIntensityNext2hMmPerHour: 10 }),
      officialAlerts: [],
      floodingPointsInZone: [],
      stationRainfall: {
        stationId: '1000848',
        stationName: 'Lapa',
        currentPeriodMm: 40,
        previousPeriodMm: 5,
        resetTime: '10:00:00',
        temperatureC: 21,
        humidityPercent: 98,
      },
      historicalRiskWeight: 0.9,
    })
    expect(byCombinedRain.severityLevel).toBe(3)
    expect(byCombinedRain.riskScore).toBeGreaterThanOrEqual(85)
    expect(byCombinedRain.riskScore).toBeLessThanOrEqual(100)
  })

  it('suporta todos os modos de simulação com simulated=true', () => {
    expect(
      service.execute({
        forecast: null,
        officialAlerts: [],
        floodingPointsInZone: [],
        stationRainfall: null,
        historicalRiskWeight: 0.5,
        simulate: 'normal',
      }),
    ).toMatchObject({ severityLevel: 0, severityLabel: 'NORMAL', triggerOverride: false, simulated: true })

    expect(
      service.execute({
        forecast: null,
        officialAlerts: [],
        floodingPointsInZone: [],
        stationRainfall: null,
        historicalRiskWeight: 0.5,
        simulate: 'attention',
      }),
    ).toMatchObject({ severityLevel: 1, severityLabel: 'ATENCAO', triggerOverride: true, simulated: true })

    expect(
      service.execute({
        forecast: null,
        officialAlerts: [],
        floodingPointsInZone: [],
        stationRainfall: null,
        historicalRiskWeight: 0.5,
        simulate: 'alert',
      }),
    ).toMatchObject({ severityLevel: 2, severityLabel: 'ALERTA', triggerOverride: true, simulated: true })

    expect(
      service.execute({
        forecast: null,
        officialAlerts: [],
        floodingPointsInZone: [],
        stationRainfall: null,
        historicalRiskWeight: 0.5,
        simulate: 'critical',
      }),
    ).toMatchObject({ severityLevel: 3, severityLabel: 'CRITICO', triggerOverride: true, simulated: true })
  })
})
