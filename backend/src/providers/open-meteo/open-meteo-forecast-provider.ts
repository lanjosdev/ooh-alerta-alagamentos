import { z } from 'zod'
import { env } from '../../env.js'
import type {
  CurrentWeather,
  ForecastProvider,
  HourlyRainPoint,
  RegionForecast,
} from '../forecast-provider.js'

const DEFAULT_OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast'

const openMeteoResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().default('America/Sao_Paulo'),
  current: z
    .object({
      time: z.string(),
      temperature_2m: z.number().nullable().optional(),
      relative_humidity_2m: z.number().nullable().optional(),
      precipitation: z.number().nullable().optional(),
      rain: z.number().nullable().optional(),
      weather_code: z.number().nullable().optional(),
      is_day: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z.object({
    time: z.array(z.string()),
    precipitation_probability: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()).optional(),
  }),
})

export interface OpenMeteoForecastProviderOptions {
  fetchFn?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

function isRainWeatherCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)
}

function normalizeCurrentWeather(
  rawCurrent: z.infer<typeof openMeteoResponseSchema>['current'],
): CurrentWeather | null {
  if (!rawCurrent) {
    return null
  }

  const precipitationMm = roundToTwoDecimals(rawCurrent.precipitation ?? 0)
  const rainMm = roundToTwoDecimals(rawCurrent.rain ?? 0)
  const weatherCode = rawCurrent.weather_code ?? 0
  const temperatureC =
    rawCurrent.temperature_2m !== null && rawCurrent.temperature_2m !== undefined
      ? roundToTwoDecimals(rawCurrent.temperature_2m)
      : null
  const humidityPercent =
    rawCurrent.relative_humidity_2m !== null && rawCurrent.relative_humidity_2m !== undefined
      ? roundToTwoDecimals(rawCurrent.relative_humidity_2m)
      : null

  return {
    observedAt: rawCurrent.time,
    temperatureC,
    humidityPercent,
    precipitationMm,
    rainMm,
    weatherCode,
    isDay: rawCurrent.is_day === 1,
    isRaining: rainMm >= 0.1 || precipitationMm >= 0.1 || isRainWeatherCode(weatherCode),
  }
}

function formatSaoPauloHourKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const hour = lookup.hour === '24' ? '00' : (lookup.hour ?? '00')
  return `${lookup.year}-${lookup.month}-${lookup.day}T${hour}:00`
}

export class OpenMeteoForecastProvider implements ForecastProvider {
  readonly providerName = 'open-meteo'

  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number
  private readonly baseUrl: string

  constructor(options: OpenMeteoForecastProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? env.HTTP_TIMEOUT_MS
    this.baseUrl = options.baseUrl ?? DEFAULT_OPEN_METEO_BASE_URL
  }

  async getHourlyForecast(lat: number, lon: number, now: Date = new Date()): Promise<RegionForecast> {
    const url = new URL(this.baseUrl)
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set(
      'current',
      'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,is_day',
    )
    url.searchParams.set('hourly', 'precipitation_probability,precipitation,weather_code')
    url.searchParams.set('timezone', 'America/Sao_Paulo')
    url.searchParams.set('forecast_days', '2')

    const response = await this.fetchFn(url.toString(), {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo respondeu HTTP ${response.status}`)
    }

    const rawJson: unknown = await response.json()
    const payload = openMeteoResponseSchema.parse(rawJson)

    const pointCount = Math.min(
      payload.hourly.time.length,
      payload.hourly.precipitation_probability.length,
      payload.hourly.precipitation.length,
    )

    const allPoints: HourlyRainPoint[] = []
    for (let index = 0; index < pointCount; index += 1) {
      allPoints.push({
        time: payload.hourly.time[index],
        precipitationProbabilityPercent: payload.hourly.precipitation_probability[index] ?? 0,
        precipitationMm: payload.hourly.precipitation[index] ?? 0,
        weatherCode: payload.hourly.weather_code?.[index] ?? 0,
      })
    }

    const currentHourKey = formatSaoPauloHourKey(now)
    const startIndex = allPoints.findIndex((point) => point.time >= currentHourKey)
    const next6h =
      startIndex >= 0
        ? allPoints.slice(startIndex, startIndex + 6)
        : allPoints.slice(Math.max(0, allPoints.length - 6))
    const next2h = next6h.slice(0, 2)

    return {
      provider: this.providerName,
      gridLatitude: payload.latitude,
      gridLongitude: payload.longitude,
      timezone: payload.timezone,
      current: normalizeCurrentWeather(payload.current),
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
      hourly: next6h,
    }
  }
}
