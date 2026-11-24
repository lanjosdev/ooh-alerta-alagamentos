export type FloodingPointStatus =
  | 'ativo-transitavel'
  | 'ativo-intransitavel'
  | 'inativo-transitavel'
  | 'inativo-intransitavel'

export interface FloodingPoint {
  zone: string
  neighborhood: string
  street: string
  direction: string | null
  reference: string | null
  timeWindow: string | null
  status: FloodingPointStatus
  active: boolean
  passable: boolean
}

export interface StationRainfall {
  stationId: string
  stationName: string | null
  currentPeriodMm: number | null
  previousPeriodMm: number | null
  recentDeltaMm: number | null
  resetTime: string | null
  temperatureC: number | null
  humidityPercent: number | null
}

export interface FloodingMonitorProvider {
  readonly providerName: string
  getFloodingPoints(options?: { cgeDate?: string }): Promise<FloodingPoint[]>
  getStationRainfall(stationId: string): Promise<StationRainfall | null>
}
