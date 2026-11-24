import { env } from '../../env.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from '../flooding-monitor-provider.js'
import { parseCgeFloodingPointsHtml, parseCgeStationHtml } from './cge-sp-parser.js'
import { findCgeStationById } from './cge-sp-stations.js'

const DEFAULT_CGE_SP_BASE_URL = 'https://www.cgesp.org/v3'
const DEFAULT_DELTA_WINDOW_MS = 15 * 60 * 1000

interface StationRainfallSample {
  timestampMs: number
  currentPeriodMm: number
}

export interface CgeSpFloodingProviderOptions {
  fetchFn?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
  nowFn?: () => number
  deltaWindowMs?: number
}

async function decodeResponseHtml(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''
  const charsetMatch = /charset=([^\s;]+)/i.exec(contentType)
  const charset = charsetMatch?.[1]?.trim().toLowerCase() ?? 'utf-8'
  const buffer = await response.arrayBuffer()

  try {
    return new TextDecoder(charset).decode(buffer)
  } catch {
    return new TextDecoder('utf-8').decode(buffer)
  }
}

export class CgeSpFloodingProvider implements FloodingMonitorProvider {
  readonly providerName = 'cge-sp'

  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number
  private readonly baseUrl: string
  private readonly nowFn: () => number
  private readonly deltaWindowMs: number
  private readonly stationHistory = new Map<string, StationRainfallSample[]>()

  constructor(options: CgeSpFloodingProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? env.HTTP_TIMEOUT_MS
    this.baseUrl = (options.baseUrl ?? DEFAULT_CGE_SP_BASE_URL).replace(/\/$/, '')
    this.nowFn = options.nowFn ?? (() => Date.now())
    this.deltaWindowMs = options.deltaWindowMs ?? DEFAULT_DELTA_WINDOW_MS
  }

  async getFloodingPoints(options?: { cgeDate?: string }): Promise<FloodingPoint[]> {
    const url = options?.cgeDate
      ? `${this.baseUrl}/alagamentos.jsp?dataBusca=${encodeURIComponent(options.cgeDate)}&enviaBusca=Buscar`
      : `${this.baseUrl}/alagamentos.jsp`

    const response = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`CGE-SP alagamentos respondeu HTTP ${response.status}`)
    }

    const html = await decodeResponseHtml(response)
    return parseCgeFloodingPointsHtml(html)
  }

  async getStationRainfall(stationId: string): Promise<StationRainfall | null> {
    const url = `${this.baseUrl}/estacao.jsp?POSTO=${encodeURIComponent(stationId)}`

    const response = await this.fetchFn(url, {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`CGE-SP estação respondeu HTTP ${response.status}`)
    }

    const html = await decodeResponseHtml(response)
    const stationName = findCgeStationById(stationId)?.name ?? null
    const parsed = parseCgeStationHtml(html, stationId, stationName)
    if (!parsed) {
      return null
    }

    return {
      ...parsed,
      recentDeltaMm: this.computeRecentDeltaMm(stationId, parsed.currentPeriodMm),
    }
  }

  private computeRecentDeltaMm(stationId: string, currentPeriodMm: number | null): number | null {
    if (currentPeriodMm === null) {
      return null
    }

    const nowMs = this.nowFn()
    const previousSamples = this.stationHistory.get(stationId) ?? []
    const recentSamples = previousSamples.filter(
      (entry) => nowMs - entry.timestampMs <= this.deltaWindowMs,
    )

    if (recentSamples.length === 0) {
      this.stationHistory.set(stationId, [{ timestampMs: nowMs, currentPeriodMm }])
      return null
    }

    const baseline = recentSamples[0]
    if (currentPeriodMm < baseline.currentPeriodMm) {
      this.stationHistory.set(stationId, [{ timestampMs: nowMs, currentPeriodMm }])
      return null
    }

    const delta = Math.round((currentPeriodMm - baseline.currentPeriodMm) * 100) / 100
    recentSamples.push({ timestampMs: nowMs, currentPeriodMm })
    this.stationHistory.set(stationId, recentSamples)
    return delta
  }
}
