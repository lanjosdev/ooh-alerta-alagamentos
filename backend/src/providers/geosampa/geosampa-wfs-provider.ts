import { z } from 'zod'
import { logger } from '../../lib/logger.js'
import type {
  FloodSusceptibilityPolygon,
  FloodSusceptibilityProvider,
} from '../flood-susceptibility-provider.js'

const DEFAULT_GEOSAMPA_WFS_URL = 'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs'
const PRIMARY_LAYER_NAME = 'geoportal:mancha_inundacao_25'
const FALLBACK_LAYER_NAME = 'geoportal:area_inundavel'
const DEFAULT_RADIUS_METERS = 1_200
const DEFAULT_TIMEOUT_MS = 5_000
const METERS_PER_DEGREE_LAT = 111_320

const positionSchema = z.tuple([z.number(), z.number()])
const ringSchema = z.array(positionSchema).min(3)

const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(ringSchema).min(1),
})

const multiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(ringSchema).min(1)).min(1),
})

const wfsFeatureSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  type: z.literal('Feature'),
  geometry: z.union([polygonGeometrySchema, multiPolygonGeometrySchema]).nullable(),
})

const wfsFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(wfsFeatureSchema),
})

export interface GeoSampaWfsProviderOptions {
  fetchFn?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
}

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function buildGeoSampaWfsUrl(
  baseUrl: string,
  layerName: string,
  lat: number,
  lon: number,
  radiusMeters: number,
): string {
  const dLat = radiusMeters / METERS_PER_DEGREE_LAT
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  const dLon = radiusMeters / (METERS_PER_DEGREE_LAT * cosLat)

  const minLat = roundCoord(lat - dLat)
  const maxLat = roundCoord(lat + dLat)
  const minLon = roundCoord(lon - dLon)
  const maxLon = roundCoord(lon + dLon)

  const url = new URL(baseUrl)
  url.searchParams.set('service', 'WFS')
  url.searchParams.set('version', '2.0.0')
  url.searchParams.set('request', 'GetFeature')
  url.searchParams.set('typeNames', layerName)
  url.searchParams.set('outputFormat', 'application/json')
  url.searchParams.set('srsName', 'EPSG:4326')
  url.searchParams.set('count', '500')
  url.searchParams.set(
    'bbox',
    `${minLat},${minLon},${maxLat},${maxLon},urn:ogc:def:crs:EPSG::4326`,
  )
  return url.toString()
}

export class GeoSampaWfsProvider implements FloodSusceptibilityProvider {
  readonly providerName = 'geosampa-wfs'

  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(options: GeoSampaWfsProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.baseUrl = options.baseUrl ?? DEFAULT_GEOSAMPA_WFS_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async getFloodZones(
    lat: number,
    lon: number,
    radiusMeters: number = DEFAULT_RADIUS_METERS,
  ): Promise<FloodSusceptibilityPolygon[]> {
    try {
      return await this.fetchLayer(PRIMARY_LAYER_NAME, lat, lon, radiusMeters)
    } catch (primaryError) {
      logger.warn(
        { err: primaryError, layer: PRIMARY_LAYER_NAME },
        'Falha ao consultar camada primária GeoSampa WFS; tentando fallback',
      )
      return await this.fetchLayer(FALLBACK_LAYER_NAME, lat, lon, radiusMeters)
    }
  }

  private async fetchLayer(
    layerName: string,
    lat: number,
    lon: number,
    radiusMeters: number,
  ): Promise<FloodSusceptibilityPolygon[]> {
    const url = buildGeoSampaWfsUrl(this.baseUrl, layerName, lat, lon, radiusMeters)

    const response = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`GeoSampa WFS (${layerName}) respondeu HTTP ${response.status}`)
    }

    const rawJson: unknown = await response.json()
    const collection = wfsFeatureCollectionSchema.parse(rawJson)

    const zones: FloodSusceptibilityPolygon[] = []
    collection.features.forEach((feature, index) => {
      if (!feature.geometry) {
        return
      }
      zones.push({
        id: feature.id !== undefined ? String(feature.id) : `${layerName}:${index}`,
        layerName,
        geometry: feature.geometry,
      })
    })

    return zones
  }
}
