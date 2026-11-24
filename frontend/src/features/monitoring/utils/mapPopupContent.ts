import { resolveCurrentWeatherSummary } from '@/features/monitoring/utils/currentWeather'
import {
  formatCoordinates,
  formatHourBr,
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

type MetricTone = 'critical' | 'alert' | 'attention' | 'muted'

function buildSubtitleHtml(decision: OohAlertDecision): string {
  const coordsText = formatCoordinates(decision.location.latitude, decision.location.longitude)
  const coordsHtml = `<span class="ooh-popup-coords-inline">${escapeHtml(coordsText)}</span>`

  if (decision.location.zone) {
    return `<div class="ooh-popup-subtitle">${escapeHtml(decision.location.zone)} • ${coordsHtml}</div>`
  }

  if (decision.location.name.includes(coordsText)) {
    return '<div class="ooh-popup-subtitle">Fora da Capital SP</div>'
  }

  return `<div class="ooh-popup-subtitle">${coordsHtml}</div>`
}

function buildOohStatusHtml(triggerOverride: boolean): string {
  if (triggerOverride) {
    return `<div class="ooh-popup-ooh-row">
      <span class="ooh-popup-trigger ooh-popup-trigger--active">
        <span class="ooh-popup-dot ooh-popup-dot--active" aria-hidden="true"></span>Alerta no OOH: Ativo
      </span>
    </div>`
  }

  return `<div class="ooh-popup-ooh-row">
    <span class="ooh-popup-trigger ooh-popup-trigger--normal">
      <span class="ooh-popup-dot ooh-popup-dot--normal" aria-hidden="true"></span>Alerta no OOH: Inativo
    </span>
    <span class="ooh-popup-ooh-note">Campanha normal</span>
  </div>`
}

function buildWeatherHeroHtml(decision: OohAlertDecision): string {
  const summary = resolveCurrentWeatherSummary(decision)
  const temperatureText = formatTemperatureC(summary.temperatureC)
  const rainMetaText =
    summary.cgeAccumulatedMm !== null && summary.cgeAccumulatedMm > 0
      ? `Acum. CGE: ${formatRainMm(summary.cgeAccumulatedMm)}`
      : summary.cgeAccumulatedMm === null &&
          summary.currentRainMm !== null &&
          summary.currentRainMm > 0
        ? `Chuva atual: ${formatRainMm(summary.currentRainMm)}`
        : ''

  const observedTimeText = summary.observedAt ? formatHourBr(summary.observedAt) : ''
  const sourceFooter = observedTimeText
    ? `${summary.sourceLabel} • ${observedTimeText}`
    : summary.sourceLabel

  return `<div class="ooh-popup-weather-hero">
    <div class="ooh-popup-weather-main">
      <div class="ooh-popup-temp-block">
        <div class="ooh-popup-temp">${escapeHtml(temperatureText)}</div>
        <div class="ooh-popup-condition">${escapeHtml(summary.conditionLabel)}</div>
      </div>
      <div class="ooh-popup-rain-block">
        <span class="ooh-popup-rain-pill ooh-popup-rain-pill--${summary.rainStatus}">${escapeHtml(summary.rainStatusLabel)}</span>
        ${rainMetaText ? `<span class="ooh-popup-rain-meta">${escapeHtml(rainMetaText)}</span>` : ''}
      </div>
    </div>
    <div class="ooh-popup-weather-source">${escapeHtml(sourceFooter)}</div>
  </div>`
}

function buildForecastBlockHtml(decision: OohAlertDecision): string {
  if (!decision.forecast) {
    return `<div class="ooh-popup-forecast">
      <div class="ooh-popup-section-label">Previsão de chuva</div>
      <div class="ooh-popup-forecast-main ooh-popup-metric-value--muted">Previsão indisponível</div>
    </div>`
  }

  const max2h = decision.forecast.maxRainProbabilityNext2hPercent
  const expected2h = decision.forecast.expectedRainNext2hMm
  const max6h = decision.forecast.maxRainProbabilityNext6hPercent

  const primaryLine =
    expected2h > 0
      ? `${formatPercent(max2h)} de chance nas próx. 2h (${formatRainMm(expected2h)})`
      : `${formatPercent(max2h)} de chance nas próx. 2h`

  const secondaryLine =
    max6h > max2h ? `Até ${formatPercent(max6h)} de chance nas próx. 6h` : ''

  return `<div class="ooh-popup-forecast">
    <div class="ooh-popup-section-label">Previsão de chuva</div>
    <div class="ooh-popup-forecast-main">${escapeHtml(primaryLine)}</div>
    ${secondaryLine ? `<div class="ooh-popup-forecast-sub">${escapeHtml(secondaryLine)}</div>` : ''}
  </div>`
}

function resolveFloodingMetric(decision: OohAlertDecision): { text: string; tone: MetricTone } {
  if (decision.sources.floodingMonitor.status === 'skipped') {
    return { text: 'Fora da cobertura CGE-SP', tone: 'muted' }
  }

  const { activeInZoneCount, impassableInZoneCount } = decision.flooding
  if (activeInZoneCount <= 0) {
    return { text: 'Sem alagamentos ativos', tone: 'muted' }
  }

  const activeLabel = `${activeInZoneCount} ${activeInZoneCount === 1 ? 'ativo' : 'ativos'}`
  if (impassableInZoneCount > 0) {
    const impassableLabel = `${impassableInZoneCount} ${impassableInZoneCount === 1 ? 'intransitável' : 'intransitáveis'}`
    return { text: `${activeLabel} (${impassableLabel})`, tone: 'critical' }
  }

  return { text: activeLabel, tone: 'alert' }
}

function resolveOfficialAlertsMetric(decision: OohAlertDecision): {
  text: string
  tone: MetricTone
} {
  const count = decision.officialAlerts.length
  if (count === 0) {
    return { text: 'Sem avisos vigentes', tone: 'muted' }
  }

  const highestAlert = decision.officialAlerts.reduce((highest, current) =>
    current.severityRank > highest.severityRank ? current : highest,
  )

  const tone: MetricTone =
    highestAlert.severityRank === 3
      ? 'critical'
      : highestAlert.severityRank === 2
        ? 'alert'
        : 'attention'

  const label = `${count} ${count === 1 ? 'vigente' : 'vigentes'} (${highestAlert.severity})`
  return { text: label, tone }
}

export function buildDecisionPopupHtml(decision: OohAlertDecision): string {
  const severityMeta = getSeverityMeta(decision.severityLevel)
  const riskScore = Math.round(decision.riskScore)
  const floodingMetric = resolveFloodingMetric(decision)
  const alertsMetric = resolveOfficialAlertsMetric(decision)

  return `<div class="ooh-popup-card ooh-popup-card--severity-${decision.severityLevel}">
  <div class="ooh-popup-header">
    <div class="ooh-popup-title-group">
      <div class="ooh-popup-title">${escapeHtml(decision.location.name)}</div>
      ${buildSubtitleHtml(decision)}
    </div>
    <div class="ooh-popup-badges">
      <span class="ooh-popup-severity-badge ooh-popup-severity-badge--${decision.severityLevel}">Risco: ${escapeHtml(severityMeta.label)} • ${String(riskScore)}/100</span>
      ${buildOohStatusHtml(decision.triggerOverride)}
    </div>
  </div>
  ${buildWeatherHeroHtml(decision)}
  ${buildForecastBlockHtml(decision)}
  <div class="ooh-popup-metrics-grid">
    <div class="ooh-popup-metric-cell">
      <div class="ooh-popup-section-label">Alagamentos (CGE)</div>
      <div class="ooh-popup-metric-value ooh-popup-metric-value--${floodingMetric.tone}">${escapeHtml(floodingMetric.text)}</div>
    </div>
    <div class="ooh-popup-metric-cell">
      <div class="ooh-popup-section-label">Avisos (INMET)</div>
      <div class="ooh-popup-metric-value ooh-popup-metric-value--${alertsMetric.tone}">${escapeHtml(alertsMetric.text)}</div>
    </div>
  </div>
  <button type="button" class="ooh-popup-action" data-ooh-action="focus-details">
    Ver detalhes completos →
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
