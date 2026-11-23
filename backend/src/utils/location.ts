const EARTH_RADIUS_METERS = 6_371_000

function degToRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/** Distância em metros entre duas coordenadas geográficas (fórmula de Haversine). */
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = degToRad(lat2 - lat1)
  const dLon = degToRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}

/** Verifica se uma coordenada está dentro do raio máximo permitido em relação a um ponto de referência. */
export function isLocationWithinRadius(
  pointLat: number,
  pointLon: number,
  targetLat: number,
  targetLon: number,
  maxRadiusMeters: number,
): boolean {
  return getDistanceInMeters(pointLat, pointLon, targetLat, targetLon) <= maxRadiusMeters
}
