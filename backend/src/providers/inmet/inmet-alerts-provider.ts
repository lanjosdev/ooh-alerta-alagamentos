import { z } from 'zod'
import { env } from '../../env.js'
import { isPointInGeoJson, parseGeoJsonGeometry } from '../../utils/geojson.js'
import type {
  AlertMatchInput,
  OfficialAlertSeverityRank,
  OfficialAlertsProvider,
  OfficialWeatherAlert,
} from '../official-alerts-provider.js'

const DEFAULT_INMET_ENDPOINT = 'https://apiprevmet3.inmet.gov.br/avisos/ativos'

const inmetRawAlertSchema = z.object({
  id: z.union([z.number(), z.string()]),
  codigo: z.string().optional(),
  inicio: z.string().optional().default(''),
  fim: z.string().optional().default(''),
  descricao: z.string().optional().default('Aviso meteorológico'),
  severidade: z.string().optional().default('Perigo Potencial'),
  aviso_cor: z.string().nullable().optional(),
  riscos: z.array(z.string()).optional().default([]),
  instrucoes: z.array(z.string()).optional().default([]),
  encerrado: z.boolean().optional().default(false),
  geocodes: z.string().nullable().optional(),
  poligono: z.string().nullable().optional(),
})

type InmetRawAlert = z.infer<typeof inmetRawAlertSchema>

const inmetResponseSchema = z.object({
  hoje: z.array(inmetRawAlertSchema).optional().default([]),
  futuro: z.array(inmetRawAlertSchema).optional().default([]),
})

export interface InmetAlertsProviderOptions {
  fetchFn?: typeof fetch
  timeoutMs?: number
  endpoint?: string
}

function mapSeverityRank(severidade: string): OfficialAlertSeverityRank {
  const normalized = severidade.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase()
  if (normalized === 'grande perigo') {
    return 3
  }
  if (normalized === 'perigo') {
    return 2
  }
  return 1
}

function parseGeocodeSet(geocodes: string | null | undefined): Set<string> {
  if (!geocodes) {
    return new Set()
  }

  return new Set(
    geocodes
      .split(',')
      .map((code) => code.trim())
      .filter((code) => code.length > 0),
  )
}

export class InmetAlertsProvider implements OfficialAlertsProvider {
  readonly providerName = 'inmet'

  private readonly fetchFn: typeof fetch
  private readonly timeoutMs: number
  private readonly endpoint: string

  constructor(options: InmetAlertsProviderOptions = {}) {
    this.fetchFn = options.fetchFn ?? fetch
    this.timeoutMs = options.timeoutMs ?? env.HTTP_TIMEOUT_MS
    this.endpoint = options.endpoint ?? DEFAULT_INMET_ENDPOINT
  }

  async getActiveAlerts(input: AlertMatchInput): Promise<OfficialWeatherAlert[]> {
    const response = await this.fetchFn(this.endpoint, {
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`INMET respondeu HTTP ${response.status}`)
    }

    const rawJson: unknown = await response.json()
    const payload = inmetResponseSchema.parse(rawJson)

    const dedupedById = new Map<string, InmetRawAlert>()
    for (const rawAlert of [...payload.hoje, ...payload.futuro]) {
      const id = String(rawAlert.id)
      if (!dedupedById.has(id)) {
        dedupedById.set(id, rawAlert)
      }
    }

    const matchedAlerts: OfficialWeatherAlert[] = []

    for (const rawAlert of dedupedById.values()) {
      if (rawAlert.encerrado) {
        continue
      }

      const matchedBy: ('ibge' | 'polygon')[] = []
      const geocodeSet = parseGeocodeSet(rawAlert.geocodes)
      if (input.ibgeCode && geocodeSet.has(input.ibgeCode.trim())) {
        matchedBy.push('ibge')
      }

      const geometry = parseGeoJsonGeometry(rawAlert.poligono)
      if (geometry && isPointInGeoJson(input.lat, input.lon, geometry)) {
        matchedBy.push('polygon')
      }

      if (matchedBy.length === 0) {
        continue
      }

      const id = String(rawAlert.id)
      matchedAlerts.push({
        id,
        code: rawAlert.codigo?.trim() || id,
        title: rawAlert.descricao.trim(),
        severity: rawAlert.severidade.trim(),
        severityRank: mapSeverityRank(rawAlert.severidade),
        colorHex: rawAlert.aviso_cor?.trim() || '#FFFE00',
        startsAt: rawAlert.inicio.trim(),
        endsAt: rawAlert.fim.trim(),
        risks: rawAlert.riscos.map((item) => item.trim()).filter(Boolean),
        instructions: rawAlert.instrucoes.map((item) => item.trim()).filter(Boolean),
        matchedBy,
      })
    }

    matchedAlerts.sort((a, b) => b.severityRank - a.severityRank)
    return matchedAlerts
  }
}
