import { Activity, Filter, FlaskConical, Radio, RefreshCw, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useSourcesStatus } from '@/features/monitoring/hooks/useSourcesStatus'
import { formatDateTimeBr, formatLatencyMs } from '@/features/monitoring/utils/formatters'
import {
  getScenarioPreset,
  SCENARIO_PRESETS,
  ZONE_FILTER_OPTIONS,
  type ScenarioPresetId,
  type SeverityFilter,
  type ZoneFilter,
} from '@/features/monitoring/utils/scenarios'
import { getProviderStatusMeta, getSeverityMeta } from '@/features/monitoring/utils/severity'
import { cn } from '@/lib/utils'
import type { CityOverviewData, SeverityLevel } from '@/types/alerts'

export interface ScenarioToolbarProps {
  presetId: ScenarioPresetId
  onSelectPreset: (presetId: ScenarioPresetId) => void
  zoneFilter: ZoneFilter
  onChangeZoneFilter: (zone: ZoneFilter) => void
  severityFilter: SeverityFilter
  onChangeSeverityFilter: (filter: SeverityFilter) => void
  summary: CityOverviewData['summary'] | null
  generatedAt: string | null
  isRefreshing: boolean
  onRefresh: () => void
}

const SUMMARY_LEVELS: readonly SeverityLevel[] = [3, 2, 1, 0]

const PROVIDER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'open-meteo': 'Open-Meteo',
  inmet: 'INMET',
  'cge-sp': 'CGE-SP',
}

function SourcesHealthStrip() {
  const { data, isLoading, isError } = useSourcesStatus()

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5" aria-label="Carregando saúde das fontes">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Activity className="h-3 w-3" aria-hidden="true" />
        <span>Telemetria das fontes indisponível</span>
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Saúde das fontes externas">
      {data.providers.map((provider) => {
        const meta = getProviderStatusMeta(provider.status)
        const displayName = PROVIDER_DISPLAY_NAMES[provider.provider] ?? provider.provider
        return (
          <Badge
            key={provider.provider}
            className={cn(meta.badgeClassName, 'gap-1.5')}
            title={`Chaves em cache: ${provider.cachedKeys} | Latência: ${formatLatencyMs(provider.lastLatencyMs)}`}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClassName)} aria-hidden="true" />
            <span>{displayName}</span>
            <span className="opacity-75">• {meta.label}</span>
          </Badge>
        )
      })}
    </div>
  )
}

export function ScenarioToolbar({
  presetId,
  onSelectPreset,
  zoneFilter,
  onChangeZoneFilter,
  severityFilter,
  onChangeSeverityFilter,
  summary,
  generatedAt,
  isRefreshing,
  onRefresh,
}: ScenarioToolbarProps) {
  const activePreset = getScenarioPreset(presetId)

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Radio className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  OOH Alerta Alagamentos
                </h1>
                <p className="text-xs text-muted-foreground">
                  Central de monitoramento meteorológico/hidrológico e distribuição DOOH (JSON / XML RSS 2.0)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SourcesHealthStrip />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isRefreshing ? 'animate-spin' : undefined)}
                aria-hidden="true"
              />
              <span>{isRefreshing ? 'Atualizando...' : 'Atualizar agora'}</span>
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {summary ? (
              <>
                {SUMMARY_LEVELS.map((level) => {
                  const meta = getSeverityMeta(level)
                  const count = summary.countsBySeverity[meta.apiLabel]
                  return (
                    <Badge key={level} className={meta.badgeClassName}>
                      <span
                        className={cn('h-2 w-2 rounded-full', meta.dotClassName)}
                        aria-hidden="true"
                      />
                      <span>
                        {meta.label}: {count}
                      </span>
                    </Badge>
                  )
                })}
                <Badge variant="outline" className="font-semibold">
                  Gatilho OOH ativo: {summary.overrideActiveCount}/{summary.totalRegions}
                </Badge>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Última leitura:{' '}
            <span className="font-medium text-foreground">{formatDateTimeBr(generatedAt)}</span>
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Cenários de demonstração">
            <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cenário:</span>
            </span>
            {SCENARIO_PRESETS.map((preset) => {
              const isActive = preset.id === presetId
              return (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'outline'}
                  aria-pressed={isActive}
                  onClick={() => onSelectPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Zona:</span>
              <select
                aria-label="Filtrar por zona"
                value={zoneFilter}
                onChange={(event) => onChangeZoneFilter(event.target.value as ZoneFilter)}
                className="h-8 rounded-md border border-input bg-card px-2.5 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {ZONE_FILTER_OPTIONS.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>

            <div className="inline-flex items-center rounded-md border border-border bg-muted p-0.5">
              <Button
                type="button"
                size="sm"
                variant={severityFilter === 'all' ? 'secondary' : 'ghost'}
                aria-pressed={severityFilter === 'all'}
                onClick={() => onChangeSeverityFilter('all')}
                className="h-7 px-2.5 text-xs"
              >
                Todas
              </Button>
              <Button
                type="button"
                size="sm"
                variant={severityFilter === 'alerts_only' ? 'secondary' : 'ghost'}
                aria-pressed={severityFilter === 'alerts_only'}
                onClick={() => onChangeSeverityFilter('alerts_only')}
                className="h-7 px-2.5 text-xs"
              >
                Em Alerta (≥ 1)
              </Button>
            </div>
          </div>
        </div>

        {activePreset.isSimulation ? (
          <Alert variant="info" className="items-center justify-between py-2.5">
            <div className="flex items-start gap-2.5">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <AlertTitle className="text-xs">
                  Modo de demonstração ativo: {activePreset.label}
                </AlertTitle>
                <AlertDescription>{activePreset.description}</AlertDescription>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onSelectPreset('realtime')}
              className="shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Voltar ao Tempo Real</span>
            </Button>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
