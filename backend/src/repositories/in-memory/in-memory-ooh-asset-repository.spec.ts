import { statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getDistanceInMeters } from '../../utils/location.js'
import { InMemoryOohAssetRepository } from './in-memory-ooh-asset-repository.js'

const EXPECTED_IDS = [
  'av-roberto-marinho',
  'marginal-pinheiros',
  'av-washington-luis-congonhas',
  'av-23-de-maio-jaceguai',
  'marginal-tiete-lapa',
  'av-do-estado',
  'av-radial-leste',
]

const NON_DRIVABLE_HIGHWAYS = new Set([
  'cycleway',
  'footway',
  'platform',
  'path',
  'steps',
  'pedestrian',
])

describe('InMemoryOohAssetRepository', () => {
  it('carrega e valida com Zod todos os 7 ativos OOH curados com geometrias reais OSM', async () => {
    const repo = new InMemoryOohAssetRepository()
    const assets = await repo.listAll()

    expect(assets).toHaveLength(7)
    expect(assets.map((asset) => asset.id)).toEqual(EXPECTED_IDS)

    for (const asset of assets) {
      expect(asset.roads.length).toBeGreaterThan(0)
      const primaryRoads = asset.roads.filter((road) => road.isPrimaryCorridor)
      expect(primaryRoads.length).toBeGreaterThan(0)
      expect(asset.aliases.length).toBeGreaterThan(0)

      for (const road of asset.roads) {
        expect(NON_DRIVABLE_HIGHWAYS.has(road.highway)).toBe(false)
      }

      let minPrimaryVertexDistance = Number.POSITIVE_INFINITY
      for (const road of primaryRoads) {
        for (const [lon, lat] of road.coordinates) {
          const distance = getDistanceInMeters(asset.latitude, asset.longitude, lat, lon)
          if (distance < minPrimaryVertexDistance) {
            minPrimaryVertexDistance = distance
          }
        }
      }
      expect(minPrimaryVertexDistance).toBeLessThanOrEqual(30)

      const [[minLon, minLat], [maxLon, maxLat]] = asset.camera.bounds
      expect(minLon).toBeLessThan(maxLon)
      expect(minLat).toBeLessThan(maxLat)
      expect(minLon).toBeGreaterThan(-47.2)
      expect(maxLon).toBeLessThan(-46.1)
      expect(minLat).toBeGreaterThan(-24.1)
      expect(maxLat).toBeLessThan(-23.2)
    }

    const vinteTres = await repo.findById('av-23-de-maio-jaceguai')
    expect(
      vinteTres?.roads.some(
        (road) =>
          road.isPrimaryCorridor &&
          /vinte e tr[eê]s de maio|23 de maio/i.test(road.streetName),
      ),
    ).toBe(true)

    const marginalLapa = await repo.findById('marginal-tiete-lapa')
    expect(marginalLapa?.zone).toBe('Zona Oeste')
    expect(marginalLapa?.neighborhood).toBe('Lapa / Piqueri')
    expect(marginalLapa?.longitude).toBeLessThan(-46.69)

    const radialLeste = await repo.findById('av-radial-leste')
    expect(radialLeste?.aliases).toContain('AVENIDA ALCANTARA MACHADO')
    expect(radialLeste?.aliases).toContain('AVENIDA CONDE DE FRONTIN')
    expect(await repo.findById('inexistente')).toBeNull()
  })

  it('mantém o módulo curated-ooh-geometries.ts abaixo de 300 KB', () => {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const filePath = path.join(currentDir, 'curated-ooh-geometries.ts')
    const stats = statSync(filePath)
    expect(stats.size).toBeLessThan(300 * 1024)
  })
})
