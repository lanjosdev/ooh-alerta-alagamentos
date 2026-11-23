export type GeoJsonPosition = readonly [number, number]
export type GeoJsonLinearRing = readonly GeoJsonPosition[]

export interface GeoJsonPolygon {
  type: 'Polygon'
  coordinates: readonly GeoJsonLinearRing[]
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon'
  coordinates: readonly (readonly GeoJsonLinearRing[])[]
}

export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon

const SEGMENT_EPSILON = 1e-12

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parsePosition(value: unknown): GeoJsonPosition | null {
  if (!Array.isArray(value) || value.length < 2) {
    return null
  }

  const lon = value[0]
  const lat = value[1]
  if (typeof lon !== 'number' || !Number.isFinite(lon) || typeof lat !== 'number' || !Number.isFinite(lat)) {
    return null
  }

  return [lon, lat]
}

function parseLinearRing(value: unknown): GeoJsonLinearRing | null {
  if (!Array.isArray(value) || value.length < 3) {
    return null
  }

  const ring: GeoJsonPosition[] = []
  for (const item of value) {
    const pos = parsePosition(item)
    if (!pos) {
      return null
    }
    ring.push(pos)
  }

  return ring
}

function parsePolygonCoordinates(value: unknown): readonly GeoJsonLinearRing[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const rings: GeoJsonLinearRing[] = []
  for (const rawRing of value) {
    const ring = parseLinearRing(rawRing)
    if (!ring) {
      return null
    }
    rings.push(ring)
  }

  return rings
}

function parseGeometryObject(value: unknown): GeoJsonGeometry | null {
  if (!isRecord(value)) {
    return null
  }

  if (value.type === 'Feature') {
    return parseGeometryObject(value.geometry)
  }

  if (value.type === 'Polygon') {
    const coordinates = parsePolygonCoordinates(value.coordinates)
    if (!coordinates) {
      return null
    }
    return { type: 'Polygon', coordinates }
  }

  if (value.type === 'MultiPolygon') {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
      return null
    }
    const polygons: (readonly GeoJsonLinearRing[])[] = []
    for (const rawPolygon of value.coordinates) {
      const polygon = parsePolygonCoordinates(rawPolygon)
      if (!polygon) {
        return null
      }
      polygons.push(polygon)
    }
    return { type: 'MultiPolygon', coordinates: polygons }
  }

  return null
}

/** Faz parse defensivo de string JSON contendo GeoJSON Polygon, MultiPolygon ou Feature. */
export function parseGeoJsonGeometry(raw: string | null | undefined): GeoJsonGeometry | null {
  if (!raw || typeof raw !== 'string') {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return parseGeometryObject(parsed)
  } catch {
    return null
  }
}

function isPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax)
  if (Math.abs(cross) > SEGMENT_EPSILON) {
    return false
  }

  const minX = Math.min(ax, bx) - SEGMENT_EPSILON
  const maxX = Math.max(ax, bx) + SEGMENT_EPSILON
  const minY = Math.min(ay, by) - SEGMENT_EPSILON
  const maxY = Math.max(ay, by) + SEGMENT_EPSILON

  return px >= minX && px <= maxX && py >= minY && py <= maxY
}

function isPointInRing(lon: number, lat: number, ring: GeoJsonLinearRing): boolean {
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]

    if (isPointOnSegment(lon, lat, xi, yi, xj, yj)) {
      return true
    }

    const crossesLatitude = (yi > lat) !== (yj > lat)
    if (crossesLatitude) {
      const intersectLon = ((xj - xi) * (lat - yi)) / (yj - yi) + xi
      if (lon < intersectLon) {
        inside = !inside
      }
    }
  }

  return inside
}

function isPointInPolygonRings(
  lat: number,
  lon: number,
  rings: readonly GeoJsonLinearRing[],
): boolean {
  if (rings.length === 0) {
    return false
  }

  if (!isPointInRing(lon, lat, rings[0])) {
    return false
  }

  for (let i = 1; i < rings.length; i++) {
    if (isPointInRing(lon, lat, rings[i])) {
      return false
    }
  }

  return true
}

/** Verifica se a coordenada (lat, lon) está contida na geometria GeoJSON (anéis [lon, lat]). */
export function isPointInGeoJson(lat: number, lon: number, geometry: GeoJsonGeometry): boolean {
  if (geometry.type === 'Polygon') {
    return isPointInPolygonRings(lat, lon, geometry.coordinates)
  }

  return geometry.coordinates.some((polygonRings) => isPointInPolygonRings(lat, lon, polygonRings))
}
