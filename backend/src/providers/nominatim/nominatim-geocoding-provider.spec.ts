import { describe, expect, it, vi } from 'vitest'
import nominatimSample from './__fixtures__/nominatim-sample.json' with { type: 'json' }
import { NominatimGeocodingProvider } from './nominatim-geocoding-provider.js'

describe('NominatimGeocodingProvider', () => {
  it('envia parâmetros bounded de SP, User-Agent e filtra resultados para BR-SP', async () => {
    let capturedUrl = ''
    let capturedUserAgent = ''

    const fetchFn: typeof fetch = vi.fn(async (input, init) => {
      capturedUrl = String(input)
      capturedUserAgent = new Headers(init?.headers).get('user-agent') ?? ''
      return new Response(JSON.stringify(nominatimSample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = new NominatimGeocodingProvider({
      fetchFn,
      userAgent: 'ooh-alerta-test/0.2',
    })

    const results = await provider.searchAddress('Roberto Marinho')

    const parsedUrl = new URL(capturedUrl)
    expect(parsedUrl.searchParams.get('viewbox')).toBe('-46.85,-24.02,-46.35,-23.35')
    expect(parsedUrl.searchParams.get('bounded')).toBe('1')
    expect(parsedUrl.searchParams.get('countrycodes')).toBe('br')
    expect(parsedUrl.searchParams.get('format')).toBe('jsonv2')
    expect(parsedUrl.searchParams.get('addressdetails')).toBe('1')
    expect(parsedUrl.searchParams.get('limit')).toBe('5')
    expect(parsedUrl.searchParams.get('accept-language')).toBe('pt-BR')
    expect(capturedUserAgent).toBe('ooh-alerta-test/0.2')

    expect(results).toEqual([
      {
        id: 'way:123456',
        displayName: 'Avenida Jornalista Roberto Marinho, Brooklin, São Paulo, SP, Brasil',
        primaryName: 'Avenida Jornalista Roberto Marinho',
        neighborhood: 'Brooklin',
        city: 'São Paulo',
        state: 'São Paulo',
        latitude: -23.6215,
        longitude: -46.6891,
      },
    ])
  })

  it('respeita fila serial com espaçamento mínimo de 1100 ms entre chamadas', async () => {
    let virtualNow = 10_000
    const sleepDurations: number[] = []
    const callTimestamps: number[] = []

    const provider = new NominatimGeocodingProvider({
      nowFn: () => virtualNow,
      sleepFn: async (ms) => {
        sleepDurations.push(ms)
        virtualNow += ms
      },
      fetchFn: vi.fn(async () => {
        callTimestamps.push(virtualNow)
        virtualNow += 50
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    })

    await Promise.all([
      provider.searchAddress('Av Paulista'),
      provider.searchAddress('Marginal Pinheiros'),
    ])

    expect(sleepDurations).toEqual([1100])
    expect(callTimestamps[1] - callTimestamps[0]).toBeGreaterThanOrEqual(1100)
  })

  it('lança erro quando Nominatim responde 403 ou 429', async () => {
    const fetch403: typeof fetch = vi.fn(async () => new Response('Forbidden', { status: 403 }))
    const provider403 = new NominatimGeocodingProvider({
      fetchFn: fetch403,
      minIntervalMs: 0,
    })
    await expect(provider403.searchAddress('Av Paulista')).rejects.toThrow('Nominatim respondeu HTTP 403')

    const fetch429: typeof fetch = vi.fn(async () => new Response('Too Many Requests', { status: 429 }))
    const provider429 = new NominatimGeocodingProvider({
      fetchFn: fetch429,
      minIntervalMs: 0,
    })
    await expect(provider429.searchAddress('Av Paulista')).rejects.toThrow('Nominatim respondeu HTTP 429')
  })
})
