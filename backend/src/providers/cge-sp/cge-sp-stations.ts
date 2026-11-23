import { getDistanceInMeters } from '../../utils/location.js'

export const SAO_PAULO_IBGE_CODE = '3550308'
export const DEFAULT_CGE_STATION_MAX_DISTANCE_METERS = 12_000

export interface CgeStation {
  id: string
  name: string
  zone: string
  latitude: number
  longitude: number
}

export interface CgeStationMatch extends CgeStation {
  distanceMeters: number
}

/**
 * Catálogo completo das 28 estações meteorológicas automáticas do CGE-SP na Capital SP.
 * Permite mapear qualquer coordenada dentro da cidade para a estação física e zona mais próximas.
 */
export const CGE_SP_STATIONS: readonly CgeStation[] = [
  // Centro
  { id: '503', name: 'Sé / Centro', zone: 'Centro', latitude: -23.5505, longitude: -46.6333 },

  // Zona Norte
  { id: '504', name: 'Perus', zone: 'Zona Norte', latitude: -23.4062, longitude: -46.7536 },
  { id: '515', name: 'Pirituba', zone: 'Zona Norte', latitude: -23.4883, longitude: -46.7277 },
  { id: '509', name: 'Freguesia do Ó', zone: 'Zona Norte', latitude: -23.4956, longitude: -46.6955 },
  { id: '510', name: 'Santana / Tucuruvi', zone: 'Zona Norte', latitude: -23.4958, longitude: -46.6251 },
  { id: '1000944', name: 'Tremembé', zone: 'Zona Norte', latitude: -23.4573, longitude: -46.6177 },
  { id: '540', name: 'Vila Maria / Guilherme', zone: 'Zona Norte', latitude: -23.5133, longitude: -46.5931 },

  // Zona Oeste
  { id: '1000848', name: 'Lapa', zone: 'Zona Oeste', latitude: -23.5228, longitude: -46.7019 },
  { id: '1000635', name: 'Pinheiros', zone: 'Zona Oeste', latitude: -23.5614, longitude: -46.6915 },
  { id: '1000842', name: 'Butantã', zone: 'Zona Oeste', latitude: -23.5672, longitude: -46.729 },

  // Zona Leste
  { id: '1000887', name: 'Penha', zone: 'Zona Leste', latitude: -23.5236, longitude: -46.5406 },
  { id: '1000860', name: 'Mooca', zone: 'Zona Leste', latitude: -23.5542, longitude: -46.5988 },
  { id: '1000859', name: 'Vila Formosa', zone: 'Zona Leste', latitude: -23.5665, longitude: -46.5484 },
  { id: '1000864', name: 'Itaquera', zone: 'Zona Leste', latitude: -23.5405, longitude: -46.4565 },
  { id: '1000862', name: 'São Miguel Paulista', zone: 'Zona Leste', latitude: -23.4981, longitude: -46.4408 },
  { id: '1000882', name: 'Itaim Paulista', zone: 'Zona Leste', latitude: -23.5015, longitude: -46.4017 },
  { id: '1000844', name: 'São Mateus', zone: 'Zona Leste', latitude: -23.6119, longitude: -46.4733 },

  // Zona Sudeste
  { id: '524', name: 'Vila Prudente', zone: 'Zona Sudeste', latitude: -23.5847, longitude: -46.582 },
  { id: '1000840', name: 'Ipiranga', zone: 'Zona Sudeste', latitude: -23.5919, longitude: -46.6061 },

  // Zona Sul
  { id: '495', name: 'Vila Mariana', zone: 'Zona Sul', latitude: -23.5895, longitude: -46.6347 },
  { id: '634', name: 'Jabaquara', zone: 'Zona Sul', latitude: -23.6431, longitude: -46.6436 },
  { id: '1000852', name: 'Santo Amaro', zone: 'Zona Sul', latitude: -23.6528, longitude: -46.7098 },
  { id: '1000854', name: 'Campo Limpo', zone: 'Zona Sul', latitude: -23.6461, longitude: -46.7595 },
  { id: '1000850', name: "M'Boi Mirim", zone: 'Zona Sul', latitude: -23.6808, longitude: -46.7628 },
  { id: '592', name: 'Cidade Ademar', zone: 'Zona Sul', latitude: -23.6716, longitude: -46.6708 },
  { id: '1000857', name: 'Capela do Socorro', zone: 'Zona Sul', latitude: -23.7042, longitude: -46.7023 },
  { id: '507', name: 'Barragem Parelheiros', zone: 'Zona Sul', latitude: -23.8278, longitude: -46.7275 },
  { id: '1000300', name: 'Marsilac', zone: 'Zona Sul', latitude: -23.9056, longitude: -46.7056 },
]

export function findCgeStationById(stationId: string): CgeStation | null {
  return CGE_SP_STATIONS.find((station) => station.id === stationId) ?? null
}

export function findNearestCgeStation(
  lat: number,
  lon: number,
  maxDistanceMeters: number = DEFAULT_CGE_STATION_MAX_DISTANCE_METERS,
): CgeStationMatch | null {
  let closest: CgeStationMatch | null = null

  for (const station of CGE_SP_STATIONS) {
    const distanceMeters = getDistanceInMeters(lat, lon, station.latitude, station.longitude)
    if (distanceMeters <= maxDistanceMeters && (!closest || distanceMeters < closest.distanceMeters)) {
      closest = {
        ...station,
        distanceMeters: Math.round(distanceMeters),
      }
    }
  }

  return closest
}
