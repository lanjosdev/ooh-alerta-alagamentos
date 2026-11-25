import { env } from '../../env.js'
import type { CacheLookupResult, MemoryCache } from '../../lib/cache.js'
import {
  DEFAULT_CGE_STATION_MAX_DISTANCE_METERS,
  SAO_PAULO_IBGE_CODE,
  findCgeStationById,
  findNearestCgeStation,
} from '../../providers/cge-sp/cge-sp-stations.js'
import { resolveHistoricalFloodingSnapshot } from '../../providers/cge-sp/cge-sp-time-window.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from '../../providers/flooding-monitor-provider.js'
import {
  type ForecastProvider,
  type HistoricalForecastDay,
  type RegionForecast,
  findPeakPrecipitationTime,
  sliceHistoricalDayToForecast,
} from '../../providers/forecast-provider.js'
import type {
  OfficialAlertsProvider,
  OfficialWeatherAlert,
} from '../../providers/official-alerts-provider.js'
import {
  type RegionRepository,
  normalizeRegionText,
} from '../../repositories/region-repository.js'
import { BadRequestError, NotFoundError } from '../../utils/application-error.js'
import {
  cgeDateToIsoDate,
  formatNowInSaoPauloIso,
  formatSaoPauloIsoTimestamp,
  getSaoPauloNowMinutes,
  getSaoPauloTodayIso,
  isValidCalendarDate,
  isoDateToCgeDate,
} from '../../utils/temporal.js'
import type {
  AlertLocationInfo,
  OohAlertDecision,
  SimulationMode,
  SourceExecutionStatus,
  TemporalContext,
  TemporalMode,
} from './alert-types.js'
import { BuildOohMessageService } from './build-ooh-message-service.js'
import { EvaluateRiskService } from './evaluate-risk-service.js'

const HISTORICAL_FORECAST_PROVIDER_NAME = 'open-meteo-historical'
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const CGE_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/
const TIME_HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/

export type GetLocationAlertInput =
  | {
      mode: 'region'
      regionId: string
      date?: string
      time?: string
      cgeDate?: string
      simulate?: SimulationMode
    }
  | {
      mode: 'coordinates'
      lat: number
      lon: number
      date?: string
      time?: string
      cgeDate?: string
      simulate?: SimulationMode
    }

export interface TemporalValidationInput {
  date?: string
  time?: string
  cgeDate?: string
  simulate?: SimulationMode
}

export interface GetLocationAlertDependencies {
  regionRepository: RegionRepository
  forecastProvider: ForecastProvider
  officialAlertsProvider: OfficialAlertsProvider
  floodingMonitorProvider: FloodingMonitorProvider
  cache: MemoryCache
  evaluateRiskService?: EvaluateRiskService
  buildOohMessageService?: BuildOohMessageService
  enableSimulationParams?: boolean
  nowFn?: () => Date
  cacheTtls?: {
    forecastSeconds?: number
    inmetSeconds?: number
    cgeSeconds?: number
    historicalSeconds?: number
  }
}

function toErrorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}

function toSourceStatus<T>(
  providerName: string,
  settled: PromiseSettledResult<CacheLookupResult<T>>,
): { value: T | null; status: SourceExecutionStatus } {
  if (settled.status === 'fulfilled') {
    const result = settled.value
    return {
      value: result.value,
      status: {
        provider: providerName,
        status: result.stale ? 'stale' : 'ok',
        cached: result.cached,
        stale: result.stale,
        fetchedAt: result.fetchedAt,
        error: null,
      },
    }
  }

  return {
    value: null,
    status: {
      provider: providerName,
      status: 'error',
      cached: false,
      stale: false,
      fetchedAt: null,
      error: toErrorMessage(settled.reason),
    },
  }
}

function skippedStatus(providerName: string): SourceExecutionStatus {
  return {
    provider: providerName,
    status: 'skipped',
    cached: false,
    stale: false,
    fetchedAt: null,
    error: null,
  }
}

export class GetLocationAlertService {
  private readonly evaluateRiskService: EvaluateRiskService
  private readonly buildOohMessageService: BuildOohMessageService
  private readonly enableSimulationParams: boolean
  private readonly nowFn: () => Date
  private readonly forecastTtlSeconds: number
  private readonly inmetTtlSeconds: number
  private readonly cgeTtlSeconds: number
  private readonly historicalTtlSeconds: number

  constructor(private readonly deps: GetLocationAlertDependencies) {
    this.evaluateRiskService = deps.evaluateRiskService ?? new EvaluateRiskService()
    this.buildOohMessageService = deps.buildOohMessageService ?? new BuildOohMessageService()
    this.enableSimulationParams = deps.enableSimulationParams ?? env.ENABLE_SIMULATION_PARAMS
    this.nowFn = deps.nowFn ?? (() => new Date())
    this.forecastTtlSeconds = deps.cacheTtls?.forecastSeconds ?? env.CACHE_TTL_FORECAST_SECONDS
    this.inmetTtlSeconds = deps.cacheTtls?.inmetSeconds ?? env.CACHE_TTL_INMET_SECONDS
    this.cgeTtlSeconds = deps.cacheTtls?.cgeSeconds ?? env.CACHE_TTL_CGE_SECONDS
    this.historicalTtlSeconds =
      deps.cacheTtls?.historicalSeconds ?? env.CACHE_TTL_HISTORICAL_SECONDS
  }

  isSimulationEnabled(): boolean {
    return this.enableSimulationParams
  }

  validateInput(input: TemporalValidationInput): void {
    if (!this.enableSimulationParams && input.simulate !== undefined) {
      throw new BadRequestError('Parâmetro de simulação (simulate) está desabilitado neste ambiente.')
    }

    if (input.date !== undefined && input.cgeDate !== undefined) {
      throw new BadRequestError(
        'Informe apenas date (YYYY-MM-DD) ou cgeDate (DD/MM/AAAA), nunca ambos simultaneamente.',
      )
    }

    if (input.time !== undefined && input.date === undefined) {
      throw new BadRequestError('O parâmetro time (HH:MM) exige o parâmetro date (YYYY-MM-DD).')
    }

    const todaySp = getSaoPauloTodayIso(this.nowFn())

    if (input.date !== undefined) {
      if (!ISO_DATE_REGEX.test(input.date) || !isValidCalendarDate(input.date)) {
        throw new BadRequestError('Parâmetro date inválido. Use data real no formato YYYY-MM-DD.')
      }
      if (input.date > todaySp) {
        throw new BadRequestError('O parâmetro date não pode estar no futuro em America/Sao_Paulo.')
      }
    }

    if (input.cgeDate !== undefined) {
      if (!CGE_DATE_REGEX.test(input.cgeDate)) {
        throw new BadRequestError('Parâmetro cgeDate inválido. Use o formato DD/MM/AAAA.')
      }
      const cgeIso = cgeDateToIsoDate(input.cgeDate)
      if (!isValidCalendarDate(cgeIso)) {
        throw new BadRequestError('Parâmetro cgeDate representa uma data de calendário inválida.')
      }
      if (cgeIso > todaySp) {
        throw new BadRequestError(
          'O parâmetro cgeDate não pode estar no futuro em America/Sao_Paulo.',
        )
      }
    }

    if (input.time !== undefined && !TIME_HM_REGEX.test(input.time)) {
      throw new BadRequestError('Parâmetro time inválido. Use o formato HH:MM (00:00 a 23:59).')
    }
  }

  async execute(input: GetLocationAlertInput): Promise<OohAlertDecision> {
    this.validateInput(input)

    const location = await this.resolveLocation(input)
    const now = this.nowFn()
    const isHistoricalQuery = input.date !== undefined || input.cgeDate !== undefined
    const temporalMode: TemporalMode = input.simulate
      ? 'simulated'
      : isHistoricalQuery
        ? 'historical'
        : 'realtime'

    if (isHistoricalQuery) {
      return this.executeHistorical(input, location, temporalMode, now)
    }

    return this.executeRealtime(input, location, temporalMode, now)
  }

  private async executeRealtime(
    input: GetLocationAlertInput,
    location: AlertLocationInfo,
    temporalMode: TemporalMode,
    now: Date,
  ): Promise<OohAlertDecision> {
    const { forecastProvider, officialAlertsProvider, floodingMonitorProvider, cache } = this.deps
    const includeCgeSp = location.ibgeCode === SAO_PAULO_IBGE_CODE

    const forecastPromise = cache.getOrFetch({
      provider: forecastProvider.providerName,
      key: `forecast:${forecastProvider.providerName}:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`,
      ttlSeconds: this.forecastTtlSeconds,
      fetcher: () => forecastProvider.getHourlyForecast(location.latitude, location.longitude),
    })

    const inmetKey = location.ibgeCode
      ? `inmet:ibge:${location.ibgeCode}`
      : `inmet:coord:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`

    const alertsPromise = cache.getOrFetch({
      provider: officialAlertsProvider.providerName,
      key: inmetKey,
      ttlSeconds: this.inmetTtlSeconds,
      fetcher: () =>
        officialAlertsProvider.getActiveAlerts({
          ibgeCode: location.ibgeCode ?? undefined,
          lat: location.latitude,
          lon: location.longitude,
        }),
    })

    const floodingsPromise = includeCgeSp
      ? cache.getOrFetch({
          provider: floodingMonitorProvider.providerName,
          key: 'cge-sp:floodings:today',
          ttlSeconds: this.cgeTtlSeconds,
          fetcher: () => floodingMonitorProvider.getFloodingPoints(),
        })
      : null

    const stationPromise =
      includeCgeSp && location.cgeStationId
        ? cache.getOrFetch({
            provider: floodingMonitorProvider.providerName,
            key: `cge-sp:station:${location.cgeStationId}`,
            ttlSeconds: this.cgeTtlSeconds,
            fetcher: () => floodingMonitorProvider.getStationRainfall(location.cgeStationId!),
          })
        : null

    const [forecastSettled, alertsSettled, floodingsSettled, stationSettled] =
      await Promise.allSettled([
        forecastPromise,
        alertsPromise,
        floodingsPromise ?? Promise.resolve(null),
        stationPromise ?? Promise.resolve(null),
      ])

    const forecastResult = toSourceStatus(forecastProvider.providerName, forecastSettled)
    const alertsResult = toSourceStatus(officialAlertsProvider.providerName, alertsSettled)
    const officialAlerts: OfficialWeatherAlert[] = alertsResult.value ?? []

    let allFloodingPoints: FloodingPoint[] = []
    let stationRainfall: StationRainfall | null = null
    let floodingMonitorStatus: SourceExecutionStatus

    if (!includeCgeSp) {
      floodingMonitorStatus = skippedStatus(floodingMonitorProvider.providerName)
    } else {
      const floodingLookup =
        floodingsSettled.status === 'fulfilled'
          ? (floodingsSettled.value as CacheLookupResult<FloodingPoint[]> | null)
          : null
      const stationLookup =
        stationSettled.status === 'fulfilled'
          ? (stationSettled.value as CacheLookupResult<StationRainfall | null> | null)
          : null

      allFloodingPoints = floodingLookup?.value ?? []
      stationRainfall = stationLookup?.value ?? null

      const errors: string[] = []
      if (floodingsSettled.status === 'rejected') {
        errors.push(toErrorMessage(floodingsSettled.reason))
      }
      if (stationSettled.status === 'rejected') {
        errors.push(toErrorMessage(stationSettled.reason))
      }

      const anySuccess = Boolean(floodingLookup || stationLookup)
      const anyStale = Boolean(floodingLookup?.stale || stationLookup?.stale)
      const allCached = Boolean(
        (floodingLookup?.cached ?? true) && (stationLookup ? stationLookup.cached : true),
      )

      floodingMonitorStatus = {
        provider: floodingMonitorProvider.providerName,
        status: !anySuccess ? 'error' : anyStale ? 'stale' : 'ok',
        cached: anySuccess && allCached,
        stale: anyStale,
        fetchedAt: floodingLookup?.fetchedAt ?? stationLookup?.fetchedAt ?? null,
        error: errors.length > 0 ? errors.join('; ') : null,
      }
    }

    const temporal: TemporalContext = {
      mode: temporalMode,
      date: null,
      time: null,
      resolvedTime: null,
      referenceAt: formatNowInSaoPauloIso(now),
    }

    return this.buildDecision({
      location,
      temporal,
      forecast: forecastResult.value,
      forecastStatus: forecastResult.status,
      officialAlerts,
      officialAlertsStatus: alertsResult.status,
      allFloodingPoints,
      stationRainfall,
      floodingMonitorStatus,
      cgeDate: null,
      includeCgeSp,
      simulate: input.simulate,
      evaluatedAt: now.toISOString(),
    })
  }

  private async executeHistorical(
    input: GetLocationAlertInput,
    location: AlertLocationInfo,
    temporalMode: TemporalMode,
    now: Date,
  ): Promise<OohAlertDecision> {
    const { forecastProvider, officialAlertsProvider, floodingMonitorProvider, cache } = this.deps
    const includeCgeSp = location.ibgeCode === SAO_PAULO_IBGE_CODE
    const effectiveDateIso = input.date ?? cgeDateToIsoDate(input.cgeDate!)
    const effectiveCgeDate = input.cgeDate ?? isoDateToCgeDate(input.date!)
    const isTodayInSp = effectiveDateIso === getSaoPauloTodayIso(now)

    const forecastCacheTtl = isTodayInSp ? this.forecastTtlSeconds : this.historicalTtlSeconds
    const cgeCacheTtl = isTodayInSp ? this.cgeTtlSeconds : this.historicalTtlSeconds

    const historicalForecastPromise =
      typeof forecastProvider.getHistoricalHourly === 'function'
        ? cache.getOrFetch({
            provider: HISTORICAL_FORECAST_PROVIDER_NAME,
            key: `forecast-hist:${effectiveDateIso}:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`,
            ttlSeconds: forecastCacheTtl,
            fetcher: () =>
              forecastProvider.getHistoricalHourly!(
                location.latitude,
                location.longitude,
                effectiveDateIso,
              ),
          })
        : null

    const fallbackForecastPromise =
      historicalForecastPromise === null
        ? cache.getOrFetch({
            provider: forecastProvider.providerName,
            key: `forecast:${forecastProvider.providerName}:${location.latitude.toFixed(3)}:${location.longitude.toFixed(3)}`,
            ttlSeconds: this.forecastTtlSeconds,
            fetcher: () => forecastProvider.getHourlyForecast(location.latitude, location.longitude),
          })
        : null

    const floodingsPromise = includeCgeSp
      ? cache.getOrFetch({
          provider: floodingMonitorProvider.providerName,
          key: `cge-sp:floodings:${effectiveCgeDate}`,
          ttlSeconds: cgeCacheTtl,
          fetcher: () => floodingMonitorProvider.getFloodingPoints({ cgeDate: effectiveCgeDate }),
        })
      : null

    const [histSettled, fallbackSettled, floodingsSettled] = await Promise.allSettled([
      historicalForecastPromise ?? Promise.resolve(null),
      fallbackForecastPromise ?? Promise.resolve(null),
      floodingsPromise ?? Promise.resolve(null),
    ])

    let rawFloodingPoints: FloodingPoint[] = []
    let floodingMonitorStatus: SourceExecutionStatus

    if (!includeCgeSp) {
      floodingMonitorStatus = skippedStatus(floodingMonitorProvider.providerName)
    } else if (floodingsSettled.status === 'fulfilled') {
      const lookup = floodingsSettled.value as CacheLookupResult<FloodingPoint[]>
      rawFloodingPoints = lookup.value
      floodingMonitorStatus = {
        provider: floodingMonitorProvider.providerName,
        status: lookup.stale ? 'stale' : 'ok',
        cached: lookup.cached,
        stale: lookup.stale,
        fetchedAt: lookup.fetchedAt,
        error: null,
      }
    } else {
      floodingMonitorStatus = {
        provider: floodingMonitorProvider.providerName,
        status: 'error',
        cached: false,
        stale: false,
        fetchedAt: null,
        error: toErrorMessage(floodingsSettled.reason),
      }
    }

    const snapshot = resolveHistoricalFloodingSnapshot(rawFloodingPoints, input.time, {
      isToday: isTodayInSp,
      nowMinutes: getSaoPauloNowMinutes(now),
    })

    let forecast: RegionForecast | null = null
    let forecastStatus: SourceExecutionStatus
    let resolvedTime = input.time ?? snapshot.resolvedTime

    if (historicalForecastPromise !== null) {
      if (histSettled.status === 'fulfilled' && histSettled.value !== null) {
        const histLookup = histSettled.value as CacheLookupResult<HistoricalForecastDay>
        if (!resolvedTime) {
          resolvedTime = findPeakPrecipitationTime(histLookup.value) ?? '12:00'
        }
        forecast = sliceHistoricalDayToForecast(histLookup.value, resolvedTime)
        forecastStatus = {
          provider: HISTORICAL_FORECAST_PROVIDER_NAME,
          status: histLookup.stale ? 'stale' : 'ok',
          cached: histLookup.cached,
          stale: histLookup.stale,
          fetchedAt: histLookup.fetchedAt,
          error: null,
        }
      } else {
        resolvedTime = resolvedTime ?? '12:00'
        forecastStatus = {
          provider: HISTORICAL_FORECAST_PROVIDER_NAME,
          status: 'error',
          cached: false,
          stale: false,
          fetchedAt: null,
          error:
            histSettled.status === 'rejected'
              ? toErrorMessage(histSettled.reason)
              : 'Histórico meteorológico indisponível',
        }
      }
    } else {
      resolvedTime = resolvedTime ?? '12:00'
      const fallbackResult = toSourceStatus(
        forecastProvider.providerName,
        fallbackSettled as PromiseSettledResult<CacheLookupResult<RegionForecast>>,
      )
      forecast = fallbackResult.value
      forecastStatus = fallbackResult.status
    }

    const temporal: TemporalContext = {
      mode: temporalMode,
      date: effectiveDateIso,
      time: input.time ?? null,
      resolvedTime,
      referenceAt: formatSaoPauloIsoTimestamp(effectiveDateIso, resolvedTime),
    }

    return this.buildDecision({
      location,
      temporal,
      forecast,
      forecastStatus,
      officialAlerts: [],
      officialAlertsStatus: skippedStatus(officialAlertsProvider.providerName),
      allFloodingPoints: snapshot.points,
      stationRainfall: null,
      floodingMonitorStatus,
      cgeDate: includeCgeSp ? effectiveCgeDate : null,
      includeCgeSp,
      simulate: input.simulate,
      evaluatedAt: now.toISOString(),
    })
  }

  private buildDecision(params: {
    location: AlertLocationInfo
    temporal: TemporalContext
    forecast: RegionForecast | null
    forecastStatus: SourceExecutionStatus
    officialAlerts: OfficialWeatherAlert[]
    officialAlertsStatus: SourceExecutionStatus
    allFloodingPoints: FloodingPoint[]
    stationRainfall: StationRainfall | null
    floodingMonitorStatus: SourceExecutionStatus
    cgeDate: string | null
    includeCgeSp: boolean
    simulate?: SimulationMode
    evaluatedAt: string
  }): OohAlertDecision {
    const {
      location,
      temporal,
      forecast,
      forecastStatus,
      officialAlerts,
      officialAlertsStatus,
      allFloodingPoints,
      stationRainfall,
      floodingMonitorStatus,
      cgeDate,
      includeCgeSp,
      simulate,
      evaluatedAt,
    } = params

    const normalizedZone = location.zone ? normalizeRegionText(location.zone) : null
    const pointsInZone = normalizedZone
      ? allFloodingPoints.filter((point) => normalizeRegionText(point.zone) === normalizedZone)
      : []

    const activeInZone = pointsInZone.filter((point) => point.active)
    const impassableInZoneCount = activeInZone.filter((point) => !point.passable).length
    const passableInZoneCount = activeInZone.filter((point) => point.passable).length

    const evaluation = this.evaluateRiskService.execute({
      forecast,
      officialAlerts,
      floodingPointsInZone: pointsInZone,
      stationRainfall,
      historicalRiskWeight: location.historicalRiskWeight,
      simulate,
    })

    const display = this.buildOohMessageService.execute({
      locationName: location.name,
      zone: location.zone,
      evaluation,
      forecast,
      floodingPointsInZone: pointsInZone,
      officialAlerts,
    })

    return {
      evaluatedAt,
      temporal,
      location,
      triggerOverride: evaluation.triggerOverride,
      severityLevel: evaluation.severityLevel,
      severityLabel: evaluation.severityLabel,
      riskScore: evaluation.riskScore,
      simulated: evaluation.simulated,
      reasons: evaluation.reasons,
      display,
      forecast,
      officialAlerts,
      flooding: {
        cgeDate: includeCgeSp ? cgeDate : null,
        activeInZoneCount: activeInZone.length,
        impassableInZoneCount,
        passableInZoneCount,
        pointsInZone,
        stationRainfall,
      },
      sources: {
        forecast: forecastStatus,
        officialAlerts: officialAlertsStatus,
        floodingMonitor: floodingMonitorStatus,
      },
    }
  }

  private async resolveLocation(input: GetLocationAlertInput): Promise<AlertLocationInfo> {
    if (input.mode === 'region') {
      const region = await this.deps.regionRepository.findById(input.regionId)
      if (!region) {
        throw new NotFoundError(`Região '${input.regionId}' não encontrada`)
      }

      const cgeStation = region.cgeStationId ? findCgeStationById(region.cgeStationId) : null
      return {
        id: region.id,
        name: region.name,
        city: region.city,
        state: region.state,
        ibgeCode: region.ibgeCode,
        zone: region.zone,
        latitude: region.latitude,
        longitude: region.longitude,
        cgeStationId: region.cgeStationId,
        cgeStationName: cgeStation?.name ?? null,
        historicalRiskWeight: region.historicalRiskWeight,
      }
    }

    const nearestStation = findNearestCgeStation(
      input.lat,
      input.lon,
      DEFAULT_CGE_STATION_MAX_DISTANCE_METERS,
    )
    const coordId = `coord:${input.lat.toFixed(4)},${input.lon.toFixed(4)}`

    if (nearestStation) {
      const nearestRegion = await this.deps.regionRepository.findNearest(input.lat, input.lon, 5_000)
      return {
        id: coordId,
        name: `São Paulo — próximo a ${nearestStation.name}`,
        city: 'São Paulo',
        state: 'SP',
        ibgeCode: SAO_PAULO_IBGE_CODE,
        zone: nearestStation.zone,
        latitude: input.lat,
        longitude: input.lon,
        cgeStationId: nearestStation.id,
        cgeStationName: nearestStation.name,
        historicalRiskWeight: nearestRegion?.historicalRiskWeight ?? 0.75,
      }
    }

    return {
      id: coordId,
      name: `Coordenada (${input.lat.toFixed(4)}, ${input.lon.toFixed(4)})`,
      city: null,
      state: null,
      ibgeCode: null,
      zone: null,
      latitude: input.lat,
      longitude: input.lon,
      cgeStationId: null,
      cgeStationName: null,
      historicalRiskWeight: 0.5,
    }
  }
}
