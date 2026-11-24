import { resolveCurrentWeatherSummary } from '@/features/monitoring/utils/currentWeather'
import {
  formatCoordinates,
  formatPercent,
  formatRainMm,
  formatTemperatureC,
} from '@/features/monitoring/utils/formatters'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import type { OohAlertDecision } from '@/types/alerts'

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildFloodingSummaryText(decision: OohAlertDecision): string {
  if (decision.sources.floodingMonitor.status === 'skipped') {
    return 'Fora da cobertura CGE-SP'
  }

  const { activeInZoneCount, impassableInZoneCount } = decision.flooding
  if (activeInZoneCount <= 0) {
    return 'Sem alagamentos ativos'
  }

  const activeLabel = `${activeInZoneCount} ${activeInZoneCount === 1 ? 'ativo' : 'ativos'}`
  if (impassableInZoneCount > 0) {
    const impassableLabel = `${impassableInZoneCount} ${impassableInZoneCount === 1 ? 'intransitável' : 'intransitáveis'}`
    return `${activeLabel} (${impassableLabel})`
  }

  return activeLabel
}

function buildOfficialAlertsSummaryText(decision: OohAlertDecision): string {
  const count = decision.officialAlerts.length
  if (count === 0) {
    return 'Sem avisos vigentes'
  }

  const highestAlert = decision.officialAlerts.reduce((highest, current) =>
    current.severityRank > highest.severityRank ? current : highest,
  )

  return `${count} ${count === 1 ? 'aviso vigente' : 'avisos vigentes'} (${highestAlert.severity})`
}

function buildForecastSummaryText(decision: OohAlertDecision): string {
  if (!decision.forecast) {
    return 'Indisponível'
  }

  const max2h = decision.forecast.maxRainProbabilityNext2hPercent
  const expected2h = decision.forecast.expectedRainNext2hMm
  const max6h = decision.forecast.maxRainProbabilityNext6hPercent

  let text = `${formatPercent(max2h)} • ${formatRainMm(expected2h)}`
  if (max6h > max2h) {
    text += ` • 6h: ${formatPercent(max6h)}`
  }

  return text
}

function buildClimateNowSummary(decision: OohAlertDecision): {
  text: string
  sourceLabel: string
} {
  const summary = resolveCurrentWeatherSummary(decision)
  const parts = [
    summary.rainStatusLabel,
    summary.conditionLabel,
    formatTemperatureC(summary.temperatureC),
  ]

  if (summary.cgeAccumulatedMm !== null && summary.cgeAccumulatedMm > 0) {
    parts.push(`Acum. CGE: ${formatRainMm(summary.cgeAccumulatedMm)}`)
  }

  return {
    text: parts.join(' • '),
    sourceLabel: summary.sourceLabel,
  }
}

export function buildDecisionPopupHtml(decision: OohAlertDecision): string {
  const severityMeta = getSeverityMeta(decision.severityLevel)
  const zoneText = decision.location.zone
    ? `<span class="ooh-popup-zone">${escapeHtml(decision.location.zone)}</span>`
    : ''
  const triggerClass = decision.triggerOverride
    ? 'ooh-popup-trigger ooh-popup-trigger--active'
    : 'ooh-popup-trigger ooh-popup-trigger--normal'
  const triggerLabel = decision.triggerOverride
    ? 'Gatilho OOH: ATIVO'
    : 'Campanha Padrão'

  const climateNow = buildClimateNowSummary(decision)
  const forecastText = buildForecastSummaryText(decision)
  const floodingText = buildFloodingSummaryText(decision)
  const officialAlertsText = buildOfficialAlertsSummaryText(decision)

  return `<div class="ooh-popup-card">
  <div class="ooh-popup-header">
    <div class="ooh-popup-title-group">
      <div class="ooh-popup-title">${escapeHtml(decision.location.name)}</div>
      ${zoneText}
    </div>
    <div class="ooh-popup-status-group">
      <span class="ooh-popup-severity-badge ooh-popup-severity-badge--${decision.severityLevel}">${escapeHtml(severityMeta.label)}</span>
      <span class="ooh-popup-risk">Risco: ${String(Math.round(decision.riskScore))}/100</span>
    </div>
  </div>
  <div class="${triggerClass}">${escapeHtml(triggerLabel)}</div>
  <dl class="ooh-popup-rows">
    <div class="ooh-popup-row">
      <dt>Clima agora:</dt>
      <dd>${escapeHtml(climateNow.text)}<span class="ooh-popup-source">${escapeHtml(climateNow.sourceLabel)}</span></dd>
    </div>
    <div class="ooh-popup-row">
      <dt>Previsão (2h):</dt>
      <dd>${escapeHtml(forecastText)}</dd>
    </div>
    <div class="ooh-popup-row">
      <dt>Alagamentos (CGE-SP):</dt>
      <dd>${escapeHtml(floodingText)}</dd>
    </div>
    <div class="ooh-popup-row">
      <dt>Avisos (INMET):</dt>
      <dd>${escapeHtml(officialAlertsText)}</dd>
    </div>
  </dl>
  <button type="button" class="ooh-popup-action" data-ooh-action="focus-details">
    Ver detalhes completos
  </button>
</div>`
}

export function buildLoadingPopupHtml(lat: number, lon: number): string {
  return `<div class="ooh-popup-card ooh-popup-card--compact">
  <div class="ooh-popup-title">Consultando coordenada...</div>
  <div class="ooh-popup-coords">${escapeHtml(formatCoordinates(lat, lon))}</div>
</div>`
}

export function buildErrorPopupHtml(errorMessage: string): string {
  return `<div class="ooh-popup-card ooh-popup-card--compact">
  <div class="ooh-popup-error-title">Falha na consulta</div>
  <div class="ooh-popup-error-text">${escapeHtml(errorMessage)}</div>
</div>`
}
