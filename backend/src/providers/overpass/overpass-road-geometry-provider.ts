import { z } from 'zod'
import { env } from '../../env.js'
import { logger } from '../../lib/logger.js'
import type { RoadGeometryProvider, RoadSegment } from '../road-geometry-provider.js'

const DEFAULT_PRIMARY_RADIUS_METERS = 300
const DEFAULT_FALLBACK_RADIUS_METERS = 450
const DEFAULT_TOTAL_BUDGET_MS = 8_000
const DEFAULT_PER_MIRROR_TIMEOUT_MS = 6_500
const METERS_PER_DEGREE_LAT = 111_320

const PRIMARY_HIGHWAY_REGEX = '^(motorway|trunk|primary|secondary|tertiary)(_link)?$'
const FALLBACK_HIGHWAY_REGEX =
  '^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)(_link)?$'

const overpassNodeSchema = z.object({
  lat: z.number(),
  lon: z.number(),
})

const overpassElementSchema = z.object({
  type: z.string(),
  id: z.number(),
  tags: z
    .object({
      name: z.string().optional(),
      highway: z.string().optional(),
    })
    .optional(),
  geometry: z.array(overpassNodeSchema).optional(),
})

const overpassResponseSchema = z.object({
  elements: z.array(overpassElementSchema),
})

export interface OverpassRoadGeometryProviderOptions {
  fetchFn?: typeof fetch
  urls?: string[]
  userAgent?: string
  totalBudgetMs?: number
  perMirrorTimeoutMs?: number
  nowFn?: () => number
}

function buildOverpassQuery(
  lat: number,
  lon: number,
  radiusMeters: number,
  highwayRegex: string,
): string {
  const deltaLat = radiusMeters / METERS_PER_DEGREE_LAT
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const deltaLon = radiusMeters / (METERS_PER_DEGREE_LAT * cosLat)

  const south = (lat - deltaLat).toFixed(6)
  const west = (lon - deltaLon).toFixed(6)
  const north = (lat + deltaLat).toFixed(6)
  const east = (lon + deltaLon).toFixed(6)

  return `[out:json][timeout:6];way(${south},${west},${north},${east})["highway"~"${highwayRegex}"];out tags geom;`
}

function parseOverpassUrls(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

export class OverpassRoadGeometryProvider implements RoadGeometryProvider {
  readonly providerName = 'overpass'

  private readonly fetchFn: typeof fetch
  private readonly urls: string[]
  private readonly userAgent: string
  private readonly totalBudgetMs: number
  private readonly perMirrorTimeoutMs: number
  private readonly nowFn: () => number

  constructor(options: OverpassRoadGeometryProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.urls = options.urls ?? parseOverpassUrls(env.OVERPASS_URLS)
    this.userAgent = options.userAgent ?? env.NOMINATIM_USER_AGENT
    this.totalBudgetMs = options.totalBudgetMs ?? DEFAULT_TOTAL_BUDGET_MS
    this.perMirrorTimeoutMs = options.perMirrorTimeoutMs ?? DEFAULT_PER_MIRROR_TIMEOUT_MS
    this.nowFn = options.nowFn ?? (() => Date.now())
  }

  async getNearbyRoads(
    lat: number,
    lon: number,
    radiusMeters: number = DEFAULT_PRIMARY_RADIUS_METERS,
  ): Promise<RoadSegment[]> {
    const deadlineMs = this.nowFn() + this.totalBudgetMs

    const primarySegments = await this.queryWithMirrors(
      buildOverpassQuery(lat, lon, radiusMeters, PRIMARY_HIGHWAY_REGEX),
      deadlineMs,
    )

    if (primarySegments.length > 0) {
      return primarySegments
    }

    const remainingMs = deadlineMs - this.nowFn()
    if (remainingMs <= 300) {
      return []
    }

    const expandedRadius = Math.max(radiusMeters, DEFAULT_FALLBACK_RADIUS_METERS)
    return this.queryWithMirrors(
      buildOverpassQuery(lat, lon, expandedRadius, FALLBACK_HIGHWAY_REGEX),
      deadlineMs,
    )
  }

  private async queryWithMirrors(query: string, deadlineMs: number): Promise<RoadSegment[]> {
    if (this.urls.length === 0) {
      throw new Error('Nenhum endpoint Overpass configurado em OVERPASS_URLS')
    }

    const remainingMs = deadlineMs - this.nowFn()
    if (remainingMs <= 0) {
      throw new Error('Orçamento de tempo esgotado ao consultar Overpass API')
    }

    const requestTimeoutMs = Math.min(this.perMirrorTimeoutMs, remainingMs)
    const raceController = new AbortController()
    const timeoutId = setTimeout(() => {
      raceController.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    }, requestTimeoutMs)

    const body = new URLSearchParams({ data: query }).toString()

    const mirrorPromises = this.urls.map(async (mirrorUrl): Promise<RoadSegment[]> => {
      try {
        const response = await this.fetchFn(mirrorUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            accept: 'application/json',
            'user-agent': this.userAgent,
          },
          body,
          signal: raceController.signal,
        })

        if (!response.ok) {
          throw new Error(`Overpass (${mirrorUrl}) respondeu HTTP ${response.status}`)
        }

        const rawJson: unknown = await response.json()
        const payload = overpassResponseSchema.parse(rawJson)

        const segments: RoadSegment[] = []
        for (const element of payload.elements) {
          if (element.type !== 'way' || !element.geometry || element.geometry.length < 2) {
            continue
          }

          segments.push({
            osmId: String(element.id),
            streetName: element.tags?.name?.trim() || 'Via sem nome',
            highway: element.tags?.highway?.trim() || 'road',
            coordinates: element.geometry.map((node) => [node.lon, node.lat]),
          })
        }

        return segments
      } catch (error) {
        if (!raceController.signal.aborted) {
          logger.warn({ mirrorUrl, err: error }, 'Falha ao consultar mirror Overpass')
        }
        throw error
      }
    })

    try {
      const winnerSegments = await Promise.any(mirrorPromises)
      clearTimeout(timeoutId)
      raceController.abort()
      return winnerSegments
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof AggregateError) {
        const firstError = error.errors.find((entry): entry is Error => entry instanceof Error)
        if (firstError) {
          throw firstError
        }
      }
      throw error instanceof Error
        ? error
        : new Error('Orçamento de tempo esgotado ao consultar Overpass API')
    }
  }
}
