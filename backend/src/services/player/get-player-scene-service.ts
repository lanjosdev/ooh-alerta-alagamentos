import { env } from '../../env.js'
import type { CacheLookupResult, MemoryCache } from '../../lib/cache.js'
import { logger } from '../../lib/logger.js'
import {
  DEFAULT_CGE_STATION_MAX_DISTANCE_METERS,
  SAO_PAULO_IBGE_CODE,
  findNearestCgeStation,
} from '../../providers/cge-sp/cge-sp-stations.js'
import type {
  FloodSusceptibilityPolygon,
  FloodSusceptibilityProvider,
} from '../../providers/flood-susceptibility-provider.js'
import type { RoadGeometryProvider, RoadSegment } from '../../providers/road-geometry-provider.js'
import type { OohAsset, OohAssetRepository } from '../../repositories/ooh-asset-repository.js'
import { NotFoundError } from '../../utils/application-error.js'
import { getDistanceInMeters } from '../../utils/location.js'
import type { SimulationMode, SourceExecutionStatus } from '../alerts/alert-types.js'
import type { GetLocationAlertService } from '../alerts/get-location-alert-service.js'
import { buildPlayerEditorial } from './build-player-editorial.js'
import { type RoadSegmentForMatching, matchRoadRisk, normalizeStreetName } from './match-road-risk.js'
import type { PlayerCamera, PlayerSceneData } from './player-types.js'

export type GetPlayerSceneInput =
  | {
      assetId: string
      date?: string
      time?: string
      cgeDate?: string
      simulate?: SimulationMode
    }
  | {
      lat: number
      lon: number
      date?: string
      time?: string
      cgeDate?: string
      simulate?: SimulationMode
    }

export interface GetPlayerSceneDependencies {
  oohAssetRepository: OohAssetRepository
  getLocationAlertService: GetLocationAlertService
  roadGeometryProvider: RoadGeometryProvider
  floodSusceptibilityProvider: FloodSusceptibilityProvider
  cache: MemoryCache
  cacheTtls?: {
    overpassSeconds?: number
    geoSampaSeconds?: number
  }
  overpassCooldownMs?: number
  nowFn?: () => number
}

const DEFAULT_OVERPASS_COOLDOWN_MS = 30_000
const CURATED_SNAPSHOT_PROVIDER = 'osm-curated-snapshot'

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function markNearestStreetAsPrimary(
  segments: readonly RoadSegment[],
  lat: number,
  lon: number,
): RoadSegmentForMatching[] {
  if (segments.length === 0) {
    return []
  }

  let closestStreetNormalized: string | null = null
  let minDistanceMeters = Number.POSITIVE_INFINITY

  for (const segment of segments) {
    for (const [segLon, segLat] of segment.coordinates) {
      const distance = getDistanceInMeters(lat, lon, segLat, segLon)
      if (distance < minDistanceMeters) {
        minDistanceMeters = distance
        closestStreetNormalized = normalizeStreetName(segment.streetName)
      }
    }
  }

  return segments.map((segment) => {
    const isPrimary =
      closestStreetNormalized !== null &&
      closestStreetNormalized.length > 0 &&
      normalizeStreetName(segment.streetName) === closestStreetNormalized

    return {
      osmId: segment.osmId,
      streetName: segment.streetName,
      highway: segment.highway,
      isPrimaryCorridor: isPrimary,
      coordinates: segment.coordinates,
    }
  })
}

function buildCoordinatesCamera(
  lat: number,
  lon: number,
  segments: readonly RoadSegmentForMatching[],
): PlayerCamera {
  let minLon = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const segment of segments) {
    for (const [segLon, segLat] of segment.coordinates) {
      if (segLon < minLon) minLon = segLon
      if (segLat < minLat) minLat = segLat
      if (segLon > maxLon) maxLon = segLon
      if (segLat > maxLat) maxLat = segLat
    }
  }

  const bounds: [[number, number], [number, number]] = Number.isFinite(minLon)
    ? [
        [roundCoord(minLon), roundCoord(minLat)],
        [roundCoord(maxLon), roundCoord(maxLat)],
      ]
    : [
        [roundCoord(lon - 0.0045), roundCoord(lat - 0.0045)],
        [roundCoord(lon + 0.0045), roundCoord(lat + 0.0045)],
      ]

  return {
    center: [roundCoord(lon), roundCoord(lat)],
    zoom: 15.2,
    bearing: 0,
    bounds,
  }
}

export class GetPlayerSceneService {
  private readonly overpassTtlSeconds: number
  private readonly geoSampaTtlSeconds: number
  private readonly overpassCooldownMs: number
  private readonly nowFn: () => number
  private overpassCooldownUntilMs = 0
  private lastOverpassError: string | null = null

  constructor(private readonly deps: GetPlayerSceneDependencies) {
    this.overpassTtlSeconds =
      deps.cacheTtls?.overpassSeconds ?? env.CACHE_TTL_OVERPASS_SECONDS
    this.geoSampaTtlSeconds =
      deps.cacheTtls?.geoSampaSeconds ?? env.CACHE_TTL_GEOSAMPA_SECONDS
    this.overpassCooldownMs = deps.overpassCooldownMs ?? DEFAULT_OVERPASS_COOLDOWN_MS
    this.nowFn = deps.nowFn ?? (() => Date.now())
  }

  async execute(input: GetPlayerSceneInput): Promise<PlayerSceneData> {
    this.deps.getLocationAlertService.validateInput({
      date: input.date,
      time: input.time,
      cgeDate: input.cgeDate,
      simulate: input.simulate,
    })

    let curatedAsset: OohAsset | null = null
    let targetLat: number
    let targetLon: number
    let targetKind: 'asset' | 'coordinates'

    if ('assetId' in input) {
      curatedAsset = await this.deps.oohAssetRepository.findById(input.assetId)
      if (!curatedAsset) {
        throw new NotFoundError(`Ativo OOH '${input.assetId}' não encontrado`)
      }
      targetLat = curatedAsset.latitude
      targetLon = curatedAsset.longitude
      targetKind = 'asset'
    } else {
      targetLat = input.lat
      targetLon = input.lon
      targetKind = 'coordinates'
    }

    const decisionPromise = this.deps.getLocationAlertService.execute({
      mode: 'coordinates',
      lat: targetLat,
      lon: targetLon,
      date: input.date,
      time: input.time,
      cgeDate: input.cgeDate,
      simulate: input.simulate,
    })

    const roadsPromise: Promise<{
      roads: RoadSegmentForMatching[]
      status: SourceExecutionStatus
    }> = curatedAsset
      ? Promise.resolve({
          roads: curatedAsset.roads,
          status: {
            provider: CURATED_SNAPSHOT_PROVIDER,
            status: 'ok',
            cached: true,
            stale: false,
            fetchedAt: null,
            error: null,
          },
        })
      : this.fetchOverpassRoads(targetLat, targetLon)

    const isCapitalSpTarget =
      curatedAsset !== null ||
      findNearestCgeStation(targetLat, targetLon, DEFAULT_CGE_STATION_MAX_DISTANCE_METERS) !==
        null

    const geoSampaPromise: Promise<{
      zones: FloodSusceptibilityPolygon[]
      status: SourceExecutionStatus
    }> = isCapitalSpTarget
      ? this.fetchGeoSampaZones(targetLat, targetLon)
      : Promise.resolve({
          zones: [],
          status: {
            provider: this.deps.floodSusceptibilityProvider.providerName,
            status: 'skipped',
            cached: false,
            stale: false,
            fetchedAt: null,
            error: null,
          },
        })

    const [decision, roadsResult, geoSampaResult] = await Promise.all([
      decisionPromise,
      roadsPromise,
      geoSampaPromise,
    ])

    const camera = curatedAsset
      ? curatedAsset.camera
      : buildCoordinatesCamera(targetLat, targetLon, roadsResult.roads)

    const roads = matchRoadRisk({
      roads: roadsResult.roads,
      floodingPoints: decision.flooding.pointsInZone,
      geoSampaZones: geoSampaResult.zones,
      severityLevel: decision.severityLevel,
      corridorAliases: curatedAsset?.aliases,
    })

    const sources = {
      forecast: decision.sources.forecast,
      officialAlerts: decision.sources.officialAlerts,
      floodingMonitor: decision.sources.floodingMonitor,
      roadGeometry: roadsResult.status,
      floodSusceptibility: geoSampaResult.status,
    }

    const editorial = buildPlayerEditorial({
      decision,
      corridorNameOverride: curatedAsset?.corridorName,
      hasGeoSampaData: geoSampaResult.zones.length > 0,
      sources,
    })

    return {
      evaluatedAt: decision.evaluatedAt,
      assetId: curatedAsset?.id ?? null,
      targetKind,
      decision,
      editorial,
      camera,
      roads,
      geoSampaZonesCount: geoSampaResult.zones.length,
      sources,
    }
  }

  private async fetchOverpassRoads(
    lat: number,
    lon: number,
  ): Promise<{ roads: RoadSegmentForMatching[]; status: SourceExecutionStatus }> {
    const { roadGeometryProvider, cache } = this.deps
    try {
      const lookup: CacheLookupResult<RoadSegment[]> = await cache.getOrFetch({
        provider: roadGeometryProvider.providerName,
        key: `overpass:${lat.toFixed(3)}:${lon.toFixed(3)}`,
        ttlSeconds: this.overpassTtlSeconds,
        fetcher: async () => {
          if (this.nowFn() < this.overpassCooldownUntilMs) {
            throw new Error(
              `Overpass em cooldown após falha recente: ${this.lastOverpassError ?? 'indisponível'}`,
            )
          }

          try {
            const segments = await roadGeometryProvider.getNearbyRoads(lat, lon)
            this.overpassCooldownUntilMs = 0
            this.lastOverpassError = null
            return segments
          } catch (error) {
            this.overpassCooldownUntilMs = this.nowFn() + this.overpassCooldownMs
            this.lastOverpassError = toErrorMessage(error)
            throw error
          }
        },
      })

      return {
        roads: markNearestStreetAsPrimary(lookup.value, lat, lon),
        status: {
          provider: roadGeometryProvider.providerName,
          status: lookup.stale ? 'stale' : 'ok',
          cached: lookup.cached,
          stale: lookup.stale,
          fetchedAt: lookup.fetchedAt,
          error: null,
        },
      }
    } catch (error) {
      logger.warn({ err: error, lat, lon }, 'Falha ao buscar geometria viária via Overpass')
      return {
        roads: [],
        status: {
          provider: roadGeometryProvider.providerName,
          status: 'error',
          cached: false,
          stale: false,
          fetchedAt: null,
          error: toErrorMessage(error),
        },
      }
    }
  }

  private async fetchGeoSampaZones(
    lat: number,
    lon: number,
  ): Promise<{ zones: FloodSusceptibilityPolygon[]; status: SourceExecutionStatus }> {
    const { floodSusceptibilityProvider, cache } = this.deps
    try {
      const lookup: CacheLookupResult<FloodSusceptibilityPolygon[]> = await cache.getOrFetch({
        provider: floodSusceptibilityProvider.providerName,
        key: `geosampa:${lat.toFixed(3)}:${lon.toFixed(3)}`,
        ttlSeconds: this.geoSampaTtlSeconds,
        fetcher: () => floodSusceptibilityProvider.getFloodZones(lat, lon),
      })

      return {
        zones: lookup.value,
        status: {
          provider: floodSusceptibilityProvider.providerName,
          status: lookup.stale ? 'stale' : 'ok',
          cached: lookup.cached,
          stale: lookup.stale,
          fetchedAt: lookup.fetchedAt,
          error: null,
        },
      }
    } catch (error) {
      logger.warn({ err: error, lat, lon }, 'Falha ao buscar manchas GeoSampa WFS')
      return {
        zones: [],
        status: {
          provider: floodSusceptibilityProvider.providerName,
          status: 'error',
          cached: false,
          stale: false,
          fetchedAt: null,
          error: toErrorMessage(error),
        },
      }
    }
  }
}
