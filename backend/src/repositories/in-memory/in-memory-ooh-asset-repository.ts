import { z } from 'zod'
import type { OohAsset, OohAssetRepository } from '../ooh-asset-repository.js'
import { CURATED_OOH_GEOMETRIES } from './curated-ooh-geometries.js'

const coordPairSchema = z.tuple([z.number().finite(), z.number().finite()])

const curatedRoadSegmentSchema = z.object({
  osmId: z.string().min(1),
  streetName: z.string().min(1),
  highway: z.string().min(1),
  isPrimaryCorridor: z.boolean(),
  coordinates: z.array(coordPairSchema).min(2),
})

const oohAssetCameraSchema = z.object({
  center: coordPairSchema,
  zoom: z.number().finite().positive(),
  bearing: z.number().finite(),
  bounds: z.tuple([coordPairSchema, coordPairSchema]),
})

const oohAssetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  corridorName: z.string().min(1),
  neighborhood: z.string().min(1),
  zone: z.string().min(1),
  latitude: z.number().finite().min(-25).max(-22),
  longitude: z.number().finite().min(-48).max(-45),
  camera: oohAssetCameraSchema,
  aliases: z.array(z.string().min(1)).min(1),
  roads: z.array(curatedRoadSegmentSchema).min(1),
})

const curatedCatalogSchema = z.array(oohAssetSchema).length(7)

const VALIDATED_CURATED_ASSETS: readonly OohAsset[] = curatedCatalogSchema.parse(
  CURATED_OOH_GEOMETRIES,
)

function cloneAsset(asset: OohAsset): OohAsset {
  return {
    ...asset,
    camera: {
      center: [...asset.camera.center] as [number, number],
      zoom: asset.camera.zoom,
      bearing: asset.camera.bearing,
      bounds: [
        [...asset.camera.bounds[0]] as [number, number],
        [...asset.camera.bounds[1]] as [number, number],
      ],
    },
    aliases: [...asset.aliases],
    roads: asset.roads.map((road) => ({
      ...road,
      coordinates: road.coordinates.map(([lon, lat]) => [lon, lat] as [number, number]),
    })),
  }
}

export class InMemoryOohAssetRepository implements OohAssetRepository {
  private readonly assets: readonly OohAsset[]

  constructor(assets: readonly OohAsset[] = VALIDATED_CURATED_ASSETS) {
    this.assets = assets
  }

  async listAll(): Promise<OohAsset[]> {
    return this.assets.map(cloneAsset)
  }

  async findById(id: string): Promise<OohAsset | null> {
    const found = this.assets.find((asset) => asset.id === id)
    return found ? cloneAsset(found) : null
  }
}
