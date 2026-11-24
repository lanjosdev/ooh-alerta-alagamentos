import { describe, expect, it } from 'vitest'
import {
  mockCampinasDecision,
  mockRegionButanta,
  mockRegionItaquera,
} from '@/test/fixtures/alerts'
import type { OohAlertDecision } from '@/types/alerts'
import { resolveCurrentWeatherSummary } from './currentWeather'

describe('resolveCurrentWeatherSummary', () => {
  it('combina telemetria CGE-SP com confirmação de delta quando chovendo na Capital SP', () => {
    const summary = resolveCurrentWeatherSummary(mockRegionButanta)

    expect(summary).toEqual({
      rainStatus: 'raining',
      isRaining: true,
      rainStatusLabel: 'Chovendo agora',
      sourceLabel: 'Confirmado na estação CGE-SP',
      conditionLabel: 'Tempestade com raios',
      icon: 'CloudLightning',
      temperatureC: 25.6,
      humidityPercent: 75,
      currentRainMm: 3.2,
      cgeAccumulatedMm: 12.4,
      cgeRecentDeltaMm: 1.8,
      confirmedByCgeDelta: true,
      observedAt: '2026-11-23T18:00',
      sourceKind: 'cge-and-grid',
    })
  })

  it('confirma chuva via delta CGE >= 0,2 mm mesmo quando Open-Meteo está seco ou fraco', () => {
    const decision: OohAlertDecision = {
      ...mockRegionItaquera,
      flooding: {
        ...mockRegionItaquera.flooding,
        stationRainfall: {
          ...mockRegionItaquera.flooding.stationRainfall!,
          currentPeriodMm: 0.4,
          recentDeltaMm: 0.2,
        },
      },
    }

    const summary = resolveCurrentWeatherSummary(decision)
    expect(summary.rainStatus).toBe('raining')
    expect(summary.isRaining).toBe(true)
    expect(summary.rainStatusLabel).toBe('Chovendo agora')
    expect(summary.sourceLabel).toBe('Confirmado na estação CGE-SP')
    expect(summary.confirmedByCgeDelta).toBe(true)
  })

  it('retorna Sem chuva no momento com origem Open-Meteo quando seco na Capital SP', () => {
    const summary = resolveCurrentWeatherSummary(mockRegionItaquera)

    expect(summary).toEqual({
      rainStatus: 'dry',
      isRaining: false,
      rainStatusLabel: 'Sem chuva no momento',
      sourceLabel: 'Estimado na grade (Open-Meteo)',
      conditionLabel: 'Parcialmente nublado',
      icon: 'CloudSun',
      temperatureC: 24.1,
      humidityPercent: 62,
      currentRainMm: 0,
      cgeAccumulatedMm: 0,
      cgeRecentDeltaMm: 0,
      confirmedByCgeDelta: false,
      observedAt: '2026-11-23T18:00',
      sourceKind: 'cge-and-grid',
    })
  })

  it('classifica sinal fraco (0,1–0,2 mm ou código WMO de garoa) como Possível garoa na região', () => {
    const weakRainDecision: OohAlertDecision = {
      ...mockCampinasDecision,
      forecast: {
        ...mockCampinasDecision.forecast!,
        current: {
          observedAt: '2026-11-23T18:15',
          temperatureC: 21.5,
          humidityPercent: 78,
          precipitationMm: 0.2,
          rainMm: 0.2,
          weatherCode: 51,
          isDay: true,
          isRaining: false,
        },
      },
    }

    const weakSummary = resolveCurrentWeatherSummary(weakRainDecision)
    expect(weakSummary.rainStatus).toBe('possible-drizzle')
    expect(weakSummary.isRaining).toBe(false)
    expect(weakSummary.rainStatusLabel).toBe('Possível garoa na região')
    expect(weakSummary.sourceLabel).toBe('Estimado na grade (Open-Meteo)')

    const wmoOnlyDecision: OohAlertDecision = {
      ...mockCampinasDecision,
      forecast: {
        ...mockCampinasDecision.forecast!,
        current: {
          observedAt: '2026-11-23T18:15',
          temperatureC: 21.5,
          humidityPercent: 78,
          precipitationMm: 0,
          rainMm: 0,
          weatherCode: 51,
          isDay: true,
          isRaining: false,
        },
      },
    }

    const wmoSummary = resolveCurrentWeatherSummary(wmoOnlyDecision)
    expect(wmoSummary.rainStatus).toBe('possible-drizzle')
    expect(wmoSummary.isRaining).toBe(false)
  })

  it('usa integralmente forecast.current fora da Capital SP (Campinas com stationRainfall=null)', () => {
    const summary = resolveCurrentWeatherSummary(mockCampinasDecision)

    expect(summary).toEqual({
      rainStatus: 'raining',
      isRaining: true,
      rainStatusLabel: 'Chovendo agora',
      sourceLabel: 'Estimado na grade (Open-Meteo)',
      conditionLabel: 'Chuva moderada',
      icon: 'CloudRain',
      temperatureC: 22.8,
      humidityPercent: 81,
      currentRainMm: 1.4,
      cgeAccumulatedMm: null,
      cgeRecentDeltaMm: null,
      confirmedByCgeDelta: false,
      observedAt: '2026-11-23T18:00',
      sourceKind: 'grid-only',
    })
  })

  it('faz fallback para hourly[0] quando forecast.current é null', () => {
    const withoutCurrent: OohAlertDecision = {
      ...mockCampinasDecision,
      forecast: mockCampinasDecision.forecast
        ? {
            ...mockCampinasDecision.forecast,
            current: null,
          }
        : null,
    }

    const summary = resolveCurrentWeatherSummary(withoutCurrent)

    expect(summary).toEqual({
      rainStatus: 'raining',
      isRaining: true,
      rainStatusLabel: 'Chovendo agora',
      sourceLabel: 'Estimado na grade (Open-Meteo)',
      conditionLabel: 'Chuva moderada',
      icon: 'CloudRain',
      temperatureC: null,
      humidityPercent: null,
      currentRainMm: null,
      cgeAccumulatedMm: null,
      cgeRecentDeltaMm: null,
      confirmedByCgeDelta: false,
      observedAt: '2026-11-23T18:00:00',
      sourceKind: 'grid-only',
    })
  })

  it('retorna Condição indisponível quando forecast e stationRainfall são nulos', () => {
    const unavailable: OohAlertDecision = {
      ...mockCampinasDecision,
      forecast: null,
      flooding: {
        ...mockCampinasDecision.flooding,
        stationRainfall: null,
      },
    }

    const summary = resolveCurrentWeatherSummary(unavailable)

    expect(summary).toEqual({
      rainStatus: 'unavailable',
      isRaining: null,
      rainStatusLabel: 'Condição indisponível',
      sourceLabel: 'Sem leitura atual',
      conditionLabel: 'Condição variável',
      icon: 'Cloud',
      temperatureC: null,
      humidityPercent: null,
      currentRainMm: null,
      cgeAccumulatedMm: null,
      cgeRecentDeltaMm: null,
      confirmedByCgeDelta: false,
      observedAt: null,
      sourceKind: 'unavailable',
    })
  })
})
