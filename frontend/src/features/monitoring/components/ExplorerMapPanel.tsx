import { LocateFixed, MapPin, Search, X } from 'lucide-react'
import { Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import {
  ZONE_FILTER_OPTIONS,
  type SeverityFilter,
  type ZoneFilter,
} from '@/features/monitoring/utils/scenarios'
import { useAddressSearch } from '@/features/player/hooks/useAddressSearch'
import { EXPLORER_MAP_STYLE_URL } from '@/features/player/styles/mapStyles'
import { cn } from '@/lib/utils'
import type { OohAlertDecision } from '@/types/alerts'
import type { GeocodingCandidate, PlayerAssetSummary, PlayerTarget } from '@/types/player'

const SP_CENTER: [number, number] = [-46.6333, -23.5505]
const SP_DEFAULT_ZOOM = 11.2

export type ExplorerLayerMode = 'assets' | 'regions'

export interface ExplorerMapPanelProps {
  activeLayer: ExplorerLayerMode
  onChangeLayer: (layer: ExplorerLayerMode) => void
  assets: PlayerAssetSummary[]
  totalAssetsCount: number
  regions: OohAlertDecision[]
  totalRegionsCount: number
  selectedTarget: PlayerTarget | null
  selectedRegionId: string | null
  zoneFilter: ZoneFilter
  onChangeZoneFilter: (zone: ZoneFilter) => void
  severityFilter: SeverityFilter
  onChangeSeverityFilter: (severity: SeverityFilter) => void
  onSelectAsset: (assetId: string) => void
  onSelectRegion: (region: OohAlertDecision) => void
  onSelectCoordinates: (coords: { lat: number; lon: number; label?: string }) => void
}

interface MarkerElements {
  root: HTMLButtonElement
  dot: HTMLSpanElement
}

interface MarkerTooltipInfo {
  title: string
  subtitle: string
  severityLabel?: string
  severityLevel?: 0 | 1 | 2 | 3
}

interface BuildMarkerOptions {
  label: string
  pillLabel: string
  severityClassName: string
  isSelected: boolean
  isCustom?: boolean
  onHoverStart?: () => void
  onHoverEnd?: () => void
  onClick?: () => void
}

function buildHoverTooltipContent(info: MarkerTooltipInfo): HTMLDivElement {
  const container = document.createElement('div')
  container.className = 'ooh-map-tooltip'

  const header = document.createElement('div')
  header.className = 'ooh-map-tooltip__header'

  const title = document.createElement('span')
  title.className = 'ooh-map-tooltip__title'
  title.textContent = info.title
  header.appendChild(title)

  if (info.severityLabel !== undefined && info.severityLevel !== undefined) {
    const severity = document.createElement('span')
    severity.className = `ooh-map-tooltip__severity ooh-map-tooltip__severity--${info.severityLevel}`
    severity.textContent = info.severityLabel
    header.appendChild(severity)
  }

  const meta = document.createElement('span')
  meta.className = 'ooh-map-tooltip__meta'
  meta.textContent = info.subtitle

  container.appendChild(header)
  container.appendChild(meta)
  return container
}

function buildMarkerElement({
  label,
  pillLabel,
  severityClassName,
  isSelected,
  isCustom = false,
  onHoverStart,
  onHoverEnd,
  onClick,
}: BuildMarkerOptions): MarkerElements {
  const root = document.createElement('button')
  root.type = 'button'
  root.className = cn(
    'ooh-map-marker-root',
    isSelected ? 'ooh-map-marker-root--selected' : undefined,
    isCustom ? 'ooh-map-marker-root--custom' : undefined,
  )
  root.setAttribute('aria-label', label)
  if (isCustom) {
    root.tabIndex = -1
  }
  if (onHoverStart) {
    root.addEventListener('mouseenter', onHoverStart)
  }
  if (onHoverEnd) {
    root.addEventListener('mouseleave', onHoverEnd)
  }
  if (onClick) {
    root.addEventListener('click', (event) => {
      event.stopPropagation()
      onHoverEnd?.()
      onClick()
    })
  }

  const dot = document.createElement('span')
  dot.setAttribute('aria-hidden', 'true')
  dot.className = cn(
    'ooh-map-marker',
    severityClassName,
    isSelected ? 'ooh-map-marker--selected' : undefined,
  )
  root.appendChild(dot)

  const pill = document.createElement('span')
  pill.setAttribute('aria-hidden', 'true')
  pill.className = 'ooh-map-marker__pill'
  pill.textContent = pillLabel
  root.appendChild(pill)

  return { root, dot }
}

export function ExplorerMapPanel({
  activeLayer,
  onChangeLayer,
  assets,
  totalAssetsCount,
  regions,
  totalRegionsCount,
  selectedTarget,
  selectedRegionId,
  zoneFilter,
  onChangeZoneFilter,
  severityFilter,
  onChangeSeverityFilter,
  onSelectAsset,
  onSelectRegion,
  onSelectCoordinates,
}: ExplorerMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const hoverPopupRef = useRef<Popup | null>(null)
  const baseMarkersRef = useRef<
    Map<string, { marker: Marker; root: HTMLButtonElement; dot: HTMLSpanElement }>
  >(new Map())
  const customMarkerRef = useRef<Marker | null>(null)
  const onSelectCoordinatesRef = useRef(onSelectCoordinates)
  const onSelectAssetRef = useRef(onSelectAsset)
  const onSelectRegionRef = useRef(onSelectRegion)

  const [queryInput, setQueryInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const searchQuery = useAddressSearch(submittedQuery)

  useEffect(() => {
    onSelectCoordinatesRef.current = onSelectCoordinates
    onSelectAssetRef.current = onSelectAsset
    onSelectRegionRef.current = onSelectRegion
  }, [onSelectCoordinates, onSelectAsset, onSelectRegion])

  useEffect(() => {
    const container = mapContainerRef.current
    if (!container) {
      return
    }

    const baseMarkers = baseMarkersRef.current
    const map = new MapLibreMap({
      container,
      style: EXPLORER_MAP_STYLE_URL,
      center: SP_CENTER,
      zoom: SP_DEFAULT_ZOOM,
      attributionControl: false,
    })

    const hoverPopup = new Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14,
      className: 'ooh-map-hover-popup',
    })
    hoverPopupRef.current = hoverPopup

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')

    map.on('dragstart', () => {
      hoverPopup.remove()
    })

    map.on('click', (event) => {
      hoverPopup.remove()
      onSelectCoordinatesRef.current({
        lat: Number(event.lngLat.lat.toFixed(6)),
        lon: Number(event.lngLat.lng.toFixed(6)),
      })
    })

    mapRef.current = map

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      hoverPopup.remove()
      hoverPopupRef.current = null
      for (const entry of baseMarkers.values()) {
        entry.marker.remove()
      }
      baseMarkers.clear()
      customMarkerRef.current?.remove()
      customMarkerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    hoverPopupRef.current?.remove()
    for (const entry of baseMarkersRef.current.values()) {
      entry.marker.remove()
    }
    baseMarkersRef.current.clear()

    const showHoverTooltip = (lngLat: [number, number], info: MarkerTooltipInfo) => {
      const popup = hoverPopupRef.current
      if (!popup) {
        return
      }
      popup
        .setLngLat(lngLat)
        .setDOMContent(buildHoverTooltipContent(info))
        .addTo(map)
    }

    const hideHoverTooltip = () => {
      hoverPopupRef.current?.remove()
    }

    if (activeLayer === 'assets') {
      for (const asset of assets) {
        const meta = getSeverityMeta(asset.severityLevel)
        const floodSuffix =
          asset.activeInZoneCount > 0 ? ` • ${asset.activeInZoneCount} alag.` : ''
        const { root, dot } = buildMarkerElement({
          label: `${asset.corridorName} (${meta.label})`,
          pillLabel: asset.corridorName,
          severityClassName: meta.markerClassName,
          isSelected: false,
          onHoverStart: () =>
            showHoverTooltip([asset.longitude, asset.latitude], {
              title: asset.corridorName,
              severityLabel: meta.label,
              severityLevel: asset.severityLevel,
              subtitle: `${asset.neighborhood} • ${Math.round(asset.riskScore)}/100${floodSuffix}`,
            }),
          onHoverEnd: hideHoverTooltip,
          onClick: () => onSelectAssetRef.current(asset.id),
        })
        const marker = new Marker({ element: root, anchor: 'center' })
          .setLngLat([asset.longitude, asset.latitude])
          .addTo(map)
        baseMarkersRef.current.set(asset.id, { marker, root, dot })
      }
    } else {
      for (const region of regions) {
        const meta = getSeverityMeta(region.severityLevel)
        const floodSuffix =
          region.flooding.activeInZoneCount > 0
            ? ` • ${region.flooding.activeInZoneCount} alag.`
            : ''
        const { root, dot } = buildMarkerElement({
          label: `${region.location.name} (${meta.label})`,
          pillLabel: region.location.name,
          severityClassName: meta.markerClassName,
          isSelected: false,
          onHoverStart: () =>
            showHoverTooltip([region.location.longitude, region.location.latitude], {
              title: region.location.name,
              severityLabel: meta.label,
              severityLevel: region.severityLevel,
              subtitle: `${region.location.zone ?? 'São Paulo'} • ${Math.round(region.riskScore)}/100${floodSuffix}`,
            }),
          onHoverEnd: hideHoverTooltip,
          onClick: () => onSelectRegionRef.current(region),
        })
        const marker = new Marker({ element: root, anchor: 'center' })
          .setLngLat([region.location.longitude, region.location.latitude])
          .addTo(map)
        baseMarkersRef.current.set(region.location.id, { marker, root, dot })
      }
    }
  }, [activeLayer, assets, regions])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const selectedBaseId =
      activeLayer === 'assets'
        ? selectedTarget?.kind === 'asset'
          ? selectedTarget.assetId
          : null
        : selectedRegionId

    for (const [id, entry] of baseMarkersRef.current.entries()) {
      const isSelected = selectedBaseId === id
      entry.root.classList.toggle('ooh-map-marker-root--selected', isSelected)
      entry.dot.classList.toggle('ooh-map-marker--selected', isSelected)
    }

    customMarkerRef.current?.remove()
    customMarkerRef.current = null

    const shouldShowCustomMarker =
      selectedTarget?.kind === 'coordinates' &&
      !(activeLayer === 'regions' && selectedRegionId !== null)

    if (shouldShowCustomMarker && selectedTarget.kind === 'coordinates') {
      const targetLat = selectedTarget.lat
      const targetLon = selectedTarget.lon
      const customLabel =
        selectedTarget.label ??
        `Ponto selecionado (${targetLat.toFixed(4)}, ${targetLon.toFixed(4)})`
      const { root } = buildMarkerElement({
        label: customLabel,
        pillLabel: selectedTarget.label ?? 'Clique livre',
        severityClassName: 'ooh-map-marker--custom',
        isSelected: true,
        isCustom: true,
        onHoverStart: () => {
          const popup = hoverPopupRef.current
          if (!popup) {
            return
          }
          popup
            .setLngLat([targetLon, targetLat])
            .setDOMContent(
              buildHoverTooltipContent({
                title: selectedTarget.label ?? 'Ponto livre',
                subtitle: `${targetLat.toFixed(4)}, ${targetLon.toFixed(4)}`,
              }),
            )
            .addTo(map)
        },
        onHoverEnd: () => {
          hoverPopupRef.current?.remove()
        },
      })
      customMarkerRef.current = new Marker({ element: root, anchor: 'center' })
        .setLngLat([targetLon, targetLat])
        .addTo(map)
    }
  }, [activeLayer, assets, regions, selectedRegionId, selectedTarget])

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = queryInput.trim()
    if (trimmed.length < 3) {
      setValidationError('Digite pelo menos 3 caracteres para buscar um endereço em SP.')
      setSubmittedQuery(null)
      return
    }

    setValidationError(null)
    setSubmittedQuery(trimmed)
  }

  const handlePickCandidate = (candidate: GeocodingCandidate) => {
    setSubmittedQuery(null)
    setValidationError(null)
    setQueryInput(candidate.primaryName)
    onSelectCoordinates({
      lat: candidate.latitude,
      lon: candidate.longitude,
      label: candidate.primaryName,
    })
    mapRef.current?.flyTo({
      center: [candidate.longitude, candidate.latitude],
      zoom: 15,
      duration: 600,
    })
  }

  const handleRecenter = () => {
    mapRef.current?.flyTo({
      center: SP_CENTER,
      zoom: SP_DEFAULT_ZOOM,
      duration: 500,
    })
  }

  return (
    <Card className="overflow-visible">
      <CardHeader className="rounded-t-xl border-b border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  aria-label="Buscar endereço ou avenida em SP"
                  placeholder="Buscar avenida ou endereço em SP (Enter)..."
                  value={queryInput}
                  onChange={(event) => {
                    setQueryInput(event.target.value)
                    if (validationError) {
                      setValidationError(null)
                    }
                  }}
                  className="h-8 w-full rounded-md border border-input bg-background pr-7 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
                {queryInput.length > 0 ? (
                  <button
                    type="button"
                    aria-label="Limpar busca"
                    onClick={() => {
                      setQueryInput('')
                      setSubmittedQuery(null)
                      setValidationError(null)
                    }}
                    className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <Button type="submit" size="sm" variant="secondary" className="h-8 px-3 text-xs">
                Buscar
              </Button>
            </form>

            {validationError ? (
              <p className="mt-1 text-[11px] text-status-error-fg">{validationError}</p>
            ) : null}

            {submittedQuery !== null ? (
              <div
                role="region"
                aria-label="Resultados da busca de endereço"
                className="absolute right-0 left-0 z-30 mt-1.5 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
              >
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Resultados para &ldquo;{submittedQuery}&rdquo;
                  </span>
                  <button
                    type="button"
                    onClick={() => setSubmittedQuery(null)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Fechar
                  </button>
                </div>

                {searchQuery.isPending ? (
                  <div className="space-y-1.5 p-1" aria-label="Buscando endereços">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : searchQuery.isError ? (
                  <QueryErrorAlert
                    error={searchQuery.error}
                    title="Falha ao consultar geocodificação"
                    onRetry={() => void searchQuery.refetch()}
                  />
                ) : !searchQuery.data || searchQuery.data.candidates.length === 0 ? (
                  <EmptyState
                    title="Nenhum endereço encontrado em SP"
                    description="Tente incluir o nome da avenida, bairro ou número."
                  />
                ) : (
                  <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {searchQuery.data.candidates.map((candidate) => (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          onClick={() => handlePickCandidate(candidate)}
                          className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <MapPin
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                              {candidate.primaryName}
                            </p>
                            <p className="line-clamp-1 text-[11px] text-muted-foreground">
                              {candidate.displayName}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por zona"
              value={zoneFilter}
              onChange={(event) => onChangeZoneFilter(event.target.value as ZoneFilter)}
              className="h-8 rounded-md border border-input bg-card px-2.5 text-xs font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {ZONE_FILTER_OPTIONS.map((zone) => (
                <option key={zone} value={zone}>
                  Zona: {zone}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              variant={severityFilter === 'alerts_only' ? 'default' : 'outline'}
              onClick={() =>
                onChangeSeverityFilter(severityFilter === 'alerts_only' ? 'all' : 'alerts_only')
              }
              className="h-8 text-xs"
            >
              Em Alerta
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative overflow-hidden rounded-b-xl p-0">
        <div
          ref={mapContainerRef}
          data-testid="explorer-map-canvas"
          className="h-[520px] w-full bg-muted/40 lg:h-[620px]"
        />

        <div
          role="group"
          aria-label="Alternar camada do mapa"
          className="absolute top-3 left-3 z-10 inline-flex items-center rounded-lg border border-border bg-card/95 p-0.5 shadow-sm backdrop-blur-xs"
        >
          <button
            type="button"
            aria-pressed={activeLayer === 'assets'}
            onClick={() => onChangeLayer('assets')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              activeLayer === 'assets'
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent',
            )}
          >
            Pontos OOH ({totalAssetsCount})
          </button>
          <button
            type="button"
            aria-pressed={activeLayer === 'regions'}
            onClick={() => onChangeLayer('regions')}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              activeLayer === 'regions'
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent',
            )}
          >
            Regiões SP ({totalRegionsCount})
          </button>
        </div>

        <div className="absolute top-3 right-13 z-10">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRecenter}
            className="h-8 gap-1.5 bg-card/95 text-xs shadow-sm backdrop-blur-xs"
          >
            <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Centralizar SP</span>
          </Button>
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 z-10 hidden items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1 text-[10px] text-muted-foreground shadow-xs backdrop-blur-xs sm:inline-flex">
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            Clique livre
          </Badge>
          <span>Clique em qualquer via de SP para gerar cena via Overpass</span>
        </div>

        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded bg-card/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-xs">
          © OpenStreetMap • OpenFreeMap
        </div>
      </CardContent>
    </Card>
  )
}
