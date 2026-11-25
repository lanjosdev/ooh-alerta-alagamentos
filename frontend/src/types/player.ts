import type {
  OohAlertDecision,
  SeverityLabel,
  SeverityLevel,
  SourceExecutionStatus,
} from '@/types/alerts'

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

export interface PlayerAssetsData {
  total: number
  assets: PlayerAssetSummary[]
}

export interface GeocodingCandidate {
  id: string
  displayName: string
  primaryName: string
  neighborhood: string | null
  city: string | null
  state: string | null
  latitude: number
  longitude: number
}

export interface PlayerGeocodeData {
  query: string
  total: number
  candidates: GeocodingCandidate[]
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

export type PlayerFormat = 'portrait' | 'landscape'

export type PlayerTarget =
  | { kind: 'asset'; assetId: string }
  | { kind: 'coordinates'; lat: number; lon: number; label?: string }

export interface PlayerBrandConfig {
  brand: string
  tag: string
  accent: string
}
