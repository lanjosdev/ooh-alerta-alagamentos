import { getDistanceInMeters } from '../../utils/location.js'
import {
  normalizeRegionText,
  type MonitoringRegion,
  type RegionFilters,
  type RegionRepository,
} from '../region-repository.js'

export const SAO_PAULO_INITIAL_REGIONS: readonly MonitoringRegion[] = [
  {
    id: 'centro-se',
    name: 'Sé / Centro',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Centro',
    latitude: -23.5505,
    longitude: -46.6333,
    cgeStationId: '503',
    historicalRiskWeight: 0.85,
  },
  {
    id: 'zona-oeste-pinheiros',
    name: 'Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Oeste',
    latitude: -23.5614,
    longitude: -46.6915,
    cgeStationId: '1000635',
    historicalRiskWeight: 0.8,
  },
  {
    id: 'zona-oeste-butanta',
    name: 'Butantã',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Oeste',
    latitude: -23.5672,
    longitude: -46.729,
    cgeStationId: '1000842',
    historicalRiskWeight: 0.75,
  },
  {
    id: 'zona-oeste-lapa',
    name: 'Lapa',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Oeste',
    latitude: -23.5228,
    longitude: -46.7019,
    cgeStationId: '1000848',
    historicalRiskWeight: 0.9,
  },
  {
    id: 'zona-leste-itaquera',
    name: 'Itaquera',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Leste',
    latitude: -23.5405,
    longitude: -46.4565,
    cgeStationId: '1000864',
    historicalRiskWeight: 0.85,
  },
  {
    id: 'zona-leste-mooca',
    name: 'Mooca',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Leste',
    latitude: -23.5542,
    longitude: -46.5988,
    cgeStationId: '1000860',
    historicalRiskWeight: 0.85,
  },
  {
    id: 'zona-leste-vila-prudente',
    name: 'Vila Prudente',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Sudeste',
    latitude: -23.5847,
    longitude: -46.582,
    cgeStationId: '524',
    historicalRiskWeight: 0.9,
  },
  {
    id: 'zona-leste-penha',
    name: 'Penha',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Leste',
    latitude: -23.5236,
    longitude: -46.5406,
    cgeStationId: '1000887',
    historicalRiskWeight: 0.8,
  },
  {
    id: 'zona-norte-santana',
    name: 'Santana / Tucuruvi',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Norte',
    latitude: -23.4958,
    longitude: -46.6251,
    cgeStationId: '510',
    historicalRiskWeight: 0.85,
  },
  {
    id: 'zona-sul-santo-amaro',
    name: 'Santo Amaro',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Sul',
    latitude: -23.6528,
    longitude: -46.7098,
    cgeStationId: '1000852',
    historicalRiskWeight: 0.85,
  },
  {
    id: 'zona-sul-ipiranga',
    name: 'Ipiranga',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Sudeste',
    latitude: -23.5919,
    longitude: -46.6061,
    cgeStationId: '1000840',
    historicalRiskWeight: 0.9,
  },
  {
    id: 'zona-sul-vila-mariana',
    name: 'Vila Mariana',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Sul',
    latitude: -23.5895,
    longitude: -46.6347,
    cgeStationId: '495',
    historicalRiskWeight: 0.7,
  },
]

export class InMemoryRegionRepository implements RegionRepository {
  constructor(private readonly regions: readonly MonitoringRegion[] = SAO_PAULO_INITIAL_REGIONS) {}

  async listAll(filters?: RegionFilters): Promise<MonitoringRegion[]> {
    const normalizedZone = filters?.zone ? normalizeRegionText(filters.zone) : null
    const ibgeFilter = filters?.ibgeCode?.trim() || null

    return this.regions
      .filter((region) => {
        if (normalizedZone && normalizeRegionText(region.zone) !== normalizedZone) {
          return false
        }
        if (ibgeFilter && region.ibgeCode !== ibgeFilter) {
          return false
        }
        return true
      })
      .map((region) => ({ ...region }))
  }

  async findById(id: string): Promise<MonitoringRegion | null> {
    const found = this.regions.find((region) => region.id === id)
    return found ? { ...found } : null
  }

  async findNearest(
    lat: number,
    lon: number,
    maxDistanceMeters: number,
  ): Promise<MonitoringRegion | null> {
    let closestRegion: MonitoringRegion | null = null
    let closestDistance = Number.POSITIVE_INFINITY

    for (const region of this.regions) {
      const distance = getDistanceInMeters(lat, lon, region.latitude, region.longitude)
      if (distance <= maxDistanceMeters && distance < closestDistance) {
        closestDistance = distance
        closestRegion = region
      }
    }

    return closestRegion ? { ...closestRegion } : null
  }
}
