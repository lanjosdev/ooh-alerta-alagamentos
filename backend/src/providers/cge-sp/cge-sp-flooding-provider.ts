import { env } from '../../env.js'
import type {
  FloodingMonitorProvider,
  FloodingPoint,
  StationRainfall,
} from '../flooding-monitor-provider.js'
import { parseCgeFloodingPointsHtml, parseCgeStationHtml } from './cge-sp-parser.js'
import { findCgeStationById } from './cge-sp-stations.js'

const DEFAULT_CGE_SP_BASE_URL = 'https://www.cgesp.org/v3'

export interface CgeSpFloodingProviderOptions {
  fetchFn?: typeof fetch
  timeoutMs?: number
  baseUrl?: string
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

  constructor(options: CgeSpFloodingProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? env.HTTP_TIMEOUT_MS
    this.baseUrl = (options.baseUrl ?? DEFAULT_CGE_SP_BASE_URL).replace(/\/$/, '')
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
    return parseCgeStationHtml(html, stationId, stationName)
  }
}
