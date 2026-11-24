import { getWeatherCodeMetadata, type WeatherIconName } from '@/features/monitoring/utils/weatherCode'
import type { OohAlertDecision } from '@/types/alerts'

export type CurrentWeatherSourceKind = 'cge-and-grid' | 'grid-only' | 'unavailable'
export type RainStatus = 'raining' | 'possible-drizzle' | 'dry' | 'unavailable'

const MIN_EFFECTIVE_RAIN_MM = 0.3
const MIN_WEAK_RAIN_MM = 0.1
const MIN_CGE_DELTA_RAIN_MM = 0.2

export interface CurrentWeatherSummary {
  rainStatus: RainStatus
  isRaining: boolean | null
  rainStatusLabel: string
  sourceLabel: string
  conditionLabel: string
  icon: WeatherIconName
  temperatureC: number | null
  humidityPercent: number | null
  currentRainMm: number | null
  cgeAccumulatedMm: number | null
  cgeRecentDeltaMm: number | null
  confirmedByCgeDelta: boolean
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

  const cgeRecentDeltaMm = station?.recentDeltaMm ?? null
  const confirmedByCgeDelta =
    cgeRecentDeltaMm !== null && cgeRecentDeltaMm >= MIN_CGE_DELTA_RAIN_MM

  let rainStatus: RainStatus = 'unavailable'
  if (confirmedByCgeDelta) {
    rainStatus = 'raining'
  } else if (current !== null) {
    if (
      current.isRaining ||
      current.rainMm >= MIN_EFFECTIVE_RAIN_MM ||
      current.precipitationMm >= MIN_EFFECTIVE_RAIN_MM
    ) {
      rainStatus = 'raining'
    } else if (
      current.rainMm >= MIN_WEAK_RAIN_MM ||
      current.precipitationMm >= MIN_WEAK_RAIN_MM ||
      isRainWmoCode(current.weatherCode)
    ) {
      rainStatus = 'possible-drizzle'
    } else {
      rainStatus = 'dry'
    }
  } else if (firstHour !== null) {
    if (firstHour.precipitationMm >= MIN_EFFECTIVE_RAIN_MM) {
      rainStatus = 'raining'
    } else if (
      firstHour.precipitationMm >= MIN_WEAK_RAIN_MM ||
      isRainWmoCode(firstHour.weatherCode)
    ) {
      rainStatus = 'possible-drizzle'
    } else {
      rainStatus = 'dry'
    }
  }

  const isRaining: boolean | null =
    rainStatus === 'raining' ? true : rainStatus === 'unavailable' ? null : false

  const rainStatusLabel =
    rainStatus === 'raining'
      ? 'Chovendo agora'
      : rainStatus === 'possible-drizzle'
        ? 'Possível garoa na região'
        : rainStatus === 'dry'
          ? 'Sem chuva no momento'
          : 'Condição indisponível'

  const sourceLabel = confirmedByCgeDelta
    ? 'Confirmado na estação CGE-SP'
    : current !== null || firstHour !== null
      ? 'Estimado na grade (Open-Meteo)'
      : 'Sem leitura atual'

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
    rainStatus,
    isRaining,
    rainStatusLabel,
    sourceLabel,
    conditionLabel: weatherMeta.label,
    icon: weatherMeta.icon,
    temperatureC,
    humidityPercent,
    currentRainMm,
    cgeAccumulatedMm,
    cgeRecentDeltaMm,
    confirmedByCgeDelta,
    observedAt,
    sourceKind,
  }
}
