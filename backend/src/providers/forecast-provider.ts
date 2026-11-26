export interface CurrentWeather {
  observedAt: string
  temperatureC: number | null
  humidityPercent: number | null
  precipitationMm: number
  rainMm: number
  weatherCode: number
  isDay: boolean
  isRaining: boolean
}

export interface HourlyRainPoint {
  time: string
  precipitationProbabilityPercent: number
  precipitationMm: number
  weatherCode: number
}

export interface HistoricalHourlyPoint extends HourlyRainPoint {
  temperatureC: number | null
  humidityPercent: number | null
  rainMm: number
  isDay: boolean
}

export interface HistoricalForecastDay {
  provider: string
  dateIso: string
  gridLatitude: number
  gridLongitude: number
  timezone: string
  hourly: HistoricalHourlyPoint[]
}

export interface RegionForecast {
  provider: string
  gridLatitude: number
  gridLongitude: number
  timezone: string
  current: CurrentWeather | null
  maxRainProbabilityNext2hPercent: number
  expectedRainNext2hMm: number
  peakRainIntensityNext2hMmPerHour: number
  maxRainProbabilityNext6hPercent: number
  expectedRainNext6hMm: number
  hourly: HourlyRainPoint[]
}

export interface ForecastProvider {
  readonly providerName: string
  getHourlyForecast(lat: number, lon: number, now?: Date): Promise<RegionForecast>
  getHistoricalHourly?(lat: number, lon: number, dateIso: string): Promise<HistoricalForecastDay>
}

const MIN_EFFECTIVE_RAIN_MM = 0.3

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

/** Retorna o horário `HH:00` de maior precipitação (> 0 mm) em um dia histórico, ou null se seco. */
export function findPeakPrecipitationTime(day: HistoricalForecastDay): string | null {
  let peakPoint: HistoricalHourlyPoint | null = null

  for (const point of day.hourly) {
    if (point.precipitationMm > 0 && (!peakPoint || point.precipitationMm > peakPoint.precipitationMm)) {
      peakPoint = point
    }
  }

  if (!peakPoint) {
    return null
  }

  const timePart = peakPoint.time.slice(11, 16)
  return /^\d{2}:\d{2}$/.test(timePart) ? timePart : null
}

/** Fatia uma série horária histórica de 24h em `RegionForecast` ancorada em `resolvedTime` (`HH:MM`). */
export function sliceHistoricalDayToForecast(
  day: HistoricalForecastDay,
  resolvedTime: string,
): RegionForecast {
  const hourPrefix = `${day.dateIso}T${resolvedTime.slice(0, 2)}:00`
  let startIndex = day.hourly.findIndex((point) => point.time >= hourPrefix)
  if (startIndex < 0) {
    startIndex = Math.max(0, day.hourly.length - 1)
  }

  const currentPoint = day.hourly[startIndex] ?? null
  const next6h = day.hourly.slice(startIndex, startIndex + 6)
  const next2h = next6h.slice(0, 2)

  const current: CurrentWeather | null = currentPoint
    ? {
        observedAt: `${day.dateIso}T${resolvedTime}`,
        temperatureC: currentPoint.temperatureC,
        humidityPercent: currentPoint.humidityPercent,
        precipitationMm: roundToTwoDecimals(currentPoint.precipitationMm),
        rainMm: roundToTwoDecimals(currentPoint.rainMm),
        weatherCode: currentPoint.weatherCode,
        isDay: currentPoint.isDay,
        isRaining:
          currentPoint.rainMm >= MIN_EFFECTIVE_RAIN_MM ||
          currentPoint.precipitationMm >= MIN_EFFECTIVE_RAIN_MM,
      }
    : null

  return {
    provider: day.provider,
    gridLatitude: day.gridLatitude,
    gridLongitude: day.gridLongitude,
    timezone: day.timezone,
    current,
    maxRainProbabilityNext2hPercent: Math.max(
      0,
      ...next2h.map((point) => point.precipitationProbabilityPercent),
    ),
    expectedRainNext2hMm: roundToTwoDecimals(
      next2h.reduce((sum, point) => sum + point.precipitationMm, 0),
    ),
    peakRainIntensityNext2hMmPerHour: roundToTwoDecimals(
      Math.max(0, ...next2h.map((point) => point.precipitationMm)),
    ),
    maxRainProbabilityNext6hPercent: Math.max(
      0,
      ...next6h.map((point) => point.precipitationProbabilityPercent),
    ),
    expectedRainNext6hMm: roundToTwoDecimals(
      next6h.reduce((sum, point) => sum + point.precipitationMm, 0),
    ),
    hourly: next6h.map((point) => ({
      time: point.time,
      precipitationProbabilityPercent: point.precipitationProbabilityPercent,
      precipitationMm: point.precipitationMm,
      weatherCode: point.weatherCode,
    })),
  }
}
