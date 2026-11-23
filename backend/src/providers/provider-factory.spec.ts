import { describe, expect, it } from 'vitest'
import { OpenMeteoForecastProvider } from './open-meteo/open-meteo-forecast-provider.js'
import { createForecastProvider } from './provider-factory.js'

describe('createForecastProvider', () => {
  it('instancia OpenMeteoForecastProvider quando configurado para open-meteo', () => {
    const provider = createForecastProvider('open-meteo')
    expect(provider).toBeInstanceOf(OpenMeteoForecastProvider)
    expect(provider.providerName).toBe('open-meteo')
  })

  it('lança erro descritivo quando provedor comercial ainda não está habilitado', () => {
    expect(() => createForecastProvider('tomorrow-io')).toThrow(/paid-forecast-provider\.template\.ts/)
    expect(() => createForecastProvider('google-weather')).toThrow(/paid-forecast-provider\.template\.ts/)
  })
})
