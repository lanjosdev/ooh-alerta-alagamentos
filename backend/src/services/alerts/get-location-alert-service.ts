import { env } from '../../env.js'
import type { CacheLookupResult, MemoryCache } from '../../lib/cache.js'
import {
  DEFAULT_CGE_STATION_MAX_DISTANCE_METERS,
  SAO_PAULO_IBGE_CODE,
  findCgeStationById,
  findNearestCgeStation,
} from '../../providers/cge-sp/cge-sp-stations.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from '../../providers/flooding-monitor-provider.js'
import type { ForecastProvider, RegionForecast } from '../../providers/forecast-provider.js'
import type {
  OfficialAlertsProvider,
  OfficialWeatherAlert,
} from '../../providers/official-alerts-provider.js'
import {
  type RegionRepository,
  normalizeRegionText,
} from '../../repositories/region-repository.js'
import { BadRequestError, NotFoundError } from '../../utils/application-error.js'
import type {
  AlertLocationInfo,
  OohAlertDecision,
  SimulationMode,
  SourceExecutionStatus,
} from './alert-types.js'
import { BuildOohMessageService } from './build-ooh-message-service.js'
import { EvaluateRiskService } from './evaluate-risk-service.js'

export type GetLocationAlertInput =
  | {
      mode: 'region'
      regionId: string
      cgeDate?: string
      simulate?: SimulationMode
    }
  | {
      mode: 'coordinates'
      lat: number
      lon: number
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
  cacheTtls?: {
    forecastSeconds?: number
    inmetSeconds?: number
    cgeSeconds?: number
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

export class GetLocationAlertService {
  private readonly evaluateRiskService: EvaluateRiskService
  private readonly buildOohMessageService: BuildOohMessageService
  private readonly enableSimulationParams: boolean
  private readonly forecastTtlSeconds: number
  private readonly inmetTtlSeconds: number
  private readonly cgeTtlSeconds: number

  constructor(private readonly deps: GetLocationAlertDependencies) {
    this.evaluateRiskService = deps.evaluateRiskService ?? new EvaluateRiskService()
    this.buildOohMessageService = deps.buildOohMessageService ?? new BuildOohMessageService()
    this.enableSimulationParams = deps.enableSimulationParams ?? env.ENABLE_SIMULATION_PARAMS
    this.forecastTtlSeconds = deps.cacheTtls?.forecastSeconds ?? env.CACHE_TTL_FORECAST_SECONDS
    this.inmetTtlSeconds = deps.cacheTtls?.inmetSeconds ?? env.CACHE_TTL_INMET_SECONDS
    this.cgeTtlSeconds = deps.cacheTtls?.cgeSeconds ?? env.CACHE_TTL_CGE_SECONDS
  }

  isSimulationEnabled(): boolean {
    return this.enableSimulationParams
  }

  async execute(input: GetLocationAlertInput): Promise<OohAlertDecision> {
    if (!this.enableSimulationParams && (input.cgeDate !== undefined || input.simulate !== undefined)) {
      throw new BadRequestError(
        'Parâmetros de simulação (cgeDate e simulate) estão desabilitados neste ambiente.',
      )
    }

    const location = await this.resolveLocation(input)
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
          key: `cge-sp:floodings:${input.cgeDate ?? 'today'}`,
          ttlSeconds: this.cgeTtlSeconds,
          fetcher: () => floodingMonitorProvider.getFloodingPoints({ cgeDate: input.cgeDate }),
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
      floodingMonitorStatus = {
        provider: floodingMonitorProvider.providerName,
        status: 'skipped',
        cached: false,
        stale: false,
        fetchedAt: null,
        error: null,
      }
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

    const normalizedZone = location.zone ? normalizeRegionText(location.zone) : null
    const pointsInZone = normalizedZone
      ? allFloodingPoints.filter((point) => normalizeRegionText(point.zone) === normalizedZone)
      : []

    const activeInZone = pointsInZone.filter((point) => point.active)
    const impassableInZoneCount = activeInZone.filter((point) => !point.passable).length
    const passableInZoneCount = activeInZone.filter((point) => point.passable).length

    const evaluation = this.evaluateRiskService.execute({
      forecast: forecastResult.value,
      officialAlerts,
      floodingPointsInZone: pointsInZone,
      stationRainfall,
      historicalRiskWeight: location.historicalRiskWeight,
      simulate: input.simulate,
    })

    const display = this.buildOohMessageService.execute({
      locationName: location.name,
      zone: location.zone,
      evaluation,
      forecast: forecastResult.value,
      floodingPointsInZone: pointsInZone,
      officialAlerts,
    })

    return {
      evaluatedAt: new Date().toISOString(),
      location,
      triggerOverride: evaluation.triggerOverride,
      severityLevel: evaluation.severityLevel,
      severityLabel: evaluation.severityLabel,
      riskScore: evaluation.riskScore,
      simulated: evaluation.simulated,
      reasons: evaluation.reasons,
      display,
      forecast: forecastResult.value,
      officialAlerts,
      flooding: {
        cgeDate: includeCgeSp ? (input.cgeDate ?? null) : null,
        activeInZoneCount: activeInZone.length,
        impassableInZoneCount,
        passableInZoneCount,
        pointsInZone,
        stationRainfall,
      },
      sources: {
        forecast: forecastResult.status,
        officialAlerts: alertsResult.status,
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
