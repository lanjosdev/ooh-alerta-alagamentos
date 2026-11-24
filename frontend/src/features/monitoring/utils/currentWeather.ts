import { getWeatherCodeMetadata, type WeatherIconName } from '@/features/monitoring/utils/weatherCode'
import type { OohAlertDecision } from '@/types/alerts'

export type CurrentWeatherSourceKind = 'cge-and-grid' | 'grid-only' | 'unavailable'

export interface CurrentWeatherSummary {
  isRaining: boolean | null
  rainStatusLabel: string
  conditionLabel: string
  icon: WeatherIconName
  temperatureC: number | null
  humidityPercent: number | null
  currentRainMm: number | null
  cgeAccumulatedMm: number | null
  observedAt: string | null
  sourceKind: CurrentWeatherSourceKind
}

function isRainWmoCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)
}

export function resolveCurrentWeatherSummary(decision: OohAlertDecision): CurrentWeatherSummary {
  const station = decision.flooding.stationRainfall
  const current = decision.forecast?.current ?? null
  const firstHour = decision.forecast?.hourly[0] ?? null

  let isRaining: boolean | null = null
  if (current !== null) {
    isRaining = current.isRaining
  } else if (firstHour !== null) {
    isRaining = firstHour.precipitationMm >= 0.1 || isRainWmoCode(firstHour.weatherCode)
  }

  const rainStatusLabel =
    isRaining === true
      ? 'Chovendo agora'
      : isRaining === false
        ? 'Sem chuva no momento'
        : 'Condição indisponível'

  const weatherMeta = getWeatherCodeMetadata(current?.weatherCode ?? firstHour?.weatherCode)
  const temperatureC = station?.temperatureC ?? current?.temperatureC ?? null
  const humidityPercent = station?.humidityPercent ?? current?.humidityPercent ?? null
  const currentRainMm = current
    ? current.rainMm > 0
      ? current.rainMm
      : current.precipitationMm
    : null
  const cgeAccumulatedMm = station?.currentPeriodMm ?? null
  const observedAt = current?.observedAt ?? firstHour?.time ?? null

  const sourceKind: CurrentWeatherSourceKind = station
    ? 'cge-and-grid'
    : current || firstHour
      ? 'grid-only'
      : 'unavailable'

  return {
    isRaining,
    rainStatusLabel,
    conditionLabel: weatherMeta.label,
    icon: weatherMeta.icon,
    temperatureC,
    humidityPercent,
    currentRainMm,
    cgeAccumulatedMm,
    observedAt,
    sourceKind,
  }
}
