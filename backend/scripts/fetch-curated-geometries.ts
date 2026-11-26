import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../src/env.js'

interface CuratedAssetSeed {
  id: string
  name: string
  corridorName: string
  neighborhood: string
  zone: string
  latitude: number
  longitude: number
  camera: {
    center: [number, number]
    zoom: number
    bearing: number
  }
  aliases: string[]
  overpassNameRegex: string
  primaryStreetRegex: RegExp
}

interface OverpassResponse {
  elements: Array<{
    type: string
    id: number
    tags?: {
      name?: string
      highway?: string
    }
    geometry?: Array<{ lat: number; lon: number }>
  }>
}

interface CuratedRoadSnapshot {
  osmId: string
  streetName: string
  highway: string
  isPrimaryCorridor: boolean
  coordinates: Array<[number, number]>
}

interface CuratedAssetEntry {
  id: string
  name: string
  corridorName: string
  neighborhood: string
  zone: string
  latitude: number
  longitude: number
  camera: {
    center: [number, number]
    zoom: number
    bearing: number
    bounds: [[number, number], [number, number]]
  }
  aliases: string[]
  roads: CuratedRoadSnapshot[]
}

const CURATED_ASSET_SEEDS: CuratedAssetSeed[] = [
  {
    id: 'av-roberto-marinho',
    name: 'Av. Jornalista Roberto Marinho',
    corridorName: 'Av. Jornalista Roberto Marinho',
    neighborhood: 'Brooklin / Campo Belo',
    zone: 'Zona Sul',
    latitude: -23.61808,
    longitude: -46.683831,
    camera: { center: [-46.683831, -23.61808], zoom: 15.2, bearing: 12 },
    aliases: [
      'AVENIDA JORNALISTA ROBERTO MARINHO',
      'AVENIDA ROBERTO MARINHO',
      'AVENIDA AGUAS ESPRAIADAS',
    ],
    overpassNameRegex: 'Roberto Marinho|Chucri Zaidan|Bandeirantes|Santo Amaro',
    primaryStreetRegex: /roberto marinho|aguas espraiadas/i,
  },
  {
    id: 'marginal-pinheiros',
    name: 'Marginal Pinheiros',
    corridorName: 'Marginal Pinheiros',
    neighborhood: 'Pinheiros / Cidade Jardim',
    zone: 'Zona Oeste',
    latitude: -23.589168,
    longitude: -46.692788,
    camera: { center: [-46.692788, -23.589168], zoom: 15.0, bearing: -14 },
    aliases: [
      'MARGINAL PINHEIROS',
      'AVENIDA DAS NACOES UNIDAS',
      'AVENIDA MAGALHAES DE CASTRO',
    ],
    overpassNameRegex: 'Nações Unidas|Magalhães de Castro|Marginal Pinheiros|Cidade Jardim|Faria Lima',
    primaryStreetRegex: /na[cç][oõ]es unidas|magalh[aã]es de castro|marginal pinheiros/i,
  },
  {
    id: 'av-washington-luis-congonhas',
    name: 'Av. Washington Luís — Aeroporto de Congonhas',
    corridorName: 'Av. Washington Luís',
    neighborhood: 'Campo Belo',
    zone: 'Zona Sul',
    latitude: -23.625784,
    longitude: -46.661881,
    camera: { center: [-46.661881, -23.625784], zoom: 15.2, bearing: 8 },
    aliases: [
      'AVENIDA WASHINGTON LUIS',
      'AEROPORTO DE CONGONHAS',
      'PRACA COMANDANTE LINEU GOMES',
    ],
    overpassNameRegex: 'Washington Luís|Lineu Gomes|Bandeirantes|Pedro Bueno|Rubem Berta',
    primaryStreetRegex: /washington lu[ií]s|lineu gomes/i,
  },
  {
    id: 'av-23-de-maio-jaceguai',
    name: 'Av. 23 de Maio / Viaduto Jaceguaí',
    corridorName: 'Av. 23 de Maio / Viaduto Jaceguaí',
    neighborhood: 'Centro / Bela Vista',
    zone: 'Centro',
    latitude: -23.556415,
    longitude: -46.637818,
    camera: { center: [-46.637818, -23.556415], zoom: 15.3, bearing: 0 },
    aliases: [
      'AVENIDA 23 DE MAIO',
      'AVENIDA VINTE E TRES DE MAIO',
      'VIADUTO JACEGUAI',
    ],
    overpassNameRegex: '23 de Maio|Vinte e Três de Maio|Vinte e Tres de Maio|Jaceguaí|Jaceguai|Nove de Julho|Radial Leste|Liberdade',
    primaryStreetRegex: /23 de maio|vinte e tr[eê]s de maio|jacegua[ií]/i,
  },
  {
    id: 'marginal-tiete-lapa',
    name: 'Marginal Tietê — Lapa / Ponte do Piqueri',
    corridorName: 'Marginal Tietê (Lapa)',
    neighborhood: 'Lapa / Piqueri',
    zone: 'Zona Oeste',
    latitude: -23.509412,
    longitude: -46.703901,
    camera: { center: [-46.703901, -23.509412], zoom: 15.0, bearing: -8 },
    aliases: [
      'MARGINAL TIETE',
      'PONTE DO PIQUERI',
      'PONTE DA LAPA',
      'AVENIDA EMBAIXADOR MACEDO SOARES',
      'AVENIDA OTAVIANO ALVES DE LIMA',
      'AVENIDA PRESIDENTE CASTELO BRANCO',
      'AVENIDA ERMANO MARCHETTI',
    ],
    overpassNameRegex: 'Marginal Tietê|Margina Tietê|Embaixador Macedo Soares|Otaviano Alves|Castelo Branco|Ponte do Piqueri|Ermano Marchetti',
    primaryStreetRegex: /marginal? tiet[eê]|embaixador macedo soares|otaviano alves|castelo branco/i,
  },
  {
    id: 'av-do-estado',
    name: 'Av. do Estado',
    corridorName: 'Av. do Estado',
    neighborhood: 'Ipiranga / Vila Prudente',
    zone: 'Zona Sudeste',
    latitude: -23.5686,
    longitude: -46.607784,
    camera: { center: [-46.607784, -23.5686], zoom: 15.1, bearing: -12 },
    aliases: ['AVENIDA DO ESTADO', 'VIADUTO GRANDE SAO PAULO'],
    overpassNameRegex: 'do Estado|Dom Pedro|Paes de Barros|Almirante Delamare|Junta Patriótica',
    primaryStreetRegex: /do estado|grande s[aã]o paulo/i,
  },
  {
    id: 'av-radial-leste',
    name: 'Av. Radial Leste',
    corridorName: 'Av. Radial Leste',
    neighborhood: 'Mooca / Tatuapé',
    zone: 'Zona Leste',
    latitude: -23.542179,
    longitude: -46.582008,
    camera: { center: [-46.582008, -23.542179], zoom: 15.1, bearing: 4 },
    aliases: [
      'AVENIDA RADIAL LESTE',
      'RADIAL LESTE',
      'AVENIDA ALCANTARA MACHADO',
      'AVENIDA CONDE DE FRONTIN',
      'VIADUTO ALCANTARA MACHADO',
    ],
    overpassNameRegex: 'Alcântara Machado|Conde de Frontin|Radial Leste|Salim Farah Maluf|Melo Freire',
    primaryStreetRegex: /alc[aâ]ntara machado|conde de frontin|radial leste/i,
  },
]

const BBOX_HALF_DELTA_LAT = 0.0068 // ~750 m norte/sul => ~1.5 km altura
const BBOX_HALF_DELTA_LON = 0.0074 // ~750 m leste/oeste => ~1.5 km largura

function roundCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function clipCoordinatesToBbox(
  coords: Array<[number, number]>,
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
): Array<[number, number]> {
  return coords
    .filter(
      ([lon, lat]) =>
        lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat,
    )
    .map(([lon, lat]) => [roundCoord(lon), roundCoord(lat)] as [number, number])
}

async function fetchAssetFromOverpass(
  seed: CuratedAssetSeed,
  urls: string[],
): Promise<CuratedRoadSnapshot[]> {
  const minLon = seed.camera.center[0] - BBOX_HALF_DELTA_LON
  const maxLon = seed.camera.center[0] + BBOX_HALF_DELTA_LON
  const minLat = seed.camera.center[1] - BBOX_HALF_DELTA_LAT
  const maxLat = seed.camera.center[1] + BBOX_HALF_DELTA_LAT
  const query = `[out:json][timeout:25];way(${minLat.toFixed(6)},${minLon.toFixed(6)},${maxLat.toFixed(6)},${maxLon.toFixed(6)})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified)(_link)?$"]["name"];out tags geom;`
  const body = new URLSearchParams({ data: query }).toString()
  const nameFilterRegex = new RegExp(seed.overpassNameRegex, 'i')

  let lastError: unknown = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_500))
    }

    for (const mirrorUrl of urls) {
      try {
        const response = await fetch(mirrorUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'user-agent': 'ooh-alerta-alagamentos/0.1',
          },
          body,
          signal: AbortSignal.timeout(30_000),
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} em ${mirrorUrl}`)
        }

        const payload = (await response.json()) as OverpassResponse

        const roads: CuratedRoadSnapshot[] = []
        for (const element of payload.elements) {
          if (element.type !== 'way' || !element.geometry || element.geometry.length < 2) {
            continue
          }

          const streetName = element.tags?.name?.trim() || ''
          if (!streetName || !nameFilterRegex.test(streetName)) {
            continue
          }

          const rawCoords = element.geometry.map(
            (node): [number, number] => [node.lon, node.lat],
          )
          const clipped = clipCoordinatesToBbox(rawCoords, minLon, minLat, maxLon, maxLat)
          if (clipped.length < 2) {
            continue
          }

          roads.push({
            osmId: String(element.id),
            streetName,
            highway: element.tags?.highway?.trim() || 'primary',
            isPrimaryCorridor: seed.primaryStreetRegex.test(
              streetName.normalize('NFD').replace(/\p{Diacritic}/gu, ''),
            ),
            coordinates: clipped,
          })
        }

        if (roads.length > 0) {
          return roads
        }
      } catch (error) {
        lastError = error
        console.warn(`Aviso ao consultar ${seed.id} (tentativa ${attempt}) em ${mirrorUrl}:`, error)
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Falha ao obter geometrias OSM para ${seed.id}`)
}

function computeCameraBounds(
  seed: CuratedAssetSeed,
  roads: CuratedRoadSnapshot[],
): [[number, number], [number, number]] {
  let minLon = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  for (const road of roads) {
    for (const [lon, lat] of road.coordinates) {
      if (lon < minLon) minLon = lon
      if (lat < minLat) minLat = lat
      if (lon > maxLon) maxLon = lon
      if (lat > maxLat) maxLat = lat
    }
  }

  if (!Number.isFinite(minLon)) {
    return [
      [roundCoord(seed.camera.center[0] - 0.005), roundCoord(seed.camera.center[1] - 0.005)],
      [roundCoord(seed.camera.center[0] + 0.005), roundCoord(seed.camera.center[1] + 0.005)],
    ]
  }

  return [
    [roundCoord(minLon), roundCoord(minLat)],
    [roundCoord(maxLon), roundCoord(maxLat)],
  ]
}

async function main(): Promise<void> {
  const urls = env.OVERPASS_URLS.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const assets: CuratedAssetEntry[] = []

  for (const seed of CURATED_ASSET_SEEDS) {
    console.log(`Consultando Overpass para ${seed.id}...`)
    const roads = await fetchAssetFromOverpass(seed, urls)
    const bounds = computeCameraBounds(seed, roads)

    assets.push({
      id: seed.id,
      name: seed.name,
      corridorName: seed.corridorName,
      neighborhood: seed.neighborhood,
      zone: seed.zone,
      latitude: seed.latitude,
      longitude: seed.longitude,
      camera: {
        center: seed.camera.center,
        zoom: seed.camera.zoom,
        bearing: seed.camera.bearing,
        bounds,
      },
      aliases: seed.aliases,
      roads,
    })

    console.log(`  -> ${roads.length} trechos OSM capturados para ${seed.id}`)
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }

  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const outputPath = path.resolve(
    currentDir,
    '../src/repositories/in-memory/curated-ooh-geometries.ts',
  )

  const serialized = JSON.stringify(assets, null, 2)
  const fileContent = `/**
 * Catálogo curado de 7 corredores OOH icônicos em São Paulo com geometrias viárias reais.
 * Dados geográficos: © OpenStreetMap contributors (ODbL) — extraídos via Overpass API.
 * Arquivo gerado por \`npm run fetch:curated-geometries\`.
 */

import type { OohAsset } from '../ooh-asset-repository.js'

export const CURATED_OOH_GEOMETRIES: readonly OohAsset[] = ${serialized}
`

  writeFileSync(outputPath, fileContent, 'utf8')
  const sizeKb = (Buffer.byteLength(fileContent, 'utf8') / 1024).toFixed(1)
  console.log(`Arquivo gerado em ${outputPath} (${sizeKb} KB)`)
}

main().catch((error) => {
  console.error('Erro ao gerar geometrias curadas:', error)
  process.exit(1)
})
