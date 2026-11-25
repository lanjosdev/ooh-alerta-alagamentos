import { describe, expect, it, vi } from 'vitest'
import geosampaSample from './__fixtures__/geosampa-sample.json' with { type: 'json' }
import { GeoSampaWfsProvider, buildGeoSampaWfsUrl } from './geosampa-wfs-provider.js'

describe('GeoSampaWfsProvider', () => {
  it('monta URL WFS 2.0.0 com bbox na ordem minLat,minLon,maxLat,maxLon,urn:ogc:def:crs:EPSG::4326', () => {
    const generatedUrl = buildGeoSampaWfsUrl(
      'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs',
      'geoportal:mancha_inundacao_25',
      -23.622,
      -46.685,
      1200,
    )

    const parsed = new URL(generatedUrl)
    expect(parsed.searchParams.get('service')).toBe('WFS')
    expect(parsed.searchParams.get('version')).toBe('2.0.0')
    expect(parsed.searchParams.get('request')).toBe('GetFeature')
    expect(parsed.searchParams.get('typeNames')).toBe('geoportal:mancha_inundacao_25')
    expect(parsed.searchParams.get('outputFormat')).toBe('application/json')
    expect(parsed.searchParams.get('srsName')).toBe('EPSG:4326')
    expect(parsed.searchParams.get('count')).toBe('500')

    const bboxParam = parsed.searchParams.get('bbox')
    expect(bboxParam).not.toBeNull()
    const parts = bboxParam!.split(',')
    expect(parts).toHaveLength(5)

    const [minLatStr, minLonStr, maxLatStr, maxLonStr, crsUrn] = parts
    const minLat = Number(minLatStr)
    const minLon = Number(minLonStr)
    const maxLat = Number(maxLatStr)
    const maxLon = Number(maxLonStr)

    // Latitude em SP fica em ~ -23.6 e longitude em ~ -46.7
    expect(minLat).toBeLessThan(-23.622)
    expect(maxLat).toBeGreaterThan(-23.622)
    expect(minLon).toBeLessThan(-46.685)
    expect(maxLon).toBeGreaterThan(-46.685)
    expect(minLat).toBeGreaterThan(-24)
    expect(maxLon).toBeLessThan(-46)
    expect(crsUrn).toBe('urn:ogc:def:crs:EPSG::4326')
  })

  it('retorna polígonos da camada primária e faz fallback para geoportal:area_inundavel quando primária falha', async () => {
    const calledLayers: string[] = []
    const fetchFn: typeof fetch = vi.fn(async (input) => {
      const url = new URL(String(input))
      const layer = url.searchParams.get('typeNames') ?? ''
      calledLayers.push(layer)

      if (layer === 'geoportal:mancha_inundacao_25') {
        return new Response('Service Unavailable', { status: 503 })
      }

      return new Response(JSON.stringify(geosampaSample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = new GeoSampaWfsProvider({ fetchFn })
    const zones = await provider.getFloodZones(-23.621, -46.69)

    expect(calledLayers).toEqual([
      'geoportal:mancha_inundacao_25',
      'geoportal:area_inundavel',
    ])
    expect(zones).toHaveLength(1)
    expect(zones[0]).toMatchObject({
      id: 'mancha_inundacao_25.1',
      layerName: 'geoportal:area_inundavel',
      geometry: { type: 'Polygon' },
    })
  })

  it('lida com retorno vazio e propaga erro quando ambas camadas falham', async () => {
    const emptyProvider = new GeoSampaWfsProvider({
      fetchFn: vi.fn(
        async () =>
          new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    })
    await expect(emptyProvider.getFloodZones(-23.55, -46.63)).resolves.toEqual([])

    const failingProvider = new GeoSampaWfsProvider({
      fetchFn: vi.fn(async () => new Response('Error', { status: 500 })),
    })
    await expect(failingProvider.getFloodZones(-23.55, -46.63)).rejects.toThrow('HTTP 500')
  })
})
