export interface MonitoringRegion {
  id: string
  name: string
  city: string
  state: string
  ibgeCode: string
  zone: string
  latitude: number
  longitude: number
  cgeStationId: string | null
  historicalRiskWeight: number
}

export interface RegionFilters {
  zone?: string
  ibgeCode?: string
}

export interface RegionRepository {
  listAll(filters?: RegionFilters): Promise<MonitoringRegion[]>
  findById(id: string): Promise<MonitoringRegion | null>
  findNearest(lat: number, lon: number, maxDistanceMeters: number): Promise<MonitoringRegion | null>
}

/** Normaliza nomes de zonas/regiões removendo acentos e espaços extras para comparação determinística. */
export function normalizeRegionText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
}
