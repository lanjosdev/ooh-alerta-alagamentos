import { env } from '../env.js'
import type { ForecastProvider } from './forecast-provider.js'
import { OpenMeteoForecastProvider } from './open-meteo/open-meteo-forecast-provider.js'

export type ConfiguredForecastProvider = typeof env.FORECAST_PROVIDER

export function createForecastProvider(
  providerName: ConfiguredForecastProvider = env.FORECAST_PROVIDER,
): ForecastProvider {
  switch (providerName) {
    case 'open-meteo':
      return new OpenMeteoForecastProvider()
    case 'tomorrow-io':
      throw new Error(
        "Provedor 'tomorrow-io' selecionado em FORECAST_PROVIDER, porém requer implementação e chave de API comercial (consulte src/providers/stubs/paid-forecast-provider.template.ts).",
      )
    case 'google-weather':
      throw new Error(
        "Provedor 'google-weather' selecionado em FORECAST_PROVIDER, porém requer implementação e chave de API comercial (consulte src/providers/stubs/paid-forecast-provider.template.ts).",
      )
  }
}
