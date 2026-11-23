export type SeverityLevel = 0 | 1 | 2 | 3
export type SeverityLabel = 'NORMAL' | 'ATENCAO' | 'ALERTA' | 'CRITICO'
export type SimulationMode = 'normal' | 'attention' | 'alert' | 'critical'

export interface ScenarioQueryParams {
  cgeDate?: string
  simulate?: SimulationMode
}

export interface CityOverviewFilters extends ScenarioQueryParams {
  zone?: string
  ibgeCode?: string
}

export type AlertTarget =
  | { kind: 'region'; regionId: string }
  | { kind: 'coordinates'; lat: number; lon: number }

export interface HourlyRainPoint {
  time: string
  precipitationProbabilityPercent: number
  precipitationMm: number
  weatherCode: number
}

export interface RegionForecast {
  provider: string
  gridLatitude: number
  gridLongitude: number
  timezone: string
  maxRainProbabilityNext2hPercent: number
  expectedRainNext2hMm: number
  peakRainIntensityNext2hMmPerHour: number
  maxRainProbabilityNext6hPercent: number
  expectedRainNext6hMm: number
  hourly: HourlyRainPoint[]
}

export interface OfficialWeatherAlert {
  id: string
  code: string
  title: string
  severity: string
  severityRank: 1 | 2 | 3
  colorHex: string
  startsAt: string
  endsAt: string
  risks: string[]
  instructions: string[]
  matchedBy: Array<'ibge' | 'polygon'>
}

export interface FloodingPoint {
  zone: string
  neighborhood: string
  street: string
  direction: string | null
  reference: string | null
  timeWindow: string | null
  status:
    | 'ativo-transitavel'
    | 'ativo-intransitavel'
    | 'inativo-transitavel'
    | 'inativo-intransitavel'
  active: boolean
  passable: boolean
}

export interface StationRainfall {
  stationId: string
  stationName: string | null
  currentPeriodMm: number | null
  previousPeriodMm: number | null
  resetTime: string | null
  temperatureC: number | null
  humidityPercent: number | null
}

export interface SourceExecutionStatus {
  provider: string
  status: 'ok' | 'stale' | 'error' | 'skipped'
  cached: boolean
  stale: boolean
  fetchedAt: string | null
  error: string | null
}

export interface AlertLocationInfo {
  id: string
  name: string
  city: string | null
  state: string | null
  ibgeCode: string | null
  zone: string | null
  latitude: number
  longitude: number
  cgeStationId: string | null
  cgeStationName: string | null
  historicalRiskWeight: number
}

export interface OohAlertDecision {
  evaluatedAt: string
  location: AlertLocationInfo
  triggerOverride: boolean
  severityLevel: SeverityLevel
  severityLabel: SeverityLabel
  riskScore: number
  simulated: boolean
  reasons: string[]
  display: {
    headline: string
    message: string
    subtext: string
  }
  forecast: RegionForecast | null
  officialAlerts: OfficialWeatherAlert[]
  flooding: {
    cgeDate: string | null
    activeInZoneCount: number
    impassableInZoneCount: number
    passableInZoneCount: number
    pointsInZone: FloodingPoint[]
    stationRainfall: StationRainfall | null
  }
  sources: {
    forecast: SourceExecutionStatus
    officialAlerts: SourceExecutionStatus
    floodingMonitor: SourceExecutionStatus
  }
}

export interface CityOverviewData {
  generatedAt: string
  summary: {
    totalRegions: number
    overrideActiveCount: number
    highestSeverityLevel: SeverityLevel
    highestSeverityLabel: SeverityLabel
    countsBySeverity: Record<SeverityLabel, number>
  }
  regions: OohAlertDecision[]
}

export interface SourceHealthSnapshot {
  provider: string
  status: 'ok' | 'degraded' | 'unknown'
  cachedKeys: number
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  lastLatencyMs: number | null
}

export interface SourcesStatusData {
  checkedAt: string
  providers: SourceHealthSnapshot[]
}
