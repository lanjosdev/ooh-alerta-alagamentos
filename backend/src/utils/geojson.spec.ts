import { describe, expect, it } from 'vitest'
import { isPointInGeoJson, parseGeoJsonGeometry } from './geojson.js'

describe('geojson utils', () => {
  const saoPauloPolygonRaw = JSON.stringify({
    type: 'Polygon',
    coordinates: [
      [
        [-46.85, -23.4],
        [-46.35, -23.4],
        [-46.35, -23.75],
        [-46.85, -23.75],
        [-46.85, -23.4],
      ],
    ],
  })

  it('faz parse de Polygon e identifica coordenadas de São Paulo corretamente em [lon, lat]', () => {
    const geometry = parseGeoJsonGeometry(saoPauloPolygonRaw)
    expect(geometry).not.toBeNull()

    if (!geometry) {
      return
    }

    // Praça da Sé (-23.5505, -46.6333) dentro do polígono
    expect(isPointInGeoJson(-23.5505, -46.6333, geometry)).toBe(true)
    // Campinas (-22.9099, -47.0626) fora do polígono
    expect(isPointInGeoJson(-22.9099, -47.0626, geometry)).toBe(false)
    // Ponto exatamente sobre a borda norte (-23.4, -46.6)
    expect(isPointInGeoJson(-23.4, -46.6, geometry)).toBe(true)
  })

  it('respeita furos internos (holes) em Polygon', () => {
    const polygonWithHole = parseGeoJsonGeometry(
      JSON.stringify({
        type: 'Polygon',
        coordinates: [
          [
            [-47.0, -23.0],
            [-46.0, -23.0],
            [-46.0, -24.0],
            [-47.0, -24.0],
            [-47.0, -23.0],
          ],
          [
            [-46.7, -23.4],
            [-46.5, -23.4],
            [-46.5, -23.6],
            [-46.7, -23.6],
            [-46.7, -23.4],
          ],
        ],
      }),
    )

    expect(polygonWithHole).not.toBeNull()
    if (!polygonWithHole) {
      return
    }

    // Dentro do furo interno
    expect(isPointInGeoJson(-23.5, -46.6, polygonWithHole)).toBe(false)
    // No anel externo fora do furo
    expect(isPointInGeoJson(-23.2, -46.2, polygonWithHole)).toBe(true)
  })

  it('suporta MultiPolygon e Feature encapsulado', () => {
    const multiPolygonFeature = parseGeoJsonGeometry(
      JSON.stringify({
        type: 'Feature',
        properties: { name: 'SP + Litoral' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [
              [
                [-46.8, -23.45],
                [-46.5, -23.45],
                [-46.5, -23.7],
                [-46.8, -23.7],
                [-46.8, -23.45],
              ],
            ],
            [
              [
                [-46.4, -23.9],
                [-46.25, -23.9],
                [-46.25, -24.05],
                [-46.4, -24.05],
                [-46.4, -23.9],
              ],
            ],
          ],
        },
      }),
    )

    expect(multiPolygonFeature?.type).toBe('MultiPolygon')
    if (!multiPolygonFeature) {
      return
    }

    expect(isPointInGeoJson(-23.56, -46.69, multiPolygonFeature)).toBe(true)
    expect(isPointInGeoJson(-23.96, -46.33, multiPolygonFeature)).toBe(true)
    expect(isPointInGeoJson(-23.8, -46.6, multiPolygonFeature)).toBe(false)
  })

  it('retorna null para entradas vazias, JSON inválido ou geometria não suportada', () => {
    expect(parseGeoJsonGeometry(null)).toBeNull()
    expect(parseGeoJsonGeometry(undefined)).toBeNull()
    expect(parseGeoJsonGeometry('')).toBeNull()
    expect(parseGeoJsonGeometry('{invalid-json')).toBeNull()
    expect(parseGeoJsonGeometry(JSON.stringify({ type: 'Point', coordinates: [-46.6, -23.5] }))).toBeNull()
    expect(
      parseGeoJsonGeometry(JSON.stringify({ type: 'Polygon', coordinates: [[['x', 'y']]] })),
    ).toBeNull()
  })
})
