import { describe, expect, it } from 'vitest'
import type { FloodingPoint } from '../../providers/flooding-monitor-provider.js'
import type { FloodSusceptibilityPolygon } from '../../providers/flood-susceptibility-provider.js'
import {
  calculateRiskIntensity,
  matchRoadRisk,
  normalizeStreetName,
} from './match-road-risk.js'

function makeCgePoint(street: string, passable: boolean, active: boolean = true): FloodingPoint {
  return {
    zone: 'Zona Oeste',
    neighborhood: 'Pinheiros',
    street,
    direction: 'AMBOS',
    reference: null,
    timeWindow: 'Desde 16:00',
    status: active
      ? passable
        ? 'ativo-transitavel'
        : 'ativo-intransitavel'
      : passable
        ? 'inativo-transitavel'
        : 'inativo-intransitavel',
    active,
    passable,
  }
}

describe('match-road-risk', () => {
  it('normaliza nomes reais do CGE-SP removendo títulos, sufixos de pista e expandindo prefixos', () => {
    expect(normalizeStreetName('MARGINAL TIETE ASCB CENTRAL')).toBe('MARGINAL TIETE')
    expect(normalizeStreetName('PTE DAS BANDEIRAS SEN ROMEU TUMA')).toBe(
      'PONTE DAS BANDEIRAS ROMEU TUMA',
    )
    expect(normalizeStreetName('AV MARQ DE SAO VICENTE')).toBe('AVENIDA MARQUES DE SAO VICENTE')
    expect(normalizeStreetName('AV ALCANTARA MACHADO')).toBe('AVENIDA ALCANTARA MACHADO')
    expect(normalizeStreetName('Av. Jornalista Roberto Marinho')).toBe('AVENIDA ROBERTO MARINHO')
  })

  it('aplica buffer de 20m para intersectar polígonos pequenos (~86 m²) do GeoSampa', () => {
    // Polígono ~10m x 9m deslocado ~12m ao norte da via (dentro do buffer de 20m)
    const smallGeoSampaZone: FloodSusceptibilityPolygon = {
      id: 'mancha_86m2',
      layerName: 'geoportal:mancha_inundacao_25',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-46.68705, -23.62159],
            [-46.68695, -23.62159],
            [-46.68695, -23.62151],
            [-46.68705, -23.62151],
            [-46.68705, -23.62159],
          ],
        ],
      },
    }

    const result = matchRoadRisk({
      roads: [
        {
          osmId: '1',
          streetName: 'Avenida Jornalista Roberto Marinho',
          highway: 'primary',
          isPrimaryCorridor: true,
          coordinates: [
            [-46.6875, -23.6217],
            [-46.6865, -23.6217],
          ],
        },
        {
          osmId: '2',
          streetName: 'Rua Paralela Distante',
          highway: 'secondary',
          isPrimaryCorridor: false,
          coordinates: [
            [-46.6875, -23.623],
            [-46.6865, -23.623],
          ],
        },
      ],
      floodingPoints: [],
      geoSampaZones: [smallGeoSampaZone],
      severityLevel: 2,
    })

    expect(result.features[0].properties.inGeoSampaZone).toBe(true)
    expect(result.features[0].properties.riskIntensity).toBe(0.7) // 0.55 + 0.15
    expect(result.features[1].properties.inGeoSampaZone).toBe(false)
    expect(result.features[1].properties.riskIntensity).toBe(0)
  })

  it('executa matching de strings reais do CGE-SP com vias OSM e aliases de corredor', () => {
    const result = matchRoadRisk({
      roads: [
        {
          osmId: '10',
          streetName: 'Ponte das Bandeiras',
          highway: 'primary',
          isPrimaryCorridor: true,
          coordinates: [
            [-46.629, -23.516],
            [-46.628, -23.517],
          ],
        },
        {
          osmId: '11',
          streetName: 'Avenida Marquês de São Vicente',
          highway: 'secondary',
          isPrimaryCorridor: false,
          coordinates: [
            [-46.67, -23.52],
            [-46.668, -23.521],
          ],
        },
        {
          osmId: '12',
          streetName: 'Avenida Conde de Frontin',
          highway: 'trunk',
          isPrimaryCorridor: true,
          coordinates: [
            [-46.576, -23.541],
            [-46.574, -23.541],
          ],
        },
        {
          osmId: '13',
          streetName: 'Avenida Assis Chateaubriand',
          highway: 'trunk',
          isPrimaryCorridor: true,
          coordinates: [
            [-46.63, -23.515],
            [-46.627, -23.515],
          ],
        },
      ],
      floodingPoints: [
        makeCgePoint('PTE DAS BANDEIRAS SEN ROMEU TUMA', false, true),
        makeCgePoint('AV MARQ DE SAO VICENTE', true, true),
        makeCgePoint('AV ALCANTARA MACHADO', false, true),
        makeCgePoint('MARGINAL TIETE ASCB CENTRAL', true, true),
      ],
      geoSampaZones: [],
      severityLevel: 3,
      corridorAliases: ['AVENIDA ALCANTARA MACHADO', 'MARGINAL TIETE'],
    })

    expect(result.features.map((f) => f.properties)).toEqual([
      expect.objectContaining({
        osmId: '10',
        matchedCge: true,
        matchedCgeImpassable: true,
        riskIntensity: 1,
      }),
      expect.objectContaining({
        osmId: '11',
        matchedCge: true,
        matchedCgeImpassable: false,
        riskIntensity: 1,
      }),
      expect.objectContaining({
        osmId: '12',
        matchedCge: true,
        matchedCgeImpassable: true,
        riskIntensity: 1,
      }),
      expect.objectContaining({
        osmId: '13',
        matchedCge: true,
        matchedCgeImpassable: true,
        riskIntensity: 1,
      }),
    ])
  })

  it('respeita fórmula de riskIntensity em todos os níveis 0..3', () => {
    expect(
      calculateRiskIntensity({
        severityLevel: 0,
        isPrimaryCorridor: true,
        matchedCge: true,
        matchedCgeImpassable: true,
        inGeoSampaZone: true,
      }),
    ).toBe(0)

    expect(
      calculateRiskIntensity({
        severityLevel: 1,
        isPrimaryCorridor: true,
        matchedCge: false,
        matchedCgeImpassable: false,
        inGeoSampaZone: false,
      }),
    ).toBe(0.3)

    expect(
      calculateRiskIntensity({
        severityLevel: 2,
        isPrimaryCorridor: false,
        matchedCge: false,
        matchedCgeImpassable: false,
        inGeoSampaZone: true,
      }),
    ).toBe(0.7)

    expect(
      calculateRiskIntensity({
        severityLevel: 2,
        isPrimaryCorridor: false,
        matchedCge: false,
        matchedCgeImpassable: false,
        inGeoSampaZone: false,
      }),
    ).toBe(0)

    expect(
      calculateRiskIntensity({
        severityLevel: 3,
        isPrimaryCorridor: true,
        matchedCge: true,
        matchedCgeImpassable: true,
        inGeoSampaZone: true,
      }),
    ).toBe(1)
  })
})
