import { env } from '../../env.js'
import type { MemoryCache } from '../../lib/cache.js'
import type { GeocodingCandidate, GeocodingProvider } from '../../providers/geocoding-provider.js'

export interface SearchAddressDependencies {
  geocodingProvider: GeocodingProvider
  cache: MemoryCache
  cacheTtlSeconds?: number
}

export class SearchAddressService {
  private readonly cacheTtlSeconds: number

  constructor(private readonly deps: SearchAddressDependencies) {
    this.cacheTtlSeconds = deps.cacheTtlSeconds ?? env.CACHE_TTL_GEOCODE_SECONDS
  }

  async execute(query: string): Promise<GeocodingCandidate[]> {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ')
    const result = await this.deps.cache.getOrFetch({
      provider: this.deps.geocodingProvider.providerName,
      key: `geocode:${normalized}`,
      ttlSeconds: this.cacheTtlSeconds,
      fetcher: () => this.deps.geocodingProvider.searchAddress(query.trim()),
    })

    return result.value
  }
}
