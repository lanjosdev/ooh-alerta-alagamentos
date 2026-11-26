import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ExplorerMapPanel,
  type ExplorerLayerMode,
} from '@/features/monitoring/components/ExplorerMapPanel'
import {
  PointInspectorStage,
  type PointStageTabId,
} from '@/features/monitoring/components/PointInspectorStage'
import { TopControlBar } from '@/features/monitoring/components/TopControlBar'
import { useApiHealth } from '@/features/monitoring/hooks/useApiHealth'
import { useCityOverview } from '@/features/monitoring/hooks/useCityOverview'
import { useSourcesStatus } from '@/features/monitoring/hooks/useSourcesStatus'
import {
  filterAssets,
  filterRegions,
  temporalSelectionToQuery,
  type SeverityFilter,
  type TemporalSelection,
  type ZoneFilter,
} from '@/features/monitoring/utils/scenarios'
import { usePlayerAssets } from '@/features/player/hooks/usePlayerAssets'
import { usePlayerScene } from '@/features/player/hooks/usePlayerScene'
import { DEFAULT_PLAYER_BRAND } from '@/features/player/utils/playerUrlState'
import type { AlertTarget, OohAlertDecision } from '@/types/alerts'
import type { PlayerBrandConfig, PlayerTarget } from '@/types/player'

export function MonitoringPage() {
  const [selection, setSelection] = useState<TemporalSelection>({ mode: 'realtime' })
  const [activeLayer, setActiveLayer] = useState<ExplorerLayerMode>('assets')
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('Todas')
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [selectedTarget, setSelectedTarget] = useState<PlayerTarget | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [activeStageTab, setActiveStageTab] = useState<PointStageTabId>('preview')
  const [brandConfig, setBrandConfig] = useState<PlayerBrandConfig>(DEFAULT_PLAYER_BRAND)

  const scenario = useMemo(() => temporalSelectionToQuery(selection), [selection])

  const healthQuery = useApiHealth()
  const sourcesStatusQuery = useSourcesStatus()
  const assetsQuery = usePlayerAssets(scenario)
  const overviewQuery = useCityOverview(scenario)

  const simulationEnabled = healthQuery.data?.capabilities.simulation ?? false

  const allAssets = useMemo(() => assetsQuery.data?.assets ?? [], [assetsQuery.data?.assets])
  const filteredAssets = useMemo(
    () => filterAssets(allAssets, zoneFilter, severityFilter),
    [allAssets, zoneFilter, severityFilter],
  )

  const allRegions = useMemo(() => overviewQuery.data?.regions ?? [], [overviewQuery.data?.regions])
  const filteredRegions = useMemo(
    () => filterRegions(allRegions, zoneFilter, severityFilter),
    [allRegions, zoneFilter, severityFilter],
  )

  const fallbackAsset = filteredAssets[0] ?? allAssets[0] ?? null

  const effectivePlayerTarget: PlayerTarget | null = useMemo(() => {
    if (selectedTarget !== null) {
      return selectedTarget
    }

    if (fallbackAsset) {
      return { kind: 'asset', assetId: fallbackAsset.id }
    }

    return null
  }, [fallbackAsset, selectedTarget])

  const sceneQuery = usePlayerScene(effectivePlayerTarget, scenario)

  const effectiveAlertTarget: AlertTarget | null = useMemo(() => {
    if (selectedRegionId && effectivePlayerTarget?.kind === 'coordinates') {
      return { kind: 'region', regionId: selectedRegionId }
    }

    if (sceneQuery.data) {
      return {
        kind: 'coordinates',
        lat: sceneQuery.data.decision.location.latitude,
        lon: sceneQuery.data.decision.location.longitude,
      }
    }

    if (effectivePlayerTarget?.kind === 'coordinates') {
      return {
        kind: 'coordinates',
        lat: effectivePlayerTarget.lat,
        lon: effectivePlayerTarget.lon,
      }
    }

    if (fallbackAsset) {
      return {
        kind: 'coordinates',
        lat: fallbackAsset.latitude,
        lon: fallbackAsset.longitude,
      }
    }

    return null
  }, [effectivePlayerTarget, fallbackAsset, sceneQuery.data, selectedRegionId])

  const handleSelectAsset = (assetId: string) => {
    setSelectedRegionId(null)
    setSelectedTarget({ kind: 'asset', assetId })
  }

  const handleSelectRegion = (region: OohAlertDecision) => {
    setSelectedRegionId(region.location.id)
    setSelectedTarget({
      kind: 'coordinates',
      lat: region.location.latitude,
      lon: region.location.longitude,
      label: region.location.name,
    })
  }

  const handleSelectCoordinates = (coords: { lat: number; lon: number; label?: string }) => {
    setSelectedRegionId(null)
    setSelectedTarget({
      kind: 'coordinates',
      lat: coords.lat,
      lon: coords.lon,
      label: coords.label,
    })
  }

  const handleRefresh = () => {
    void assetsQuery.refetch()
    void overviewQuery.refetch()
    void sourcesStatusQuery.refetch()
    if (effectivePlayerTarget) {
      void sceneQuery.refetch()
    }
  }

  const isRefreshing =
    assetsQuery.isFetching ||
    overviewQuery.isFetching ||
    sceneQuery.isFetching ||
    sourcesStatusQuery.isFetching

  const renderMainContent = () => {
    if (assetsQuery.isPending) {
      return (
        <div
          className="grid grid-cols-1 gap-5 lg:grid-cols-12"
          aria-label="Carregando mapa explorador e preview DOOH"
        >
          <Card className="lg:col-span-7 xl:col-span-8">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-[540px] w-full" />
            </CardContent>
          </Card>
          <Card className="lg:col-span-5 xl:col-span-4">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="aspect-[9/16] w-full" />
            </CardContent>
          </Card>
        </div>
      )
    }

    if (assetsQuery.isError) {
      return (
        <QueryErrorAlert
          error={assetsQuery.error}
          title="Não foi possível carregar os pontos OOH monitorados"
          onRetry={() => void assetsQuery.refetch()}
          secondaryActionLabel={selection.mode !== 'realtime' ? 'Voltar ao Tempo Real' : undefined}
          onSecondaryAction={
            selection.mode !== 'realtime' ? () => setSelection({ mode: 'realtime' }) : undefined
          }
        />
      )
    }

    if (!assetsQuery.data || allAssets.length === 0) {
      return (
        <EmptyState
          title="Nenhum ponto OOH disponível"
          description="Verifique se o catálogo inicial de ativos OOH está ativo no backend."
        />
      )
    }

    return (
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <ExplorerMapPanel
            activeLayer={activeLayer}
            onChangeLayer={setActiveLayer}
            assets={filteredAssets}
            totalAssetsCount={allAssets.length}
            regions={filteredRegions}
            totalRegionsCount={allRegions.length || 12}
            selectedTarget={effectivePlayerTarget}
            selectedRegionId={selectedRegionId}
            zoneFilter={zoneFilter}
            onChangeZoneFilter={setZoneFilter}
            severityFilter={severityFilter}
            onChangeSeverityFilter={setSeverityFilter}
            onSelectAsset={handleSelectAsset}
            onSelectRegion={handleSelectRegion}
            onSelectCoordinates={handleSelectCoordinates}
          />
        </div>

        <div className="lg:col-span-5 xl:col-span-4">
          <PointInspectorStage
            playerTarget={effectivePlayerTarget}
            alertTarget={effectiveAlertTarget}
            scenario={scenario}
            scene={sceneQuery.data ?? null}
            isSceneLoading={sceneQuery.isPending}
            isSceneUpdating={sceneQuery.isFetching && !sceneQuery.isPending}
            sceneError={sceneQuery.error}
            onRetryScene={() => void sceneQuery.refetch()}
            brandConfig={brandConfig}
            onChangeBrandConfig={setBrandConfig}
            activeTab={activeStageTab}
            onTabChange={setActiveStageTab}
          />
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1680px] space-y-4 p-3 sm:p-5">
        <TopControlBar
          selection={selection}
          onChangeSelection={setSelection}
          simulationEnabled={simulationEnabled}
          sourcesStatus={sourcesStatusQuery.data}
          isSourcesLoading={sourcesStatusQuery.isPending}
          isSourcesError={sourcesStatusQuery.isError}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {renderMainContent()}
      </div>
    </main>
  )
}
