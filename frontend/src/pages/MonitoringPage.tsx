import { useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PointDetailsPanel,
  type PointDetailsTabId,
} from '@/features/monitoring/components/PointDetailsPanel'
import { ScenarioToolbar } from '@/features/monitoring/components/ScenarioToolbar'
import { SpMonitoringMap } from '@/features/monitoring/components/SpMonitoringMap'
import { useCityOverview } from '@/features/monitoring/hooks/useCityOverview'
import { useCoordinatesAlert } from '@/features/monitoring/hooks/useCoordinatesAlert'
import {
  filterRegions,
  getScenarioPreset,
  type ScenarioPresetId,
  type SeverityFilter,
  type ZoneFilter,
} from '@/features/monitoring/utils/scenarios'
import type { AlertTarget } from '@/types/alerts'

export function MonitoringPage() {
  const detailsRef = useRef<HTMLDivElement | null>(null)
  const [presetId, setPresetId] = useState<ScenarioPresetId>('realtime')
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('Todas')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [selectedTarget, setSelectedTarget] = useState<AlertTarget | null>(null)
  const [activeDetailsTab, setActiveDetailsTab] = useState<PointDetailsTabId>('climate')

  const scenario = getScenarioPreset(presetId).query
  const overviewQuery = useCityOverview(scenario)

  const coordinatesInput =
    selectedTarget?.kind === 'coordinates'
      ? { lat: selectedTarget.lat, lon: selectedTarget.lon }
      : null

  const coordinatesQuery = useCoordinatesAlert(coordinatesInput, scenario)

  const allRegions = useMemo(() => overviewQuery.data?.regions ?? [], [overviewQuery.data?.regions])
  const filteredRegions = useMemo(
    () => filterRegions(allRegions, zoneFilter, severityFilter),
    [allRegions, zoneFilter, severityFilter],
  )

  const fallbackRegion = filteredRegions[0] ?? allRegions[0] ?? null
  const resolvedRegion =
    selectedTarget?.kind === 'region'
      ? (allRegions.find((region) => region.location.id === selectedTarget.regionId) ??
        fallbackRegion)
      : fallbackRegion

  const effectiveTarget: AlertTarget | null =
    selectedTarget?.kind === 'coordinates'
      ? selectedTarget
      : resolvedRegion
        ? { kind: 'region', regionId: resolvedRegion.location.id }
        : null

  const activeDecision =
    effectiveTarget?.kind === 'coordinates' ? (coordinatesQuery.data ?? null) : resolvedRegion

  const isDetailsLoading =
    effectiveTarget?.kind === 'coordinates' ? coordinatesQuery.isPending : false
  const detailsError =
    effectiveTarget?.kind === 'coordinates' ? coordinatesQuery.error : null

  const handleRefresh = () => {
    void overviewQuery.refetch()
    if (effectiveTarget?.kind === 'coordinates') {
      void coordinatesQuery.refetch()
    }
  }

  const isRefreshing =
    overviewQuery.isFetching ||
    (effectiveTarget?.kind === 'coordinates' && coordinatesQuery.isFetching)

  const renderMainContent = () => {
    if (overviewQuery.isPending) {
      return (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12" aria-label="Carregando mapa e painel">
          <Card className="lg:col-span-7">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-6 w-64" />
              <Skeleton className="h-[420px] w-full" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-5">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-44 w-full" />
            </CardContent>
          </Card>
        </div>
      )
    }

    if (overviewQuery.isError) {
      return (
        <QueryErrorAlert
          error={overviewQuery.error}
          title="Não foi possível carregar o panorama das regiões monitoradas"
          onRetry={() => void overviewQuery.refetch()}
          secondaryActionLabel={presetId !== 'realtime' ? 'Voltar ao Tempo Real' : undefined}
          onSecondaryAction={
            presetId !== 'realtime' ? () => setPresetId('realtime') : undefined
          }
        />
      )
    }

    if (!overviewQuery.data || overviewQuery.data.regions.length === 0) {
      return (
        <EmptyState
          title="Nenhuma região monitorada retornada pela API"
          description="Verifique se o catálogo inicial de regiões está ativo no backend."
        />
      )
    }

    return (
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <SpMonitoringMap
            regions={filteredRegions}
            selectedTarget={effectiveTarget}
            customDecision={
              effectiveTarget?.kind === 'coordinates' ? (coordinatesQuery.data ?? null) : null
            }
            isCustomLoading={
              effectiveTarget?.kind === 'coordinates' && coordinatesQuery.isPending
            }
            customError={
              effectiveTarget?.kind === 'coordinates' ? coordinatesQuery.error : null
            }
            onSelectRegion={(regionId) => setSelectedTarget({ kind: 'region', regionId })}
            onSelectCoordinates={(coords) =>
              setSelectedTarget({ kind: 'coordinates', lat: coords.lat, lon: coords.lon })
            }
            onClearCoordinates={() =>
              setSelectedTarget(
                fallbackRegion
                  ? { kind: 'region', regionId: fallbackRegion.location.id }
                  : null,
              )
            }
            onFocusDetails={() =>
              detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />
        </div>

        <div ref={detailsRef} className="lg:col-span-5">
          <PointDetailsPanel
            target={effectiveTarget}
            decision={activeDecision}
            scenario={scenario}
            isLoading={isDetailsLoading}
            error={detailsError}
            onRetry={
              effectiveTarget?.kind === 'coordinates'
                ? () => void coordinatesQuery.refetch()
                : () => void overviewQuery.refetch()
            }
            activeTab={activeDetailsTab}
            onTabChange={setActiveDetailsTab}
          />
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-6">
        <ScenarioToolbar
          presetId={presetId}
          onSelectPreset={setPresetId}
          zoneFilter={zoneFilter}
          onChangeZoneFilter={setZoneFilter}
          severityFilter={severityFilter}
          onChangeSeverityFilter={setSeverityFilter}
          summary={overviewQuery.data?.summary ?? null}
          generatedAt={overviewQuery.data?.generatedAt ?? null}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {renderMainContent()}
      </div>
    </main>
  )
}
