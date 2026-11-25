import type { SourceExecutionStatus } from '../alerts/alert-types.js'
import type { OohAlertDecision } from '../alerts/alert-types.js'
import type { PlayerEditorialContent } from './player-types.js'

export interface BuildPlayerEditorialInput {
  decision: OohAlertDecision
  corridorNameOverride?: string
  hasGeoSampaData: boolean
  sources: {
    forecast: SourceExecutionStatus
    officialAlerts: SourceExecutionStatus
    floodingMonitor: SourceExecutionStatus
    roadGeometry: SourceExecutionStatus
    floodSusceptibility: SourceExecutionStatus
  }
}

function formatBrDate(dateIso: string): string {
  const [year, month, day] = dateIso.split('-')
  return `${day}/${month}/${year}`
}

function buildTelemetryLabels(decision: OohAlertDecision): {
  telemetryModeLabel: string
  telemetryStatusPill: string
} {
  const { temporal } = decision

  if (temporal.mode === 'simulated') {
    return {
      telemetryModeLabel: 'SIMULAÇÃO',
      telemetryStatusPill: 'MODO SIMULADO',
    }
  }

  if (temporal.mode === 'historical' && temporal.date) {
    const brDate = formatBrDate(temporal.date)
    const hhmm = temporal.resolvedTime ?? temporal.time ?? '12:00'
    return {
      telemetryModeLabel: `REPLAY • ${brDate} ${hhmm}`,
      telemetryStatusPill: 'REPLAY HISTÓRICO',
    }
  }

  return {
    telemetryModeLabel: 'TEMPO REAL',
    telemetryStatusPill: 'ATUALIZADO AGORA',
  }
}

function buildSourcesLabel(input: BuildPlayerEditorialInput): string {
  const labels: string[] = []
  const { sources, decision, hasGeoSampaData } = input

  if (sources.floodingMonitor.status === 'ok' || sources.floodingMonitor.status === 'stale') {
    labels.push('CGE-SP')
  }
  if (sources.officialAlerts.status === 'ok' || sources.officialAlerts.status === 'stale') {
    labels.push('INMET')
  }
  if (sources.forecast.status === 'ok' || sources.forecast.status === 'stale') {
    labels.push(decision.temporal.mode === 'historical' ? 'Open-Meteo Histórico' : 'Open-Meteo')
  }
  if (
    hasGeoSampaData ||
    sources.floodSusceptibility.status === 'ok' ||
    sources.floodSusceptibility.status === 'stale'
  ) {
    labels.push('GeoSampa')
  }

  return labels.length > 0 ? `Dados ${labels.join(' / ')}` : 'Dados OSM / Monitoramento OOH'
}

export function buildPlayerEditorial(input: BuildPlayerEditorialInput): PlayerEditorialContent {
  const { decision, corridorNameOverride } = input
  const corridorName = corridorNameOverride ?? decision.location.name
  const { telemetryModeLabel, telemetryStatusPill } = buildTelemetryLabels(decision)
  const sourcesLabel = buildSourcesLabel(input)

  const activeCount = decision.flooding.activeInZoneCount
  const impassableCount = decision.flooding.impassableInZoneCount
  const rainProb = decision.forecast
    ? Math.round(decision.forecast.maxRainProbabilityNext2hPercent)
    : null

  let headline: string
  let riskWindowLabel: string
  let statusNote: string

  switch (decision.severityLevel) {
    case 3:
      headline =
        impassableCount > 0 ? 'ALAGAMENTO INTRANSITÁVEL NA VIA' : 'ALERTA CRÍTICO DE ALAGAMENTO'
      riskWindowLabel =
        impassableCount > 0
          ? 'Via com bloqueio por alagamento'
          : 'Risco crítico nas próximas 2h'
      statusNote =
        activeCount > 0
          ? `${activeCount} ocorrência(s) ativa(s) na região. Evite trechos baixos e busque rotas alternativas.`
          : 'Chuva intensa com potencial imediato de alagamento. Evite deslocamentos em áreas críticas.'
      break

    case 2:
      headline = 'ALERTA DE CHUVA E ALAGAMENTO'
      riskWindowLabel =
        activeCount > 0 ? 'Alagamento ativo na região' : 'Risco elevado nas próximas 2h'
      statusNote =
        activeCount > 0
          ? `${activeCount} ponto(s) ativo(s) transitável(is) na região. Redobre a atenção no corredor.`
          : rainProb !== null
            ? `Chuva forte prevista (${rainProb}% nas próximas 2h). Atenção redobrada em pontos baixos.`
            : 'Aviso severo vigente na região. Redobre a atenção no trânsito.'
      break

    case 1:
      headline = 'ATENÇÃO PARA CHUVA FORTE'
      riskWindowLabel =
        rainProb !== null ? 'Risco moderado nas próximas 2h' : 'Aviso oficial em vigor'
      statusNote =
        rainProb !== null
          ? `Probabilidade de ${rainProb}% de chuva nas próximas 2h. Monitoramento contínuo do corredor.`
          : 'Condição de atenção meteorológica ativa para o corredor monitorado.'
      break

    case 0:
    default:
      headline = 'TRÂNSITO LIVRE • SEM ALAGAMENTOS'
      riskWindowLabel = 'Sem risco no momento'
      statusNote = 'Via sem risco no momento • Monitoramento ativo'
      break
  }

  return {
    headline,
    corridorName,
    riskWindowLabel,
    statusNote,
    sourcesLabel,
    telemetryModeLabel,
    telemetryStatusPill,
  }
}
