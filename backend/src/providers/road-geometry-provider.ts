export interface RoadSegment {
  osmId: string
  streetName: string
  highway: string
  coordinates: Array<[number, number]>
}

export interface RoadGeometryProvider {
  readonly providerName: string
  getNearbyRoads(lat: number, lon: number, radiusMeters?: number): Promise<RoadSegment[]>
}
