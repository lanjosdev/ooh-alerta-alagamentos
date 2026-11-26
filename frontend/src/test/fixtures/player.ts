import {
  mockCampinasDecision,
  mockRegionButanta,
  mockRegionItaquera,
} from '@/test/fixtures/alerts'
import type { HealthData } from '@/types/alerts'
import type {
  PlayerAssetsData,
  PlayerGeocodeData,
  PlayerSceneData,
} from '@/types/player'

export const mockHealthDataEnabled: HealthData = {
  status: 'ok',
  uptime: 120.5,
  timestamp: '2026-11-25T18:00:00.000Z',
  capabilities: {
    simulation: true,
  },
}

export const mockHealthDataDisabled: HealthData = {
  status: 'ok',
  uptime: 120.5,
  timestamp: '2026-11-25T18:00:00.000Z',
  capabilities: {
    simulation: false,
  },
}

export const mockPlayerAssetsData: PlayerAssetsData = {
  total: 3,
  assets: [
    {
      id: 'av-roberto-marinho',
      name: 'Relógio Av. Roberto Marinho × Roque Petroni',
      corridorName: 'Av. Jornalista Roberto Marinho',
      neighborhood: 'Brooklin',
      zone: 'Zona Sul',
      latitude: -23.6217,
      longitude: -46.6869,
      camera: {
        center: [-46.6869, -23.6217],
        zoom: 15.2,
        bearing: 12,
        bounds: [
          [-46.6942, -23.6284],
          [-46.6795, -23.6149],
        ],
      },
      severityLevel: 3,
      severityLabel: 'CRITICO',
      riskScore: 95,
      triggerOverride: true,
      activeInZoneCount: 2,
    },
    {
      id: 'marginal-pinheiros',
      name: 'Painel Marginal Pinheiros × Cidade Jardim',
      corridorName: 'Marginal Pinheiros',
      neighborhood: 'Cidade Jardim',
      zone: 'Zona Oeste',
      latitude: -23.5912,
      longitude: -46.6934,
      camera: {
        center: [-46.6934, -23.5912],
        zoom: 14.8,
        bearing: -15,
        bounds: [
          [-46.701, -23.598],
          [-46.685, -23.584],
        ],
      },
      severityLevel: 2,
      severityLabel: 'ALERTA',
      riskScore: 76,
      triggerOverride: true,
      activeInZoneCount: 1,
    },
    {
      id: 'av-radial-leste',
      name: 'Painel Radial Leste × Metrô Bresser',
      corridorName: 'Av. Alcântara Machado (Radial Leste)',
      neighborhood: 'Mooca',
      zone: 'Zona Leste',
      latitude: -23.5465,
      longitude: -46.6075,
      camera: {
        center: [-46.6075, -23.5465],
        zoom: 15,
        bearing: 0,
        bounds: [
          [-46.615, -23.553],
          [-46.6, -23.54],
        ],
      },
      severityLevel: 0,
      severityLabel: 'NORMAL',
      riskScore: 12,
      triggerOverride: false,
      activeInZoneCount: 0,
    },
  ],
}

export const mockPlayerSceneCritical: PlayerSceneData = {
  evaluatedAt: '2026-11-25T18:00:00.000Z',
  assetId: 'av-roberto-marinho',
  targetKind: 'asset',
  decision: mockRegionButanta,
  editorial: {
    headline: 'ALAGAMENTO INTRANSITÁVEL NA VIA',
    corridorName: 'Av. Jornalista Roberto Marinho',
    riskWindowLabel: 'Via com bloqueio por alagamento',
    statusNote: '1 ocorrência(s) ativa(s) na região. Evite trechos baixos e busque rotas alternativas.',
    sourcesLabel: 'Dados CGE-SP / INMET / Open-Meteo / GeoSampa',
    telemetryModeLabel: 'TEMPO REAL',
    telemetryStatusPill: 'ATUALIZADO AGORA',
  },
  camera: {
    center: [-46.6869, -23.6217],
    zoom: 15.2,
    bearing: 12,
    bounds: [
      [-46.6942, -23.6284],
      [-46.6795, -23.6149],
    ],
  },
  roads: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-46.692, -23.621],
            [-46.6869, -23.6217],
            [-46.681, -23.6225],
          ],
        },
        properties: {
          osmId: '1001',
          streetName: 'Avenida Jornalista Roberto Marinho',
          highway: 'primary',
          isPrimaryCorridor: true,
          matchedCge: true,
          matchedCgeImpassable: true,
          inGeoSampaZone: true,
          riskIntensity: 1,
        },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-46.688, -23.619],
            [-46.685, -23.624],
          ],
        },
        properties: {
          osmId: '1002',
          streetName: 'Rua Arizona',
          highway: 'secondary',
          isPrimaryCorridor: false,
          matchedCge: false,
          matchedCgeImpassable: false,
          inGeoSampaZone: false,
          riskIntensity: 0,
        },
      },
    ],
  },
  geoSampaZonesCount: 2,
  sources: {
    forecast: mockRegionButanta.sources.forecast,
    officialAlerts: mockRegionButanta.sources.officialAlerts,
    floodingMonitor: mockRegionButanta.sources.floodingMonitor,
    roadGeometry: {
      provider: 'osm-curated-snapshot',
      status: 'ok',
      cached: true,
      stale: false,
      fetchedAt: null,
      error: null,
    },
    floodSusceptibility: {
      provider: 'geosampa-wfs',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-25T18:00:00.000Z',
      error: null,
    },
  },
}

export const mockPlayerSceneNormal: PlayerSceneData = {
  evaluatedAt: '2026-11-25T18:00:00.000Z',
  assetId: 'av-radial-leste',
  targetKind: 'asset',
  decision: mockRegionItaquera,
  editorial: {
    headline: 'TRÂNSITO LIVRE • SEM ALAGAMENTOS',
    corridorName: 'Av. Alcântara Machado (Radial Leste)',
    riskWindowLabel: 'Sem risco no momento',
    statusNote: 'Via sem risco no momento • Monitoramento ativo',
    sourcesLabel: 'Dados CGE-SP / INMET / Open-Meteo',
    telemetryModeLabel: 'TEMPO REAL',
    telemetryStatusPill: 'ATUALIZADO AGORA',
  },
  camera: {
    center: [-46.6075, -23.5465],
    zoom: 15,
    bearing: 0,
    bounds: [
      [-46.615, -23.553],
      [-46.6, -23.54],
    ],
  },
  roads: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-46.612, -23.546],
            [-46.603, -23.547],
          ],
        },
        properties: {
          osmId: '2001',
          streetName: 'Avenida Alcântara Machado',
          highway: 'trunk',
          isPrimaryCorridor: true,
          matchedCge: false,
          matchedCgeImpassable: false,
          inGeoSampaZone: false,
          riskIntensity: 0,
        },
      },
    ],
  },
  geoSampaZonesCount: 0,
  sources: {
    forecast: mockRegionItaquera.sources.forecast,
    officialAlerts: mockRegionItaquera.sources.officialAlerts,
    floodingMonitor: mockRegionItaquera.sources.floodingMonitor,
    roadGeometry: {
      provider: 'osm-curated-snapshot',
      status: 'ok',
      cached: true,
      stale: false,
      fetchedAt: null,
      error: null,
    },
    floodSusceptibility: {
      provider: 'geosampa-wfs',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-25T18:00:00.000Z',
      error: null,
    },
  },
}

export const mockPlayerSceneHistorical: PlayerSceneData = {
  evaluatedAt: '2025-01-24T20:30:00-03:00',
  assetId: 'marginal-pinheiros',
  targetKind: 'asset',
  decision: {
    ...mockRegionButanta,
    evaluatedAt: '2025-01-24T20:30:00-03:00',
    temporal: {
      mode: 'historical',
      date: '2025-01-24',
      time: '20:30',
      resolvedTime: '20:30',
      referenceAt: '2025-01-24T20:30:00-03:00',
    },
    officialAlerts: [],
    flooding: {
      ...mockRegionButanta.flooding,
      cgeDate: '24/01/2025',
      stationRainfall: null,
    },
    sources: {
      forecast: {
        provider: 'open-meteo-historical',
        status: 'ok',
        cached: false,
        stale: false,
        fetchedAt: '2026-11-25T18:00:00.000Z',
        error: null,
      },
      officialAlerts: {
        provider: 'inmet',
        status: 'skipped',
        cached: false,
        stale: false,
        fetchedAt: null,
        error: null,
      },
      floodingMonitor: {
        provider: 'cge-sp',
        status: 'ok',
        cached: true,
        stale: false,
        fetchedAt: '2026-11-25T18:00:00.000Z',
        error: null,
      },
    },
  },
  editorial: {
    headline: 'ALAGAMENTO INTRANSITÁVEL NA VIA',
    corridorName: 'Marginal Pinheiros',
    riskWindowLabel: 'Via com bloqueio por alagamento',
    statusNote: '2 ocorrência(s) ativa(s) na região. Evite trechos baixos e busque rotas alternativas.',
    sourcesLabel: 'Dados CGE-SP / Open-Meteo Histórico / GeoSampa',
    telemetryModeLabel: 'REPLAY • 24/01/2025 20:30',
    telemetryStatusPill: 'REPLAY HISTÓRICO',
  },
  camera: {
    center: [-46.6934, -23.5912],
    zoom: 14.8,
    bearing: -15,
    bounds: [
      [-46.701, -23.598],
      [-46.685, -23.584],
    ],
  },
  roads: mockPlayerSceneCritical.roads,
  geoSampaZonesCount: 3,
  sources: {
    forecast: {
      provider: 'open-meteo-historical',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-25T18:00:00.000Z',
      error: null,
    },
    officialAlerts: {
      provider: 'inmet',
      status: 'skipped',
      cached: false,
      stale: false,
      fetchedAt: null,
      error: null,
    },
    floodingMonitor: {
      provider: 'cge-sp',
      status: 'ok',
      cached: true,
      stale: false,
      fetchedAt: '2026-11-25T18:00:00.000Z',
      error: null,
    },
    roadGeometry: {
      provider: 'osm-curated-snapshot',
      status: 'ok',
      cached: true,
      stale: false,
      fetchedAt: null,
      error: null,
    },
    floodSusceptibility: {
      provider: 'geosampa-wfs',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-25T18:00:00.000Z',
      error: null,
    },
  },
}

export const mockPlayerSceneCoordinates: PlayerSceneData = {
  ...mockPlayerSceneCritical,
  assetId: null,
  targetKind: 'coordinates',
  decision: mockCampinasDecision,
  editorial: {
    headline: 'ATENÇÃO PARA CHUVA FORTE',
    corridorName: 'Avenida Paulista',
    riskWindowLabel: 'Risco moderado nas próximas 2h',
    statusNote: 'Probabilidade de 65% de chuva nas próximas 2h. Monitoramento contínuo do corredor.',
    sourcesLabel: 'Dados INMET / Open-Meteo',
    telemetryModeLabel: 'TEMPO REAL',
    telemetryStatusPill: 'ATUALIZADO AGORA',
  },
  sources: {
    forecast: mockCampinasDecision.sources.forecast,
    officialAlerts: mockCampinasDecision.sources.officialAlerts,
    floodingMonitor: mockCampinasDecision.sources.floodingMonitor,
    roadGeometry: {
      provider: 'overpass',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-25T18:00:00.000Z',
      error: null,
    },
    floodSusceptibility: {
      provider: 'geosampa-wfs',
      status: 'skipped',
      cached: false,
      stale: false,
      fetchedAt: null,
      error: null,
    },
  },
}

export const mockGeocodeResponse: PlayerGeocodeData = {
  query: 'Avenida Paulista',
  total: 2,
  candidates: [
    {
      id: 'way:12345',
      displayName: 'Avenida Paulista, Bela Vista, São Paulo, SP, Brasil',
      primaryName: 'Avenida Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'São Paulo',
      latitude: -23.5614,
      longitude: -46.6559,
    },
    {
      id: 'node:67890',
      displayName: 'Avenida Paulista 1000, Cerqueira César, São Paulo, SP, Brasil',
      primaryName: 'Avenida Paulista 1000',
      neighborhood: 'Cerqueira César',
      city: 'São Paulo',
      state: 'São Paulo',
      latitude: -23.5648,
      longitude: -46.652,
    },
  ],
}
