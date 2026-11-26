import type {
  OohAlertDecision,
  SeverityLabel,
  SeverityLevel,
  SourceExecutionStatus,
} from '../alerts/alert-types.js'

export interface PlayerCamera {
  center: [number, number]
  zoom: number
  bearing: number
  bounds: [[number, number], [number, number]]
}

export interface PlayerAssetSummary {
  id: string
  name: string
  corridorName: string
  neighborhood: string
  zone: string
  latitude: number
  longitude: number
  camera: PlayerCamera
  severityLevel: SeverityLevel
  severityLabel: SeverityLabel
  riskScore: number
  triggerOverride: boolean
  activeInZoneCount: number
}

export interface RoadFloodFeatureProperties {
  osmId: string
  streetName: string
  highway: string
  isPrimaryCorridor: boolean
  matchedCge: boolean
  matchedCgeImpassable: boolean
  inGeoSampaZone: boolean
  riskIntensity: number
}

export interface RoadFloodFeature {
  type: 'Feature'
  geometry: {
    type: 'LineString'
    coordinates: Array<[number, number]>
  }
  properties: RoadFloodFeatureProperties
}

export interface RoadFloodFeatureCollection {
  type: 'FeatureCollection'
  features: RoadFloodFeature[]
}

export interface PlayerEditorialContent {
  headline: string
  corridorName: string
  riskWindowLabel: string
  statusNote: string
  sourcesLabel: string
  telemetryModeLabel: string
  telemetryStatusPill: string
}

export interface PlayerSceneData {
  evaluatedAt: string
  assetId: string | null
  targetKind: 'asset' | 'coordinates'
  decision: OohAlertDecision
  editorial: PlayerEditorialContent
  camera: PlayerCamera
  roads: RoadFloodFeatureCollection
  geoSampaZonesCount: number
  sources: {
    forecast: SourceExecutionStatus
    officialAlerts: SourceExecutionStatus
    floodingMonitor: SourceExecutionStatus
    roadGeometry: SourceExecutionStatus
    floodSusceptibility: SourceExecutionStatus
  }
}
