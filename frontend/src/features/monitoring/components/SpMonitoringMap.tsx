import L from 'leaflet'
import { Crosshair, MapPin, Navigation } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { SeverityBadge } from '@/components/patterns/SeverityBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCoordinates, formatPercent } from '@/features/monitoring/utils/formatters'
import {
  buildDecisionPopupHtml,
  buildErrorPopupHtml,
  buildLoadingPopupHtml,
  escapeHtml,
} from '@/features/monitoring/utils/mapPopupContent'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { AlertTarget, OohAlertDecision, SeverityLevel } from '@/types/alerts'

const SAO_PAULO_CENTER: [number, number] = [-23.5505, -46.6333]
const DEFAULT_MAP_ZOOM = 11
const LEGEND_LEVELS: readonly SeverityLevel[] = [0, 1, 2, 3]

interface LegendItem {
  id: string
  label: string
  dotClassName: string
  description: string
}

const LEGEND_ITEMS: readonly LegendItem[] = [
  ...LEGEND_LEVELS.map((level) => {
    const meta = getSeverityMeta(level)
    return {
      id: `severity-${level}`,
      label: meta.label,
      dotClassName: meta.dotClassName,
      description: meta.description,
    }
  }),
  {
    id: 'custom-point',
    label: 'Ponto consultado',
    dotClassName: 'bg-primary',
    description:
      'Coordenada clicada livremente no mapa (CGE-SP na Capital ou Open-Meteo + INMET fora de SP).',
  },
]

export interface SpMonitoringMapProps {
  regions: OohAlertDecision[]
  selectedTarget: AlertTarget | null
  customDecision: OohAlertDecision | null
  isCustomLoading?: boolean
  customError?: unknown
  onSelectRegion: (regionId: string) => void
  onSelectCoordinates: (coordinates: { lat: number; lon: number }) => void
  onClearCoordinates?: () => void
  onFocusDetails?: () => void
}

function buildRegionMarkerIcon(decision: OohAlertDecision, isSelected: boolean): L.DivIcon {
  const meta = getSeverityMeta(decision.severityLevel)
  const selectedClass = isSelected ? 'ooh-map-marker--selected' : ''

  return L.divIcon({
    className: 'ooh-leaflet-icon',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div class="ooh-map-marker ${meta.markerClassName} ${selectedClass}"></div>`,
  })
}

function buildCustomPointMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'ooh-leaflet-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: '<div class="ooh-map-marker ooh-map-marker--custom ooh-map-marker--selected"></div>',
  })
}

function focusMapOnRegion(map: L.Map, lat: number, lon: number) {
  if (map.getZoom() < DEFAULT_MAP_ZOOM) {
    map.setView([lat, lon], DEFAULT_MAP_ZOOM, { animate: true })
    return
  }

  map.panTo([lat, lon], { animate: true })
}

function serializeTargetKey(target: AlertTarget | null): string | null {
  if (!target) {
    return null
  }

  if (target.kind === 'region') {
    return `region:${target.regionId}`
  }

  return `coordinates:${target.lat}:${target.lon}`
}

export function SpMonitoringMap({
  regions,
  selectedTarget,
  customDecision,
  isCustomLoading = false,
  customError = null,
  onSelectRegion,
  onSelectCoordinates,
  onClearCoordinates,
  onFocusDetails,
}: SpMonitoringMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const popupRef = useRef<L.Popup | null>(null)
  const openPopupTargetKeyRef = useRef<string | null>(null)
  const isSyncingPopupRef = useRef(false)
  const regionsRef = useRef<OohAlertDecision[]>(regions)
  const lastFocusedTargetKeyRef = useRef<string | null>(null)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [activeLegendId, setActiveLegendId] = useState<string | null>(null)
  const legendTooltipId = useId()
  const activeLegendItem = LEGEND_ITEMS.find((item) => item.id === activeLegendId) ?? null

  const onSelectRegionRef = useRef(onSelectRegion)
  const onSelectCoordinatesRef = useRef(onSelectCoordinates)
  const onFocusDetailsRef = useRef(onFocusDetails)

  useEffect(() => {
    regionsRef.current = regions
    onSelectRegionRef.current = onSelectRegion
    onSelectCoordinatesRef.current = onSelectCoordinates
    onFocusDetailsRef.current = onFocusDetails
  }, [regions, onSelectRegion, onSelectCoordinates, onFocusDetails])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const map = L.map(container, {
      center: SAO_PAULO_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    const popup = L.popup({
      className: 'ooh-map-popup',
      maxWidth: 280,
      minWidth: 248,
      offset: [0, -10],
      autoPan: true,
      autoPanPaddingTopLeft: L.point(16, 56),
      autoPanPaddingBottomRight: L.point(16, 68),
      closeButton: true,
      closeOnClick: false,
    })

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      const lat = Number(event.latlng.lat.toFixed(6))
      const lon = Number(event.latlng.lng.toFixed(6))
      setIsPopupOpen(true)
      onSelectCoordinatesRef.current({ lat, lon })
    }

    const handlePopupClose = (event: L.PopupEvent) => {
      if (isSyncingPopupRef.current) {
        return
      }
      if (!event.popup || event.popup === popup) {
        openPopupTargetKeyRef.current = null
        setIsPopupOpen(false)
      }
    }

    const handleContainerClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }
      const actionElement = target.closest('[data-ooh-action="focus-details"]')
      if (!actionElement) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onFocusDetailsRef.current?.()
    }

    map.on('click', handleMapClick)
    map.on('popupclose', handlePopupClose)
    container.addEventListener('click', handleContainerClick, true)

    mapRef.current = map
    layerGroupRef.current = layerGroup
    popupRef.current = popup

    return () => {
      container.removeEventListener('click', handleContainerClick, true)
      map.off('click', handleMapClick)
      map.off('popupclose', handlePopupClose)
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
      popupRef.current = null
      openPopupTargetKeyRef.current = null
    }
  }, [])

  useEffect(() => {
    const layerGroup = layerGroupRef.current
    const map = mapRef.current
    if (!layerGroup || !map) {
      return
    }

    layerGroup.clearLayers()

    regions.forEach((region) => {
      const isSelected =
        selectedTarget?.kind === 'region' && selectedTarget.regionId === region.location.id
      const meta = getSeverityMeta(region.severityLevel)
      const rain2h = region.forecast
        ? formatPercent(region.forecast.maxRainProbabilityNext2hPercent)
        : '—'

      const marker = L.marker([region.location.latitude, region.location.longitude], {
        icon: buildRegionMarkerIcon(region, isSelected),
        title: region.location.name,
      })

      if (!(isPopupOpen && isSelected)) {
        marker.bindTooltip(
          `<div class="space-y-0.5">
            <div class="font-semibold">${escapeHtml(region.location.name)}</div>
            <div>${escapeHtml(meta.label)} • Chuva 2h: ${escapeHtml(rain2h)}</div>
          </div>`,
          {
            direction: 'top',
            offset: [0, -10],
            className: 'ooh-map-tooltip',
          },
        )
      }

      marker.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        lastFocusedTargetKeyRef.current = serializeTargetKey({
          kind: 'region',
          regionId: region.location.id,
        })
        setIsPopupOpen(true)
        focusMapOnRegion(map, region.location.latitude, region.location.longitude)
        onSelectRegionRef.current(region.location.id)
      })

      marker.addTo(layerGroup)
    })

    if (selectedTarget?.kind === 'coordinates') {
      const customMarker = L.marker([selectedTarget.lat, selectedTarget.lon], {
        icon: buildCustomPointMarkerIcon(),
        title: 'Ponto avulso consultado',
      })

      const customLabel = customDecision
        ? `${customDecision.location.name} (${getSeverityMeta(customDecision.severityLevel).label})`
        : formatCoordinates(selectedTarget.lat, selectedTarget.lon)

      if (!isPopupOpen) {
        customMarker.bindTooltip(
          `<div class="space-y-0.5">
            <div class="font-semibold">Ponto avulso consultado</div>
            <div>${escapeHtml(customLabel)}</div>
          </div>`,
          {
            direction: 'top',
            offset: [0, -12],
            className: 'ooh-map-tooltip',
          },
        )
      }

      customMarker.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
        setIsPopupOpen(true)
      })

      customMarker.addTo(layerGroup)
    }
  }, [regions, selectedTarget, customDecision, isPopupOpen])

  const targetKey = serializeTargetKey(selectedTarget)

  useEffect(() => {
    const map = mapRef.current
    const popup = popupRef.current
    if (!map || !popup) {
      return
    }

    const closePopupSafely = () => {
      if (popup.isOpen()) {
        isSyncingPopupRef.current = true
        try {
          popup.close()
        } finally {
          isSyncingPopupRef.current = false
        }
      }
      openPopupTargetKeyRef.current = null
    }

    if (!isPopupOpen || !selectedTarget || !targetKey) {
      closePopupSafely()
      return
    }

    let latLng: [number, number]
    let html: string

    if (selectedTarget.kind === 'region') {
      const region = regions.find((item) => item.location.id === selectedTarget.regionId)
      if (!region) {
        closePopupSafely()
        return
      }

      latLng = [region.location.latitude, region.location.longitude]
      html = buildDecisionPopupHtml(region)
    } else {
      latLng = [selectedTarget.lat, selectedTarget.lon]
      if (isCustomLoading) {
        html = buildLoadingPopupHtml(selectedTarget.lat, selectedTarget.lon)
      } else if (customError) {
        html = buildErrorPopupHtml(getApiErrorMessage(customError))
      } else if (customDecision) {
        html = buildDecisionPopupHtml(customDecision)
      } else {
        html = buildLoadingPopupHtml(selectedTarget.lat, selectedTarget.lon)
      }
    }

    if (openPopupTargetKeyRef.current === targetKey && popup.isOpen()) {
      popup.setContent(html)
      return
    }

    openPopupTargetKeyRef.current = targetKey
    isSyncingPopupRef.current = true
    try {
      popup.setLatLng(latLng).setContent(html).openOn(map)
    } finally {
      isSyncingPopupRef.current = false
    }
  }, [isPopupOpen, targetKey, selectedTarget, regions, customDecision, isCustomLoading, customError])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedTarget || !targetKey) {
      return
    }

    if (lastFocusedTargetKeyRef.current === null) {
      lastFocusedTargetKeyRef.current = targetKey
      return
    }

    if (lastFocusedTargetKeyRef.current === targetKey) {
      return
    }

    lastFocusedTargetKeyRef.current = targetKey

    if (selectedTarget.kind === 'coordinates') {
      map.panTo([selectedTarget.lat, selectedTarget.lon], { animate: true })
      return
    }

    const targetRegion = regionsRef.current.find(
      (region) => region.location.id === selectedTarget.regionId,
    )
    if (targetRegion) {
      focusMapOnRegion(map, targetRegion.location.latitude, targetRegion.location.longitude)
    }
  }, [targetKey, selectedTarget])

  const handleSelectRegionFromList = (region: OohAlertDecision) => {
    lastFocusedTargetKeyRef.current = serializeTargetKey({
      kind: 'region',
      regionId: region.location.id,
    })
    setIsPopupOpen(true)
    if (mapRef.current) {
      focusMapOnRegion(mapRef.current, region.location.latitude, region.location.longitude)
    }
    onSelectRegion(region.location.id)
  }

  const handleClearCustomCoordinates = () => {
    if (popupRef.current?.isOpen()) {
      isSyncingPopupRef.current = true
      try {
        popupRef.current.close()
      } finally {
        isSyncingPopupRef.current = false
      }
    }
    openPopupTargetKeyRef.current = null
    setIsPopupOpen(false)
    onClearCoordinates?.()
  }

  const handleRecenterMap = () => {
    mapRef.current?.setView(SAO_PAULO_CENTER, DEFAULT_MAP_ZOOM, { animate: true })
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-1.5 text-base">
              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Mapa Interativo de Monitoramento</span>
            </CardTitle>
            <CardDescription>
              Clique em um marcador das 12 regiões de São Paulo ou em qualquer ponto do mapa (ex.: Vila
              Leopoldina, Morumbi ou Campinas) para consulta hiperlocal via coordenadas.
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            {regions.length} {regions.length === 1 ? 'região exibida' : 'regiões exibidas'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4 sm:p-5">
        {selectedTarget?.kind === 'coordinates' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/70 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <Crosshair className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span>
                Consultando ponto avulso:{' '}
                <strong className="font-mono">
                  {formatCoordinates(selectedTarget.lat, selectedTarget.lon)}
                </strong>
              </span>
            </div>
            {onClearCoordinates ? (
              <Button type="button" size="sm" variant="outline" onClick={handleClearCustomCoordinates}>
                Voltar às regiões
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="relative overflow-hidden rounded-lg border border-border">
          <div
            ref={containerRef}
            data-testid="sp-monitoring-map-canvas"
            className="h-[360px] w-full bg-muted sm:h-[430px]"
          />

          <div className="pointer-events-none absolute top-3 right-3 z-10 flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleRecenterMap}
              className="pointer-events-auto shadow-sm"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Centralizar em SP</span>
            </Button>
          </div>

          <div
            className="pointer-events-auto absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)]"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onMouseLeave={() => setActiveLegendId(null)}
          >
            {activeLegendItem ? (
              <div
                id={legendTooltipId}
                role="tooltip"
                className="mb-2 w-72 max-w-full rounded-md border border-border bg-popover p-2.5 text-[11px] text-popover-foreground shadow-md"
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span
                    className={cn('h-2.5 w-2.5 shrink-0 rounded-full', activeLegendItem.dotClassName)}
                    aria-hidden="true"
                  />
                  <span>{activeLegendItem.label}</span>
                </div>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {activeLegendItem.description}
                </p>
              </div>
            ) : null}

            <div
              role="group"
              aria-label="Legenda de severidade do mapa"
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[11px] shadow-xs backdrop-blur-xs"
            >
              {LEGEND_ITEMS.map((item) => {
                const isActive = activeLegendId === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-describedby={isActive ? legendTooltipId : undefined}
                    onMouseEnter={() => setActiveLegendId(item.id)}
                    onMouseLeave={() =>
                      setActiveLegendId((current) => (current === item.id ? null : current))
                    }
                    onFocus={() => setActiveLegendId(item.id)}
                    onBlur={() =>
                      setActiveLegendId((current) => (current === item.id ? null : current))
                    }
                    onClick={() =>
                      setActiveLegendId((current) => (current === item.id ? null : item.id))
                    }
                    className="inline-flex cursor-help items-center gap-1 rounded px-0.5 text-foreground decoration-dotted underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span
                      className={cn('h-2.5 w-2.5 rounded-full', item.dotClassName)}
                      aria-hidden="true"
                    />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Acesso rápido às regiões monitoradas
            </h4>
            <span className="text-xs text-muted-foreground">
              Ordenadas por severidade e score de risco
            </span>
          </div>

          {regions.length === 0 ? (
            <EmptyState
              title="Nenhuma região corresponde aos filtros aplicados"
              description="Ajuste os filtros de Zona ou Severidade na barra superior para visualizar as regiões no mapa."
            />
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {regions.map((region) => {
                const isSelected =
                  selectedTarget?.kind === 'region' &&
                  selectedTarget.regionId === region.location.id
                const rain2h = region.forecast
                  ? formatPercent(region.forecast.maxRainProbabilityNext2hPercent)
                  : '—'

                return (
                  <button
                    key={region.location.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectRegionFromList(region)}
                    className={cn(
                      'flex flex-col items-start gap-1.5 rounded-lg border p-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      isSelected
                        ? 'border-ring bg-accent'
                        : 'border-border bg-card hover:bg-accent/60',
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-foreground">
                        {region.location.name}
                      </span>
                      <SeverityBadge level={region.severityLevel} showIcon={false} />
                    </div>
                    <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
                      <span>{region.location.zone ?? 'Capital SP'}</span>
                      <span>Chuva 2h: {rain2h}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
