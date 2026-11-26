import { z } from 'zod'
import { env } from '../../env.js'
import { logger } from '../../lib/logger.js'
import type {
  CurrentWeather,
  ForecastProvider,
  HistoricalForecastDay,
  HistoricalHourlyPoint,
  HourlyRainPoint,
  RegionForecast,
} from '../forecast-provider.js'

const DEFAULT_OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast'
const DEFAULT_OPEN_METEO_HISTORICAL_FORECAST_URL =
  'https://historical-forecast-api.open-meteo.com/v1/forecast'
const DEFAULT_OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'
const MIN_EFFECTIVE_RAIN_MM = 0.3

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

const openMeteoHistoricalResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().default('America/Sao_Paulo'),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()).optional(),
    relative_humidity_2m: z.array(z.number().nullable()).optional(),
    precipitation_probability: z.array(z.number().nullable()).optional(),
    precipitation: z.array(z.number().nullable()),
    rain: z.array(z.number().nullable()).optional(),
    weather_code: z.array(z.number().nullable()).optional(),
    is_day: z.array(z.number().nullable()).optional(),
  }),
})

export interface OpenMeteoForecastProviderOptions {
  fetchFn?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
  historicalForecastBaseUrl?: string
  archiveBaseUrl?: string
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100
}

function roundNullableMetric(value: number | null | undefined): number | null {
  return value !== null && value !== undefined ? roundToTwoDecimals(value) : null
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

  return {
    observedAt: rawCurrent.time,
    temperatureC: roundNullableMetric(rawCurrent.temperature_2m),
    humidityPercent: roundNullableMetric(rawCurrent.relative_humidity_2m),
    precipitationMm,
    rainMm,
    weatherCode,
    isDay: rawCurrent.is_day === 1,
    isRaining: rainMm >= MIN_EFFECTIVE_RAIN_MM || precipitationMm >= MIN_EFFECTIVE_RAIN_MM,
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
  readonly historicalProviderName = 'open-meteo-historical'

  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number
  private readonly baseUrl: string
  private readonly historicalForecastBaseUrl: string
  private readonly archiveBaseUrl: string

  constructor(options: OpenMeteoForecastProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? env.HTTP_TIMEOUT_MS
    this.baseUrl = options.baseUrl ?? DEFAULT_OPEN_METEO_BASE_URL
    this.historicalForecastBaseUrl =
      options.historicalForecastBaseUrl ?? DEFAULT_OPEN_METEO_HISTORICAL_FORECAST_URL
    this.archiveBaseUrl = options.archiveBaseUrl ?? DEFAULT_OPEN_METEO_ARCHIVE_URL
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

  async getHistoricalHourly(
    lat: number,
    lon: number,
    dateIso: string,
  ): Promise<HistoricalForecastDay> {
    try {
      return await this.fetchHistoricalEndpoint(this.historicalForecastBaseUrl, lat, lon, dateIso, true)
    } catch (primaryError) {
      logger.warn(
        { err: primaryError, dateIso, lat, lon },
        'Falha em historical-forecast-api.open-meteo.com; tentando fallback em archive-api',
      )
      return await this.fetchHistoricalEndpoint(this.archiveBaseUrl, lat, lon, dateIso, false)
    }
  }

  private async fetchHistoricalEndpoint(
    endpointUrl: string,
    lat: number,
    lon: number,
    dateIso: string,
    includeProbabilityParam: boolean,
  ): Promise<HistoricalForecastDay> {
    const url = new URL(endpointUrl)
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('start_date', dateIso)
    url.searchParams.set('end_date', dateIso)
    url.searchParams.set(
      'hourly',
      includeProbabilityParam
        ? 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,rain,weather_code,is_day'
        : 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,is_day',
    )
    url.searchParams.set('timezone', 'America/Sao_Paulo')

    const response = await this.fetchFn(url.toString(), {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Open-Meteo histórico respondeu HTTP ${response.status}`)
    }

    const rawJson: unknown = await response.json()
    const payload = openMeteoHistoricalResponseSchema.parse(rawJson)

    const pointCount = Math.min(payload.hourly.time.length, payload.hourly.precipitation.length)
    const hourly: HistoricalHourlyPoint[] = []

    for (let index = 0; index < pointCount; index += 1) {
      const precipitationMm = roundToTwoDecimals(payload.hourly.precipitation[index] ?? 0)
      const rainMm = roundToTwoDecimals(payload.hourly.rain?.[index] ?? precipitationMm)
      const rawProbability = payload.hourly.precipitation_probability?.[index]
      const precipitationProbabilityPercent =
        rawProbability !== null && rawProbability !== undefined
          ? rawProbability
          : precipitationMm >= MIN_EFFECTIVE_RAIN_MM
            ? 100
            : 0

      hourly.push({
        time: payload.hourly.time[index],
        precipitationProbabilityPercent,
        precipitationMm,
        rainMm,
        weatherCode: payload.hourly.weather_code?.[index] ?? 0,
        temperatureC: roundNullableMetric(payload.hourly.temperature_2m?.[index]),
        humidityPercent: roundNullableMetric(payload.hourly.relative_humidity_2m?.[index]),
        isDay: payload.hourly.is_day?.[index] === 1,
      })
    }

    return {
      provider: this.historicalProviderName,
      dateIso,
      gridLatitude: payload.latitude,
      gridLongitude: payload.longitude,
      timezone: payload.timezone,
      hourly,
    }
  }
}
