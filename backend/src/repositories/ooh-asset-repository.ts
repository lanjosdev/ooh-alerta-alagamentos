export interface OohAssetCamera {
  center: [number, number]
  zoom: number
  bearing: number
  bounds: [[number, number], [number, number]]
}

export interface CuratedRoadSegment {
  osmId: string
  streetName: string
  highway: string
  isPrimaryCorridor: boolean
  coordinates: Array<[number, number]>
}

export interface OohAsset {
  id: string
  name: string
  corridorName: string
  neighborhood: string
  zone: string
  latitude: number
  longitude: number
  camera: OohAssetCamera
  aliases: string[]
  roads: CuratedRoadSegment[]
}

export interface OohAssetRepository {
  listAll(): Promise<OohAsset[]>
  findById(id: string): Promise<OohAsset | null>
}
