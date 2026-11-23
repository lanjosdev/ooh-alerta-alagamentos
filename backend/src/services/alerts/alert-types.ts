import type {
  FloodingPoint,
  StationRainfall,
} from '../../providers/flooding-monitor-provider.js'
import type { RegionForecast } from '../../providers/forecast-provider.js'
import type { OfficialWeatherAlert } from '../../providers/official-alerts-provider.js'

export type SeverityLevel = 0 | 1 | 2 | 3
export type SeverityLabel = 'NORMAL' | 'ATENCAO' | 'ALERTA' | 'CRITICO'
export type SimulationMode = 'normal' | 'attention' | 'alert' | 'critical'

export interface RiskEvaluation {
  severityLevel: SeverityLevel
  severityLabel: SeverityLabel
  triggerOverride: boolean
  riskScore: number
  simulated: boolean
  reasons: string[]
}

export interface OohDisplayMessage {
  headline: string
  message: string
  subtext: string
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

export type SourceExecutionState = 'ok' | 'stale' | 'error' | 'skipped'

export interface SourceExecutionStatus {
  provider: string
  status: SourceExecutionState
  cached: boolean
  stale: boolean
  fetchedAt: string | null
  error: string | null
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
  display: OohDisplayMessage
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
