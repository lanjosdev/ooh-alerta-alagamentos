import { logger } from './logger.js'

export interface CacheLookupResult<T> {
  value: T
  cached: boolean
  stale: boolean
  fetchedAt: string
}

export type SourceHealthStatus = 'ok' | 'degraded' | 'unknown'

export interface SourceHealthSnapshot {
  provider: string
  status: SourceHealthStatus
  cachedKeys: number
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  lastLatencyMs: number | null
}

export interface CacheFetchOptions<T> {
  provider: string
  key: string
  ttlSeconds: number
  fetcher: () => Promise<T>
}

interface CacheEntry {
  provider: string
  value: unknown
  fetchedAt: string
  expiresAtMs: number
}

interface ProviderHealthState {
  status: SourceHealthStatus
  lastSuccessAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
  lastLatencyMs: number | null
}

function createInitialHealthState(): ProviderHealthState {
  return {
    status: 'unknown',
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastLatencyMs: null,
  }
}

export class MemoryCache {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly inFlight = new Map<string, Promise<CacheLookupResult<unknown>>>()
  private readonly healthStates = new Map<string, ProviderHealthState>()

  constructor(private readonly nowFn: () => number = () => Date.now()) {}

  registerProvider(provider: string): void {
    if (!this.healthStates.has(provider)) {
      this.healthStates.set(provider, createInitialHealthState())
    }
  }

  async getOrFetch<T>(options: CacheFetchOptions<T>): Promise<CacheLookupResult<T>> {
    const { provider, key, ttlSeconds, fetcher } = options
    this.registerProvider(provider)

    const existing = this.entries.get(key)
    const nowMs = this.nowFn()

    if (existing && nowMs < existing.expiresAtMs) {
      return {
        value: existing.value as T,
        cached: true,
        stale: false,
        fetchedAt: existing.fetchedAt,
      }
    }

    const pending = this.inFlight.get(key)
    if (pending) {
      const result = await pending
      return {
        value: result.value as T,
        cached: result.cached,
        stale: result.stale,
        fetchedAt: result.fetchedAt,
      }
    }

    const fetchPromise = this.executeFetch<T>(provider, key, ttlSeconds, fetcher)
    this.inFlight.set(key, fetchPromise)

    try {
      return await fetchPromise
    } finally {
      this.inFlight.delete(key)
    }
  }

  getProviderHealth(provider: string): SourceHealthSnapshot {
    const state = this.healthStates.get(provider) ?? createInitialHealthState()
    let cachedKeys = 0
    for (const entry of this.entries.values()) {
      if (entry.provider === provider) {
        cachedKeys += 1
      }
    }

    return {
      provider,
      status: state.status,
      cachedKeys,
      lastSuccessAt: state.lastSuccessAt,
      lastErrorAt: state.lastErrorAt,
      lastErrorMessage: state.lastErrorMessage,
      lastLatencyMs: state.lastLatencyMs,
    }
  }

  getHealthSnapshots(): SourceHealthSnapshot[] {
    return Array.from(this.healthStates.keys(), (provider) => this.getProviderHealth(provider))
  }

  clear(): void {
    this.entries.clear()
    this.inFlight.clear()
    for (const provider of this.healthStates.keys()) {
      this.healthStates.set(provider, createInitialHealthState())
    }
  }

  private async executeFetch<T>(
    provider: string,
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
  ): Promise<CacheLookupResult<T>> {
    const startedAtMs = this.nowFn()
    const health = this.healthStates.get(provider) ?? createInitialHealthState()
    this.healthStates.set(provider, health)

    try {
      const value = await fetcher()
      const completedAtMs = this.nowFn()
      const fetchedAt = new Date(completedAtMs).toISOString()

      this.entries.set(key, {
        provider,
        value,
        fetchedAt,
        expiresAtMs: completedAtMs + ttlSeconds * 1000,
      })

      health.status = 'ok'
      health.lastSuccessAt = fetchedAt
      health.lastLatencyMs = Math.max(0, completedAtMs - startedAtMs)

      return {
        value,
        cached: false,
        stale: false,
        fetchedAt,
      }
    } catch (error) {
      const failedAtMs = this.nowFn()
      const errorMessage = error instanceof Error ? error.message : String(error)

      health.status = 'degraded'
      health.lastErrorAt = new Date(failedAtMs).toISOString()
      health.lastErrorMessage = errorMessage
      health.lastLatencyMs = Math.max(0, failedAtMs - startedAtMs)

      logger.warn({ provider, key, err: error }, 'Falha ao atualizar cache da fonte externa')

      const staleEntry = this.entries.get(key)
      if (staleEntry) {
        return {
          value: staleEntry.value as T,
          cached: true,
          stale: true,
          fetchedAt: staleEntry.fetchedAt,
        }
      }

      throw error
    }
  }
}
