import booleanIntersects from '@turf/boolean-intersects'
import buffer from '@turf/buffer'
import { lineString, multiPolygon, polygon } from '@turf/helpers'
import type { FloodingPoint } from '../../providers/flooding-monitor-provider.js'
import type { FloodSusceptibilityPolygon } from '../../providers/flood-susceptibility-provider.js'
import type { SeverityLevel } from '../alerts/alert-types.js'
import type { RoadFloodFeature, RoadFloodFeatureCollection } from './player-types.js'

const TITLE_STOPWORDS = new Set([
  'JORNALISTA',
  'PREF',
  'PREFEITO',
  'DR',
  'DOUTOR',
  'SEN',
  'SENADOR',
  'EMB',
  'EMBAIXADOR',
  'PRES',
  'PRESIDENTE',
])

const CGE_TRACK_SUFFIXES = new Set([
  'ASCB',
  'AC',
  'CB',
  'CENTRAL',
  'EXPRESSA',
  'LOCAL',
  'PISTA',
])

const TOKEN_EXPANSIONS: Record<string, string> = {
  AV: 'AVENIDA',
  R: 'RUA',
  PTE: 'PONTE',
  VD: 'VIADUTO',
  TRAV: 'TRAVESSA',
  MARG: 'MARGINAL',
  AL: 'ALAMEDA',
  EST: 'ESTRADA',
  PCA: 'PRACA',
  TUN: 'TUNEL',
  MARQ: 'MARQUES',
}

const SEVERITY_BASE_INTENSITY: Record<SeverityLevel, number> = {
  0: 0,
  1: 0.3,
  2: 0.55,
  3: 0.8,
}

export interface RoadSegmentForMatching {
  osmId: string
  streetName: string
  highway: string
  isPrimaryCorridor: boolean
  coordinates: Array<[number, number]>
}

export interface MatchRoadRiskInput {
  roads: readonly RoadSegmentForMatching[]
  floodingPoints: readonly FloodingPoint[]
  geoSampaZones: readonly FloodSusceptibilityPolygon[]
  severityLevel: SeverityLevel
  corridorAliases?: readonly string[]
}

/**
 * Normaliza nomes de vias para matching CGE-SP ↔ OSM:
 * NFD + uppercase + remoção de títulos + expansão de prefixos (`AV` -> `AVENIDA`, etc.).
 */
export function normalizeStreetName(raw: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()

  if (!cleaned) {
    return ''
  }

  const tokens = cleaned
    .split(/\s+/)
    .filter((token) => token.length > 0 && !TITLE_STOPWORDS.has(token))
    .map((token) => TOKEN_EXPANSIONS[token] ?? token)

  while (tokens.length > 2 && CGE_TRACK_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop()
  }

  return tokens.join(' ')
}

function streetsMatch(normalizedA: string, normalizedB: string): boolean {
  if (!normalizedA || !normalizedB) {
    return false
  }
  if (normalizedA === normalizedB) {
    return true
  }
  const shorter = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB
  const longer = normalizedA.length <= normalizedB.length ? normalizedB : normalizedA
  return shorter.length >= 8 && longer.includes(shorter)
}

function toTurfZoneFeature(zone: FloodSusceptibilityPolygon) {
  try {
    if (zone.geometry.type === 'Polygon') {
      return polygon(zone.geometry.coordinates)
    }
    return multiPolygon(zone.geometry.coordinates)
  } catch {
    return null
  }
}

function isRoadInGeoSampaZone(
  coordinates: Array<[number, number]>,
  zoneFeatures: ReadonlyArray<ReturnType<typeof polygon> | ReturnType<typeof multiPolygon>>,
): boolean {
  if (coordinates.length < 2 || zoneFeatures.length === 0) {
    return false
  }

  try {
    const roadLine = lineString(coordinates)
    const buffered = buffer(roadLine, 0.02, { units: 'kilometers' })
    if (!buffered) {
      return false
    }

    return zoneFeatures.some((zoneFeature) => booleanIntersects(buffered, zoneFeature))
  } catch {
    return false
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function calculateRiskIntensity(params: {
  severityLevel: SeverityLevel
  isPrimaryCorridor: boolean
  matchedCge: boolean
  matchedCgeImpassable: boolean
  inGeoSampaZone: boolean
}): number {
  const {
    severityLevel,
    isPrimaryCorridor,
    matchedCge,
    matchedCgeImpassable,
    inGeoSampaZone,
  } = params

  if (severityLevel === 0) {
    return 0
  }

  if (!matchedCge && !inGeoSampaZone && !isPrimaryCorridor) {
    return 0
  }

  const base = SEVERITY_BASE_INTENSITY[severityLevel]
  const bonus =
    (matchedCge ? 0.25 : 0) +
    (matchedCgeImpassable ? 0.15 : 0) +
    (inGeoSampaZone ? 0.15 : 0)

  return Math.round(clamp(base + bonus, 0, 1) * 100) / 100
}

export function matchRoadRisk(input: MatchRoadRiskInput): RoadFloodFeatureCollection {
  const activeCgePoints = input.floodingPoints
    .filter((point) => point.active)
    .map((point) => ({
      normalizedStreet: normalizeStreetName(point.street),
      impassable: !point.passable,
    }))

  const normalizedAliases = (input.corridorAliases ?? [])
    .map(normalizeStreetName)
    .filter((alias) => alias.length > 0)

  const zoneFeatures = input.geoSampaZones
    .map(toTurfZoneFeature)
    .filter(
      (feature): feature is NonNullable<ReturnType<typeof toTurfZoneFeature>> => feature !== null,
    )

  const features: RoadFloodFeature[] = input.roads
    .filter((road) => road.coordinates.length >= 2)
    .map((road) => {
      const normalizedRoadStreet = normalizeStreetName(road.streetName)
      const candidatesForRoad = road.isPrimaryCorridor
        ? [normalizedRoadStreet, ...normalizedAliases]
        : [normalizedRoadStreet]

      let matchedCge = false
      let matchedCgeImpassable = false

      for (const cgePoint of activeCgePoints) {
        if (candidatesForRoad.some((candidate) => streetsMatch(candidate, cgePoint.normalizedStreet))) {
          matchedCge = true
          if (cgePoint.impassable) {
            matchedCgeImpassable = true
          }
        }
      }

      const inGeoSampaZone = isRoadInGeoSampaZone(road.coordinates, zoneFeatures)
      const riskIntensity = calculateRiskIntensity({
        severityLevel: input.severityLevel,
        isPrimaryCorridor: road.isPrimaryCorridor,
        matchedCge,
        matchedCgeImpassable,
        inGeoSampaZone,
      })

      return {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: road.coordinates,
        },
        properties: {
          osmId: road.osmId,
          streetName: road.streetName,
          highway: road.highway,
          isPrimaryCorridor: road.isPrimaryCorridor,
          matchedCge,
          matchedCgeImpassable,
          inGeoSampaZone,
          riskIntensity,
        },
      }
    })

  return {
    type: 'FeatureCollection',
    features,
  }
}
