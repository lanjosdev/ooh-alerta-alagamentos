import { describe, expect, it, vi } from 'vitest'
import overpassSample from './__fixtures__/overpass-sample.json' with { type: 'json' }
import { OverpassRoadGeometryProvider } from './overpass-road-geometry-provider.js'

describe('OverpassRoadGeometryProvider', () => {
  it('envia POST form-urlencoded com Accept/User-Agent e converte {lat, lon} para [lon, lat]', async () => {
    let capturedMethod = ''
    let capturedBody = ''
    let capturedContentType = ''
    let capturedAccept = ''
    let capturedUserAgent = ''

    const fetchFn: typeof fetch = vi.fn(async (_input, init) => {
      capturedMethod = init?.method ?? ''
      capturedBody = String(init?.body ?? '')
      const headers = new Headers(init?.headers)
      capturedContentType = headers.get('content-type') ?? ''
      capturedAccept = headers.get('accept') ?? ''
      capturedUserAgent = headers.get('user-agent') ?? ''

      return new Response(JSON.stringify(overpassSample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = new OverpassRoadGeometryProvider({
      fetchFn,
      urls: ['https://primary.overpass.test/api/interpreter'],
      userAgent: 'ooh-alerta-test/0.2',
    })

    const segments = await provider.getNearbyRoads(-23.622, -46.685)

    expect(capturedMethod).toBe('POST')
    expect(capturedContentType).toContain('application/x-www-form-urlencoded')
    expect(capturedAccept).toBe('application/json')
    expect(capturedUserAgent).toBe('ooh-alerta-test/0.2')
    expect(decodeURIComponent(capturedBody)).toMatch(
      /way\(-23\.624\d+,-46\.687\d+,-23\.619\d+,-46\.682\d+\)/,
    )
    expect(segments).toEqual([
      {
        osmId: '1001',
        streetName: 'Avenida Jornalista Roberto Marinho',
        highway: 'primary',
        coordinates: [
          [-46.69, -23.621],
          [-46.685, -23.622],
          [-46.68, -23.623],
        ],
      },
    ])
  })

  it('faz fallback do mirror primário (502/timeout) para o mirror secundário', async () => {
    const calledUrls: string[] = []
    const fetchFn: typeof fetch = vi.fn(async (input) => {
      const url = String(input)
      calledUrls.push(url)
      if (url.includes('primary')) {
        return new Response('Bad Gateway', { status: 502 })
      }
      return new Response(JSON.stringify(overpassSample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = new OverpassRoadGeometryProvider({
      fetchFn,
      urls: [
        'https://primary.overpass.test/api/interpreter',
        'https://secondary.overpass.test/api/interpreter',
      ],
    })

    const segments = await provider.getNearbyRoads(-23.622, -46.685)
    expect(calledUrls).toEqual([
      'https://primary.overpass.test/api/interpreter',
      'https://secondary.overpass.test/api/interpreter',
    ])
    expect(segments).toHaveLength(1)
  })

  it('expande raio de 300 m para 450 m incluindo vias locais quando o primeiro retorno vem vazio', async () => {
    const queries: string[] = []
    const fetchFn: typeof fetch = vi.fn(async (_input, init) => {
      const decoded = decodeURIComponent(String(init?.body ?? ''))
      queries.push(decoded)

      if (queries.length === 1) {
        return new Response(JSON.stringify({ elements: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({
          elements: [
            {
              type: 'way',
              id: 2002,
              tags: { name: 'Rua Local Teste', highway: 'residential' },
              geometry: [
                { lat: -23.6, lon: -46.6 },
                { lat: -23.601, lon: -46.601 },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    const provider = new OverpassRoadGeometryProvider({
      fetchFn,
      urls: ['https://primary.overpass.test/api/interpreter'],
    })

    const segments = await provider.getNearbyRoads(-23.6, -46.6)
    expect(queries).toHaveLength(2)
    expect(queries[0]).toMatch(/way\(-23\.602\d+,-46\.602\d+,-23\.597\d+,-46\.597\d+\)/)
    expect(queries[1]).toMatch(/way\(-23\.604\d+,-46\.604\d+,-23\.595\d+,-46\.595\d+\)/)
    expect(queries[1]).toContain('residential|unclassified')
    expect(segments[0].streetName).toBe('Rua Local Teste')
  })

  it('lança erro quando todos os mirrors falham', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => new Response('Unavailable', { status: 504 }))
    const provider = new OverpassRoadGeometryProvider({
      fetchFn,
      urls: [
        'https://primary.overpass.test/api/interpreter',
        'https://secondary.overpass.test/api/interpreter',
      ],
    })

    await expect(provider.getNearbyRoads(-23.6, -46.6)).rejects.toThrow('HTTP 504')
  })

  it('retorna o mirror mais rápido em paralelo e aborta mirrors lentos restantes', async () => {
    let slowSignal: AbortSignal | undefined
    const fetchFn: typeof fetch = vi.fn(async (input, init) => {
      const url = String(input)
      if (url.includes('slow')) {
        slowSignal = init?.signal ?? undefined
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }

      return new Response(JSON.stringify(overpassSample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = new OverpassRoadGeometryProvider({
      fetchFn,
      urls: [
        'https://slow.overpass.test/api/interpreter',
        'https://fast.overpass.test/api/interpreter',
      ],
    })

    const segments = await provider.getNearbyRoads(-23.622, -46.685)
    expect(segments).toHaveLength(1)
    expect(slowSignal?.aborted).toBe(true)
  })
})
