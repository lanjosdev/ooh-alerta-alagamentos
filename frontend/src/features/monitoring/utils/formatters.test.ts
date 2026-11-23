import { describe, expect, it } from 'vitest'
import {
  formatCoordinates,
  formatDateTimeBr,
  formatHourBr,
  formatLatencyMs,
  formatPercent,
  formatRainMm,
  formatRainRateMmPerHour,
  formatTemperatureC,
} from './formatters'

describe('formatters', () => {
  it('formats ISO timestamps in pt-BR using date-fns and handles invalid values', () => {
    const sampleDate = '2026-11-23T15:30:00'

    expect(formatDateTimeBr(sampleDate)).toBe('23/11/2026 15:30')
    expect(formatHourBr(sampleDate)).toBe('15:30')
    expect(formatDateTimeBr(null)).toBe('—')
    expect(formatDateTimeBr('data-invalida')).toBe('—')
    expect(formatHourBr(undefined)).toBe('—')
  })

  it('formats rainfall, temperature, percentage, latency and coordinates safely', () => {
    expect(formatRainMm(25.2)).toBe('25,2 mm')
    expect(formatRainMm(null)).toBe('—')
    expect(formatRainRateMmPerHour(15)).toBe('15,0 mm/h')
    expect(formatTemperatureC(25.64)).toBe('25,6 °C')
    expect(formatTemperatureC(null)).toBe('—')
    expect(formatPercent(75.4)).toBe('75%')
    expect(formatLatencyMs(142.6)).toBe('143 ms')
    expect(formatLatencyMs(null)).toBe('—')
    expect(formatCoordinates(-23.56721, -46.729)).toBe('-23.5672, -46.7290')
  })
})
