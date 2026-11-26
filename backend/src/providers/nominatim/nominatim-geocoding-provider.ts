import { z } from 'zod'
import { env } from '../../env.js'
import type { GeocodingCandidate, GeocodingProvider } from '../geocoding-provider.js'

const DEFAULT_NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search'
const SAO_PAULO_VIEWBOX = '-46.85,-24.02,-46.35,-23.35'
const DEFAULT_MIN_INTERVAL_MS = 1_100
const DEFAULT_TIMEOUT_MS = 5_000

const nominatimResultSchema = z.object({
  osm_type: z.string(),
  osm_id: z.number(),
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  name: z.string().optional(),
  address: z
    .object({
      road: z.string().optional(),
      pedestrian: z.string().optional(),
      suburb: z.string().optional(),
      neighbourhood: z.string().optional(),
      city_district: z.string().optional(),
      city: z.string().optional(),
      town: z.string().optional(),
      municipality: z.string().optional(),
      state: z.string().optional(),
      'ISO3166-2-lvl4': z.string().optional(),
    })
    .optional(),
})

const nominatimResponseSchema = z.array(nominatimResultSchema)

export interface NominatimGeocodingProviderOptions {
  fetchFn?: typeof fetch
  baseUrl?: string
  userAgent?: string
  timeoutMs?: number
  minIntervalMs?: number
  nowFn?: () => number
  sleepFn?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  readonly providerName = 'nominatim'

  private readonly fetchFn: typeof fetch
  private readonly baseUrl: string
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly minIntervalMs: number
  private readonly nowFn: () => number
  private readonly sleepFn: (ms: number) => Promise<void>

  private queueTail: Promise<void> = Promise.resolve()
  private lastRequestAtMs: number | null = null

  constructor(options: NominatimGeocodingProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.baseUrl = options.baseUrl ?? DEFAULT_NOMINATIM_BASE_URL
    this.userAgent = options.userAgent ?? env.NOMINATIM_USER_AGENT
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.sleepFn = options.sleepFn ?? defaultSleep
  }

  async searchAddress(query: string): Promise<GeocodingCandidate[]> {
    return this.enqueue(async () => {
      const url = new URL(this.baseUrl)
      url.searchParams.set('q', query.trim())
      url.searchParams.set('viewbox', SAO_PAULO_VIEWBOX)
      url.searchParams.set('bounded', '1')
      url.searchParams.set('countrycodes', 'br')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('limit', '5')
      url.searchParams.set('accept-language', 'pt-BR')

      const response = await this.fetchFn(url.toString(), {
        headers: {
          'user-agent': this.userAgent,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      if (!response.ok) {
        throw new Error(`Nominatim respondeu HTTP ${response.status}`)
      }

      const rawJson: unknown = await response.json()
      const items = nominatimResponseSchema.parse(rawJson)

      const candidates: GeocodingCandidate[] = []
      for (const item of items) {
        if (item.address?.['ISO3166-2-lvl4'] !== 'BR-SP') {
          continue
        }

        const latitude = Number.parseFloat(item.lat)
        const longitude = Number.parseFloat(item.lon)
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          continue
        }

        const primaryName =
          item.address?.road ??
          item.address?.pedestrian ??
          item.name ??
          item.display_name.split(',')[0]?.trim() ??
          item.display_name

        candidates.push({
          id: `${item.osm_type}:${item.osm_id}`,
          displayName: item.display_name,
          primaryName,
          neighborhood:
            item.address?.suburb ??
            item.address?.neighbourhood ??
            item.address?.city_district ??
            null,
          city: item.address?.city ?? item.address?.town ?? item.address?.municipality ?? null,
          state: item.address?.state ?? 'São Paulo',
          latitude,
          longitude,
        })
      }

      return candidates
    })
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      if (this.lastRequestAtMs !== null) {
        const elapsed = this.nowFn() - this.lastRequestAtMs
        const waitMs = this.minIntervalMs - elapsed
        if (waitMs > 0) {
          await this.sleepFn(waitMs)
        }
      }

      this.lastRequestAtMs = this.nowFn()
      try {
        return await task()
      } finally {
        this.lastRequestAtMs = this.nowFn()
      }
    }

    const resultPromise = this.queueTail.then(run, run)
    this.queueTail = resultPromise.then(
      () => undefined,
      () => undefined,
    )
    return resultPromise
  }
}
