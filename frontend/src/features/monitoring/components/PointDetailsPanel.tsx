import { Code2, MapPin, Radio, ThermometerSun, Tv } from 'lucide-react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { SeverityBadge } from '@/components/patterns/SeverityBadge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClimateRiskTab } from '@/features/monitoring/components/ClimateRiskTab'
import { TechnicalInspectorTab } from '@/features/monitoring/components/TechnicalInspectorTab'
import { formatCoordinates, formatDateTimeBr } from '@/features/monitoring/utils/formatters'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import { cn } from '@/lib/utils'
import type { AlertTarget, OohAlertDecision, ScenarioQueryParams } from '@/types/alerts'

export type PointDetailsTabId = 'climate' | 'technical'

export interface PointDetailsPanelProps {
  target: AlertTarget | null
  decision: OohAlertDecision | null
  scenario: ScenarioQueryParams
  isLoading: boolean
  error: unknown
  onRetry?: () => void
  activeTab: PointDetailsTabId
  onTabChange: (tab: PointDetailsTabId) => void
}

export function PointDetailsPanel({
  target,
  decision,
  scenario,
  isLoading,
  error,
  onRetry,
  activeTab,
  onTabChange,
}: PointDetailsPanelProps) {
  if (isLoading) {
    return (
      <Card aria-label="Carregando detalhes do ponto">
        <CardHeader className="space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-32 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-5">
          <QueryErrorAlert
            error={error}
            title="Erro ao consultar o ponto selecionado"
            onRetry={onRetry}
          />
        </CardContent>
      </Card>
    )
  }

  if (!decision || !target) {
    return (
      <Card>
        <CardContent className="p-5">
          <EmptyState
            title="Nenhum ponto selecionado"
            description="Selecione uma das regiões no mapa ou clique em qualquer coordenada para visualizar clima, risco e feeds DOOH."
          />
        </CardContent>
      </Card>
    )
  }

  const severityMeta = getSeverityMeta(decision.severityLevel)
  const locationSubtitleParts = [
    decision.location.city && decision.location.state
      ? `${decision.location.city}/${decision.location.state}`
      : decision.location.city ?? decision.location.state,
    decision.location.zone,
    decision.location.ibgeCode ? `IBGE ${decision.location.ibgeCode}` : null,
  ].filter((part): part is string => Boolean(part))

  return (
    <Card>
      <CardHeader className="space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-1.5 text-base sm:text-lg">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>{decision.location.name}</span>
            </CardTitle>
            <CardDescription>
              {locationSubtitleParts.join(' • ') || 'Localidade consultada por coordenada'}
            </CardDescription>
          </div>
          <SeverityBadge level={decision.severityLevel} showApiCode />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-mono">
            {formatCoordinates(decision.location.latitude, decision.location.longitude)}
          </Badge>

          {decision.location.cgeStationId ? (
            <Badge variant="secondary">
              <Radio className="h-3 w-3" aria-hidden="true" />
              <span>
                Estação CGE: {decision.location.cgeStationName ?? decision.location.cgeStationId} (
                {decision.location.cgeStationId})
              </span>
            </Badge>
          ) : (
            <Badge variant="outline">Fora da cobertura CGE-SP</Badge>
          )}

          <Badge
            variant="outline"
            className="cursor-help font-semibold"
            title="Índice de risco de alagamento: 0–29 Normal • 30–59 Atenção • 60–84 Alerta • 85–100 Crítico"
          >
            Risco: {decision.riskScore} / 100
          </Badge>

          <Badge
            className={cn(
              'font-semibold',
              decision.triggerOverride
                ? 'border-severity-critical-border bg-severity-critical-bg text-severity-critical-fg'
                : 'border-transparent bg-secondary text-secondary-foreground',
            )}
          >
            <Tv className="h-3 w-3" aria-hidden="true" />
            <span>{decision.triggerOverride ? 'Gatilho OOH: ATIVO' : 'Campanha Padrão'}</span>
          </Badge>

          {decision.simulated ? <Badge variant="outline">Simulado</Badge> : null}
        </div>

        <div className={cn('rounded-lg border p-3 text-xs', severityMeta.surfaceClassName)}>
          <p className="font-bold tracking-tight">{decision.display.headline}</p>
          <p className="mt-1 leading-relaxed">{decision.display.message}</p>
          <p className="mt-1.5 text-[11px] opacity-80">
            {decision.display.subtext} • Avaliado em {formatDateTimeBr(decision.evaluatedAt)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-4 sm:pt-5">
        <Tabs
          value={activeTab}
          onValueChange={(nextValue) => onTabChange(nextValue as PointDetailsTabId)}
        >
          <TabsList aria-label="Abas de detalhes do ponto">
            <TabsTrigger value="climate">
              <ThermometerSun className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clima &amp; Risco</span>
            </TabsTrigger>
            <TabsTrigger value="technical">
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Técnico (JSON / XML)</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="climate">
            <ClimateRiskTab decision={decision} />
          </TabsContent>

          <TabsContent value="technical">
            <TechnicalInspectorTab decision={decision} target={target} scenario={scenario} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
