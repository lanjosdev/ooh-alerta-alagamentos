import L from 'leaflet'
import { Crosshair, MapPin, Navigation } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { SeverityBadge } from '@/components/patterns/SeverityBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCoordinates, formatPercent } from '@/features/monitoring/utils/formatters'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import { cn } from '@/lib/utils'
import type { AlertTarget, OohAlertDecision, SeverityLevel } from '@/types/alerts'

const SAO_PAULO_CENTER: [number, number] = [-23.5505, -46.6333]
const DEFAULT_MAP_ZOOM = 11
const LEGEND_LEVELS: readonly SeverityLevel[] = [0, 1, 2, 3]

export interface SpMonitoringMapProps {
  regions: OohAlertDecision[]
  selectedTarget: AlertTarget | null
  customDecision: OohAlertDecision | null
  onSelectRegion: (regionId: string) => void
  onSelectCoordinates: (coordinates: { lat: number; lon: number }) => void
  onClearCoordinates?: () => void
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildRegionMarkerIcon(decision: OohAlertDecision, isSelected: boolean): L.DivIcon {
  const meta = getSeverityMeta(decision.severityLevel)
  const selectedClass = isSelected ? 'ooh-map-marker--selected' : ''

  return L.divIcon({
    className: 'ooh-leaflet-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<div class="ooh-map-marker ${meta.markerClassName} ${selectedClass}">${decision.severityLevel}</div>`,
  })
}

function buildCustomPointMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: 'ooh-leaflet-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: '<div class="ooh-map-marker ooh-map-marker--custom ooh-map-marker--selected">★</div>',
  })
}

export function SpMonitoringMap({
  regions,
  selectedTarget,
  customDecision,
  onSelectRegion,
  onSelectCoordinates,
  onClearCoordinates,
}: SpMonitoringMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)

  const onSelectRegionRef = useRef(onSelectRegion)
  const onSelectCoordinatesRef = useRef(onSelectCoordinates)

  useEffect(() => {
    onSelectRegionRef.current = onSelectRegion
    onSelectCoordinatesRef.current = onSelectCoordinates
  }, [onSelectRegion, onSelectCoordinates])

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

    const handleMapClick = (event: L.LeafletMouseEvent) => {
      const lat = Number(event.latlng.lat.toFixed(6))
      const lon = Number(event.latlng.lng.toFixed(6))
      onSelectCoordinatesRef.current({ lat, lon })
    }

    map.on('click', handleMapClick)

    mapRef.current = map
    layerGroupRef.current = layerGroup

    return () => {
      map.off('click', handleMapClick)
      map.remove()
      mapRef.current = null
      layerGroupRef.current = null
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

      marker.on('click', (event: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(event)
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

      customMarker.addTo(layerGroup)
      map.panTo([selectedTarget.lat, selectedTarget.lon], { animate: true })
    }
  }, [regions, selectedTarget, customDecision])

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
              <Button type="button" size="sm" variant="outline" onClick={onClearCoordinates}>
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

          <div className="pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[11px] shadow-xs backdrop-blur-xs">
            {LEGEND_LEVELS.map((level) => {
              const meta = getSeverityMeta(level)
              return (
                <span key={level} className="inline-flex items-center gap-1 text-foreground">
                  <span
                    className={cn('h-2.5 w-2.5 rounded-full', meta.dotClassName)}
                    aria-hidden="true"
                  />
                  <span>{meta.label}</span>
                </span>
              )
            })}
            <span className="inline-flex items-center gap-1 text-foreground">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
              <span>Ponto consultado</span>
            </span>
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
                    onClick={() => onSelectRegion(region.location.id)}
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
