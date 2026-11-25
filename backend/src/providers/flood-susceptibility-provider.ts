export interface FloodSusceptibilityPolygonGeometry {
  type: 'Polygon'
  coordinates: Array<Array<[number, number]>>
}

export interface FloodSusceptibilityMultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Array<Array<Array<[number, number]>>>
}

export interface FloodSusceptibilityPolygon {
  id: string
  layerName: string
  geometry: FloodSusceptibilityPolygonGeometry | FloodSusceptibilityMultiPolygonGeometry
}

export interface FloodSusceptibilityProvider {
  readonly providerName: string
  getFloodZones(
    lat: number,
    lon: number,
    radiusMeters?: number,
  ): Promise<FloodSusceptibilityPolygon[]>
}
