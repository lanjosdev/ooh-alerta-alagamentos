import {
  AlertTriangle,
  ChevronDown,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Info,
  ShieldAlert,
  Sun,
  Thermometer,
  Waves,
} from 'lucide-react'
import { useId, useState } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resolveCurrentWeatherSummary } from '@/features/monitoring/utils/currentWeather'
import {
  formatCoordinates,
  formatDateTimeBr,
  formatHourBr,
  formatPercent,
  formatRainMm,
  formatRainRateMmPerHour,
  formatTemperatureC,
} from '@/features/monitoring/utils/formatters'
import { getSeverityMeta, severityRankToLevel } from '@/features/monitoring/utils/severity'
import {
  getWeatherCodeMetadata,
  type WeatherIconName,
} from '@/features/monitoring/utils/weatherCode'
import { cn } from '@/lib/utils'
import type { FloodingPoint, OohAlertDecision } from '@/types/alerts'

export interface ClimateRiskTabProps {
  decision: OohAlertDecision
}

function WeatherConditionIcon({
  icon,
  className = 'h-4 w-4',
}: {
  icon: WeatherIconName
  className?: string
}) {
  switch (icon) {
    case 'Sun':
      return <Sun className={className} aria-hidden="true" />
    case 'CloudSun':
      return <CloudSun className={className} aria-hidden="true" />
    case 'CloudFog':
      return <CloudFog className={className} aria-hidden="true" />
    case 'CloudDrizzle':
      return <CloudDrizzle className={className} aria-hidden="true" />
    case 'CloudRain':
      return <CloudRain className={className} aria-hidden="true" />
    case 'CloudSnow':
      return <CloudSnow className={className} aria-hidden="true" />
    case 'CloudLightning':
      return <CloudLightning className={className} aria-hidden="true" />
    case 'Cloud':
    default:
      return <Cloud className={className} aria-hidden="true" />
  }
}

function getFloodingPointBadge(point: FloodingPoint): { label: string; className: string } {
  if (point.active && !point.passable) {
    return {
      label: 'Ativo • Intransitável',
      className: getSeverityMeta(3).badgeClassName,
    }
  }

  if (point.active && point.passable) {
    return {
      label: 'Ativo • Transitável',
      className: getSeverityMeta(2).badgeClassName,
    }
  }

  return {
    label: point.passable ? 'Inativo • Transitável' : 'Inativo • Intransitável',
    className: 'bg-status-skipped-bg text-status-skipped-fg border-transparent',
  }
}

export function ClimateRiskTab({ decision }: ClimateRiskTabProps) {
  const [isFloodingOpen, setIsFloodingOpen] = useState(false)
  const [isOfficialAlertsOpen, setIsOfficialAlertsOpen] = useState(false)
  const floodingContentId = useId()
  const officialAlertsContentId = useId()

  const station = decision.flooding.stationRainfall
  const currentGrid = decision.forecast?.current ?? null
  const currentHour = decision.forecast?.hourly[0] ?? null
  const summary = resolveCurrentWeatherSummary(decision)
  const rainStatusBadgeClassName =
    summary.rainStatus === 'raining'
      ? 'bg-severity-alert-bg text-severity-alert-fg border-severity-alert-border'
      : summary.rainStatus === 'possible-drizzle'
        ? 'bg-severity-attention-bg text-severity-attention-fg border-severity-attention-border'
        : summary.rainStatus === 'dry'
          ? 'bg-status-ok-bg text-status-ok-fg border-transparent'
          : 'bg-status-skipped-bg text-status-skipped-fg border-transparent'
  const highestOfficialRank = decision.officialAlerts.reduce<1 | 2 | 3>(
    (highest, alert) => (alert.severityRank > highest ? alert.severityRank : highest),
    1,
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <Thermometer className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Clima Atual</span>
          </CardTitle>
          <CardDescription>
            {station
              ? `Leitura telemétrica da estação CGE ${station.stationName ?? station.stationId} (${station.stationId})`
              : 'Leitura meteorológica por grade geográfica'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {station ? (
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                <p className="text-[11px] text-muted-foreground">Temperatura</p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {formatTemperatureC(station.temperatureC)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                <p className="text-[11px] text-muted-foreground">Umidade relativa</p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {formatPercent(station.humidityPercent)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                <p className="text-[11px] text-muted-foreground">Chuva período atual</p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {formatRainMm(station.currentPeriodMm)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                <p className="text-[11px] text-muted-foreground">
                  Período anterior {station.resetTime ? `(reset ${station.resetTime})` : ''}
                </p>
                <p className="mt-0.5 text-base font-semibold text-foreground">
                  {formatRainMm(station.previousPeriodMm)}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Alert variant="info">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <AlertTitle className="text-xs">Modo multi-município ativo</AlertTitle>
                  <AlertDescription>
                    Fora da área de cobertura do CGE-SP — usando previsão por grade e avisos do INMET.
                  </AlertDescription>
                </div>
              </Alert>

              {currentGrid ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Temperatura</p>
                    <p className="mt-0.5 text-base font-semibold text-foreground">
                      {formatTemperatureC(summary.temperatureC)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                    <p className="text-[11px] text-muted-foreground">Umidade relativa</p>
                    <p className="mt-0.5 text-base font-semibold text-foreground">
                      {formatPercent(summary.humidityPercent)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-border bg-muted/40 p-2.5 sm:col-span-1">
                    <p className="text-[11px] text-muted-foreground">Chuva atual</p>
                    <p className="mt-0.5 text-base font-semibold text-foreground">
                      {formatRainMm(summary.currentRainMm)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {summary.sourceKind !== 'unavailable' ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                <Badge className={rainStatusBadgeClassName}>{summary.rainStatusLabel}</Badge>
                <div className="flex items-center gap-1.5">
                  <WeatherConditionIcon icon={summary.icon} className="h-4 w-4 text-primary" />
                  <span>
                    Condição estimada na grade
                    {summary.observedAt ? ` (${formatHourBr(summary.observedAt)})` : ''}:
                  </span>
                  <span>{summary.conditionLabel}</span>
                </div>
              </div>
              <span className="text-muted-foreground">
                {summary.confirmedByCgeDelta
                  ? `Confirmado na estação CGE-SP (+${formatRainMm(summary.cgeRecentDeltaMm)} / 15 min)`
                  : currentGrid
                    ? station
                      ? `Estimado na grade (Open-Meteo) • ${formatRainMm(summary.currentRainMm)}`
                      : currentHour
                        ? `Estimado na grade (Open-Meteo) • Chance na hora: ${formatPercent(currentHour.precipitationProbabilityPercent)}`
                        : 'Estimado na grade (Open-Meteo)'
                    : currentHour
                      ? `Estimado na grade (Open-Meteo) • ${formatPercent(currentHour.precipitationProbabilityPercent)} • ${formatRainMm(currentHour.precipitationMm)}`
                      : 'Estimado na grade (Open-Meteo)'}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <CloudRain className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Previsão de Chuva (2h e 6h)</span>
          </CardTitle>
          {decision.forecast ? (
            <CardDescription>
              Provedor: {decision.forecast.provider} • Grade:{' '}
              {formatCoordinates(decision.forecast.gridLatitude, decision.forecast.gridLongitude)}
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {decision.forecast === null ? (
            <EmptyState
              title="Previsão horária indisponível"
              description="O provedor de previsão não retornou dados para esta consulta."
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Máx. chance (2h)</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {formatPercent(decision.forecast.maxRainProbabilityNext2hPercent)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Volume: {formatRainMm(decision.forecast.expectedRainNext2hMm)} • Pico:{' '}
                    {formatRainRateMmPerHour(decision.forecast.peakRainIntensityNext2hMmPerHour)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                  <p className="text-[11px] text-muted-foreground">Máx. chance (6h)</p>
                  <p className="mt-0.5 text-base font-semibold text-foreground">
                    {formatPercent(decision.forecast.maxRainProbabilityNext6hPercent)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Acumulado esperado: {formatRainMm(decision.forecast.expectedRainNext6hMm)}
                  </p>
                </div>
              </div>

              {decision.forecast.hourly.length === 0 ? (
                <EmptyState
                  title="Sem pontos horários na janela"
                  description="A resposta não trouxe série horária detalhada para as próximas horas."
                />
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Linha do tempo horária
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {decision.forecast.hourly.map((hourPoint) => {
                      const weather = getWeatherCodeMetadata(hourPoint.weatherCode)
                      return (
                        <div
                          key={hourPoint.time}
                          className="flex min-w-[92px] shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-2 text-center"
                        >
                          <span className="text-xs font-semibold text-foreground">
                            {formatHourBr(hourPoint.time)}
                          </span>
                          <WeatherConditionIcon
                            icon={weather.icon}
                            className="h-4 w-4 text-primary"
                          />
                          <span className="line-clamp-1 text-[10px] text-muted-foreground">
                            {weather.label}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {formatPercent(hourPoint.precipitationProbabilityPercent)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatRainMm(hourPoint.precipitationMm)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className={cn('p-0 sm:p-0', isFloodingOpen ? 'pb-3 sm:pb-3' : undefined)}>
          <button
            type="button"
            aria-expanded={isFloodingOpen}
            aria-controls={floodingContentId}
            onClick={() => setIsFloodingOpen((open) => !open)}
            className="flex w-full flex-col gap-2 rounded-xl p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5"
          >
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-1.5">
                <Waves className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Alagamentos na Zona (CGE-SP)</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                {decision.flooding.cgeDate ? (
                  <Badge variant="outline">Data CGE: {decision.flooding.cgeDate}</Badge>
                ) : null}
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-muted-foreground transition-transform duration-150',
                    isFloodingOpen ? 'rotate-180' : undefined,
                  )}
                  aria-hidden="true"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">Ativos: {decision.flooding.activeInZoneCount}</Badge>
              <Badge className={getSeverityMeta(3).badgeClassName}>
                Intransitáveis: {decision.flooding.impassableInZoneCount}
              </Badge>
              <Badge className={getSeverityMeta(2).badgeClassName}>
                Transitáveis: {decision.flooding.passableInZoneCount}
              </Badge>
            </div>
          </button>
        </CardHeader>
        {isFloodingOpen ? (
          <CardContent id={floodingContentId}>
            {decision.sources.floodingMonitor.status === 'skipped' ? (
              <EmptyState
                icon={<Droplets className="h-4 w-4" aria-hidden="true" />}
                title="Sem cobertura CGE-SP para esta coordenada"
                description="O monitoramento de vias alagadas do CGE-SP aplica-se apenas à Capital de São Paulo."
              />
            ) : decision.flooding.pointsInZone.length === 0 ? (
              <EmptyState
                icon={<Droplets className="h-4 w-4" aria-hidden="true" />}
                title="Nenhum alagamento registrado na zona"
                description="Não há ocorrências ativas ou no histórico consultado para esta zona."
              />
            ) : (
              <ul className="space-y-2">
                {decision.flooding.pointsInZone.map((point, index) => {
                  const statusBadge = getFloodingPointBadge(point)
                  return (
                    <li
                      key={`${point.street}-${point.timeWindow ?? 'na'}-${index}`}
                      className="space-y-1 rounded-lg border border-border bg-muted/30 p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{point.street}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {point.neighborhood} • {point.zone}
                          </p>
                        </div>
                        <Badge className={statusBadge.className}>{statusBadge.label}</Badge>
                      </div>
                      {point.reference ? (
                        <p className="text-[11px] text-muted-foreground">
                          Referência: {point.reference}
                        </p>
                      ) : null}
                      {(point.direction || point.timeWindow) ? (
                        <p className="text-[11px] text-muted-foreground">
                          {point.direction ? `Sentido: ${point.direction}` : ''}
                          {point.direction && point.timeWindow ? ' • ' : ''}
                          {point.timeWindow ? `Horário: ${point.timeWindow}` : ''}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className={cn('p-0 sm:p-0', isOfficialAlertsOpen ? 'pb-3 sm:pb-3' : undefined)}>
          <button
            type="button"
            aria-expanded={isOfficialAlertsOpen}
            aria-controls={officialAlertsContentId}
            onClick={() => setIsOfficialAlertsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-2 rounded-xl p-4 text-left transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-5"
          >
            <CardTitle className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Avisos Oficiais (INMET)</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              {decision.officialAlerts.length === 0 ? (
                <Badge variant="secondary">0 vigentes</Badge>
              ) : (
                <Badge className={getSeverityMeta(severityRankToLevel(highestOfficialRank)).badgeClassName}>
                  {decision.officialAlerts.length}{' '}
                  {decision.officialAlerts.length === 1 ? 'vigente' : 'vigentes'}
                </Badge>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-150',
                  isOfficialAlertsOpen ? 'rotate-180' : undefined,
                )}
                aria-hidden="true"
              />
            </div>
          </button>
        </CardHeader>
        {isOfficialAlertsOpen ? (
          <CardContent id={officialAlertsContentId}>
            {decision.officialAlerts.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                title="Sem avisos oficiais INMET vigentes"
                description="Nenhum alerta meteorológico oficial intercepta este local no momento."
              />
            ) : (
              <div className="space-y-3">
                {decision.officialAlerts.map((officialAlert) => {
                  const alertSeverity = getSeverityMeta(
                    severityRankToLevel(officialAlert.severityRank),
                  )
                  return (
                    <div
                      key={officialAlert.id}
                      className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{officialAlert.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Vigência: {formatDateTimeBr(officialAlert.startsAt)} até{' '}
                            {formatDateTimeBr(officialAlert.endsAt)}
                          </p>
                        </div>
                        <Badge className={alertSeverity.badgeClassName}>
                          {officialAlert.severity}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline">Código: {officialAlert.code}</Badge>
                        {officialAlert.matchedBy.map((matchType) => (
                          <Badge key={matchType} variant="secondary">
                            Match: {matchType === 'ibge' ? 'Código IBGE' : 'Polígono GeoJSON'}
                          </Badge>
                        ))}
                      </div>

                      {officialAlert.risks.length > 0 ? (
                        <div>
                          <p className="font-medium text-foreground">Riscos previstos:</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                            {officialAlert.risks.map((risk) => (
                              <li key={risk}>{risk}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {officialAlert.instructions.length > 0 ? (
                        <div>
                          <p className="font-medium text-foreground">Instruções:</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                            {officialAlert.instructions.map((instruction) => (
                              <li key={instruction}>{instruction}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
