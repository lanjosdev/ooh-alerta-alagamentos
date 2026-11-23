import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from './cache.js'

describe('MemoryCache', () => {
  it('retorna snapshot inicial unknown para provedor registrado', () => {
    const cache = new MemoryCache()
    cache.registerProvider('open-meteo')

    expect(cache.getHealthSnapshots()).toEqual([
      {
        provider: 'open-meteo',
        status: 'unknown',
        cachedKeys: 0,
        lastSuccessAt: null,
        lastErrorAt: null,
        lastErrorMessage: null,
        lastLatencyMs: null,
      },
    ])
  })

  it('armazena resultado em cache e evita nova chamada enquanto TTL é válido', async () => {
    let now = 1_700_000_000_000
    const cache = new MemoryCache(() => now)
    const fetcher = vi.fn(async () => ({ temp: 24 }))

    const first = await cache.getOrFetch({
      provider: 'open-meteo',
      key: 'forecast:sp',
      ttlSeconds: 60,
      fetcher,
    })

    now += 30_000

    const second = await cache.getOrFetch({
      provider: 'open-meteo',
      key: 'forecast:sp',
      ttlSeconds: 60,
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(first).toEqual({
      value: { temp: 24 },
      cached: false,
      stale: false,
      fetchedAt: new Date(1_700_000_000_000).toISOString(),
    })
    expect(second).toEqual({
      value: { temp: 24 },
      cached: true,
      stale: false,
      fetchedAt: new Date(1_700_000_000_000).toISOString(),
    })

    expect(cache.getProviderHealth('open-meteo')).toMatchObject({
      provider: 'open-meteo',
      status: 'ok',
      cachedKeys: 1,
      lastErrorAt: null,
      lastLatencyMs: 0,
    })
  })

  it('expira após o TTL e realiza nova consulta com sucesso', async () => {
    let now = 1_700_000_000_000
    const cache = new MemoryCache(() => now)
    const fetcher = vi
      .fn<() => Promise<number>>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)

    const first = await cache.getOrFetch({
      provider: 'inmet',
      key: 'inmet:active',
      ttlSeconds: 60,
      fetcher,
    })

    now += 61_000

    const second = await cache.getOrFetch({
      provider: 'inmet',
      key: 'inmet:active',
      ttlSeconds: 60,
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.value).toBe(1)
    expect(second).toEqual({
      value: 2,
      cached: false,
      stale: false,
      fetchedAt: new Date(1_700_000_061_000).toISOString(),
    })
  })

  it('retorna stale fallback quando o provedor falha após expiração do TTL', async () => {
    let now = 1_700_000_000_000
    const cache = new MemoryCache(() => now)
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('snapshot-inicial')
      .mockRejectedValueOnce(new Error('Timeout CGE-SP'))

    const initial = await cache.getOrFetch({
      provider: 'cge-sp',
      key: 'cge:floodings',
      ttlSeconds: 30,
      fetcher,
    })

    now += 35_000

    const fallback = await cache.getOrFetch({
      provider: 'cge-sp',
      key: 'cge:floodings',
      ttlSeconds: 30,
      fetcher,
    })

    expect(initial.value).toBe('snapshot-inicial')
    expect(fallback).toEqual({
      value: 'snapshot-inicial',
      cached: true,
      stale: true,
      fetchedAt: new Date(1_700_000_000_000).toISOString(),
    })

    expect(cache.getProviderHealth('cge-sp')).toMatchObject({
      provider: 'cge-sp',
      status: 'degraded',
      cachedKeys: 1,
      lastErrorAt: new Date(1_700_000_035_000).toISOString(),
      lastErrorMessage: 'Timeout CGE-SP',
    })
  })

  it('propaga erro em cold miss quando não há entrada prévia em cache', async () => {
    const cache = new MemoryCache(() => 1_700_000_000_000)
    const fetcher = vi.fn(async () => {
      throw new Error('Serviço indisponível')
    })

    await expect(
      cache.getOrFetch({
        provider: 'inmet',
        key: 'inmet:active',
        ttlSeconds: 60,
        fetcher,
      }),
    ).rejects.toThrow('Serviço indisponível')

    expect(cache.getProviderHealth('inmet')).toMatchObject({
      status: 'degraded',
      cachedKeys: 0,
      lastSuccessAt: null,
      lastErrorMessage: 'Serviço indisponível',
    })
  })

  it('faz coalescing de requisições concorrentes na mesma chave', async () => {
    const cache = new MemoryCache()
    let resolveFetch!: (value: string) => void

    const fetcher = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const p1 = cache.getOrFetch({
      provider: 'inmet',
      key: 'inmet:shared',
      ttlSeconds: 60,
      fetcher,
    })
    const p2 = cache.getOrFetch({
      provider: 'inmet',
      key: 'inmet:shared',
      ttlSeconds: 60,
      fetcher,
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    resolveFetch('dados-compartilhados')

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.value).toBe('dados-compartilhados')
    expect(r2.value).toBe('dados-compartilhados')
  })
})
