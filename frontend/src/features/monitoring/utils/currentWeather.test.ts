import { describe, expect, it } from 'vitest'
import {
  mockCampinasDecision,
  mockRegionButanta,
  mockRegionItaquera,
} from '@/test/fixtures/alerts'
import type { OohAlertDecision } from '@/types/alerts'
import { resolveCurrentWeatherSummary } from './currentWeather'

describe('resolveCurrentWeatherSummary', () => {
  it('combina telemetria CGE-SP com forecast.current quando chovendo na Capital SP', () => {
    const summary = resolveCurrentWeatherSummary(mockRegionButanta)

    expect(summary).toEqual({
      isRaining: true,
      rainStatusLabel: 'Chovendo agora',
      conditionLabel: 'Tempestade com raios',
      icon: 'CloudLightning',
      temperatureC: 25.6,
      humidityPercent: 75,
      currentRainMm: 3.2,
      cgeAccumulatedMm: 12.4,
      observedAt: '2026-11-23T18:00',
      sourceKind: 'cge-and-grid',
    })
  })

  it('retorna Sem chuva no momento quando forecast.current indica tempo seco na Capital SP', () => {
    const summary = resolveCurrentWeatherSummary(mockRegionItaquera)

    expect(summary).toEqual({
      isRaining: false,
      rainStatusLabel: 'Sem chuva no momento',
      conditionLabel: 'Parcialmente nublado',
      icon: 'CloudSun',
      temperatureC: 24.1,
      humidityPercent: 62,
      currentRainMm: 0,
      cgeAccumulatedMm: 0,
      observedAt: '2026-11-23T18:00',
      sourceKind: 'cge-and-grid',
    })
  })

  it('usa integralmente forecast.current fora da Capital SP (Campinas com stationRainfall=null)', () => {
    const summary = resolveCurrentWeatherSummary(mockCampinasDecision)

    expect(summary).toEqual({
      isRaining: true,
      rainStatusLabel: 'Chovendo agora',
      conditionLabel: 'Chuva moderada',
      icon: 'CloudRain',
      temperatureC: 22.8,
      humidityPercent: 81,
      currentRainMm: 1.4,
      cgeAccumulatedMm: null,
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
      isRaining: true,
      rainStatusLabel: 'Chovendo agora',
      conditionLabel: 'Chuva moderada',
      icon: 'CloudRain',
      temperatureC: null,
      humidityPercent: null,
      currentRainMm: null,
      cgeAccumulatedMm: null,
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
      isRaining: null,
      rainStatusLabel: 'Condição indisponível',
      conditionLabel: 'Condição variável',
      icon: 'Cloud',
      temperatureC: null,
      humidityPercent: null,
      currentRainMm: null,
      cgeAccumulatedMm: null,
      observedAt: null,
      sourceKind: 'unavailable',
    })
  })
})
