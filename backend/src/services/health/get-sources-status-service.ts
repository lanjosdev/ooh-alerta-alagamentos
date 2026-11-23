import type { MemoryCache, SourceHealthSnapshot } from '../../lib/cache.js'

export interface SourcesStatusResult {
  checkedAt: string
  providers: SourceHealthSnapshot[]
}

export class GetSourcesStatusService {
  constructor(private readonly cache: MemoryCache) {}

  execute(): SourcesStatusResult {
    return {
      checkedAt: new Date().toISOString(),
      providers: this.cache.getHealthSnapshots(),
    }
  }
}
