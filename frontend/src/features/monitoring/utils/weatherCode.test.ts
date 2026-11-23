import { describe, expect, it } from 'vitest'
import { getWeatherCodeMetadata } from './weatherCode'

describe('getWeatherCodeMetadata', () => {
  it('maps clear sky and cloudy WMO codes to Portuguese labels and icons', () => {
    expect(getWeatherCodeMetadata(0)).toEqual({ label: 'Céu limpo', icon: 'Sun' })
    expect(getWeatherCodeMetadata(2)).toEqual({ label: 'Parcialmente nublado', icon: 'CloudSun' })
    expect(getWeatherCodeMetadata(3)).toEqual({ label: 'Nublado', icon: 'Cloud' })
  })

  it('maps fog, drizzle, rain, showers and thunderstorm WMO codes', () => {
    expect(getWeatherCodeMetadata(45)).toEqual({ label: 'Nevoeiro', icon: 'CloudFog' })
    expect(getWeatherCodeMetadata(53)).toEqual({ label: 'Garoa moderada', icon: 'CloudDrizzle' })
    expect(getWeatherCodeMetadata(65)).toEqual({ label: 'Chuva forte', icon: 'CloudRain' })
    expect(getWeatherCodeMetadata(81)).toEqual({
      label: 'Pancadas de chuva moderadas',
      icon: 'CloudRain',
    })
    expect(getWeatherCodeMetadata(95)).toEqual({
      label: 'Tempestade com raios',
      icon: 'CloudLightning',
    })
  })

  it('returns safe fallback metadata for unknown or nullish weather codes', () => {
    expect(getWeatherCodeMetadata(999)).toEqual({ label: 'Condição variável', icon: 'Cloud' })
    expect(getWeatherCodeMetadata(null)).toEqual({ label: 'Condição variável', icon: 'Cloud' })
    expect(getWeatherCodeMetadata(undefined)).toEqual({
      label: 'Condição variável',
      icon: 'Cloud',
    })
  })
})
