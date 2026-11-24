import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import {
  mockCampinasDecision,
  mockRegionButanta,
  mockRegionItaquera,
} from '@/test/fixtures/alerts'
import type { AlertTarget, OohAlertDecision } from '@/types/alerts'
import { SpMonitoringMap } from './SpMonitoringMap'

interface MockMarkerRecord {
  title?: string
  bindTooltip: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>
  on: ReturnType<typeof vi.fn<(eventName: string, handler: (event: unknown) => void) => unknown>>
  clickHandler?: (event: unknown) => void
}

const leafletMockState = vi.hoisted(() => ({
  panTo: vi.fn(),
  setView: vi.fn(),
  getZoom: vi.fn(() => 11),
  popupIsOpen: false,
  popupSetLatLng: vi.fn(),
  popupSetContent: vi.fn(),
  popupOpenOn: vi.fn(),
  popupClose: vi.fn(),
  mapClickHandler: null as ((event: { latlng: { lat: number; lng: number } }) => void) | null,
  popupCloseHandler: null as ((event: { popup: unknown }) => void) | null,
  markers: [] as MockMarkerRecord[],
}))

vi.mock('leaflet', () => {
  const mapInstance = {
    on: vi.fn((eventName: string, handler: (event: never) => void) => {
      if (eventName === 'click') {
        leafletMockState.mapClickHandler = handler as (event: {
          latlng: { lat: number; lng: number }
        }) => void
      }
      if (eventName === 'popupclose') {
        leafletMockState.popupCloseHandler = handler as (event: { popup: unknown }) => void
      }
      return mapInstance
    }),
    off: vi.fn(),
    remove: vi.fn(),
    setView: leafletMockState.setView,
    panTo: leafletMockState.panTo,
    getZoom: leafletMockState.getZoom,
  }

  const layerGroupInstance = {
    clearLayers: vi.fn(() => {
      leafletMockState.markers = []
    }),
    addTo: vi.fn(() => layerGroupInstance),
  }

  const popupInstance = {
    setLatLng: vi.fn((latLng: [number, number]) => {
      leafletMockState.popupSetLatLng(latLng)
      return popupInstance
    }),
    setContent: vi.fn((html: string) => {
      leafletMockState.popupSetContent(html)
      return popupInstance
    }),
    openOn: vi.fn((map: unknown) => {
      leafletMockState.popupIsOpen = true
      leafletMockState.popupOpenOn(map)
      return popupInstance
    }),
    close: vi.fn(() => {
      leafletMockState.popupIsOpen = false
      leafletMockState.popupClose()
      return popupInstance
    }),
    isOpen: vi.fn(() => leafletMockState.popupIsOpen),
  }

  return {
    default: {
      map: vi.fn(() => mapInstance),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(() => layerGroupInstance),
      divIcon: vi.fn(() => ({})),
      marker: vi.fn((_coords: [number, number], options?: { title?: string }) => {
        const bindTooltip = vi.fn<(...args: unknown[]) => unknown>()
        const record: MockMarkerRecord = {
          title: options?.title,
          bindTooltip,
          on: vi.fn<(eventName: string, handler: (event: unknown) => void) => unknown>(
            (eventName, handler) => {
              if (eventName === 'click') {
                record.clickHandler = handler
              }
              return markerObj
            },
          ),
        }
        const markerObj = {
          bindTooltip: (...args: unknown[]) => {
            bindTooltip(...args)
            return markerObj
          },
          on: record.on,
          addTo: vi.fn(() => markerObj),
        }
        leafletMockState.markers.push(record)
        return markerObj
      }),
      point: vi.fn((x: number, y: number) => ({ x, y })),
      popup: vi.fn(() => popupInstance),
      DomEvent: {
        stopPropagation: vi.fn(),
      },
    },
  }
})

function ControlledSpMonitoringMap({
  regions,
  initialTarget,
  customDecision = null,
  isCustomLoading = false,
  customError = null,
  onSelectRegionSpy,
  onSelectCoordinatesSpy,
}: {
  regions: OohAlertDecision[]
  initialTarget: AlertTarget | null
  customDecision?: OohAlertDecision | null
  isCustomLoading?: boolean
  customError?: unknown
  onSelectRegionSpy?: (regionId: string) => void
  onSelectCoordinatesSpy?: (coords: { lat: number; lon: number }) => void
}) {
  const [target, setTarget] = useState<AlertTarget | null>(initialTarget)

  return (
    <SpMonitoringMap
      regions={regions}
      selectedTarget={target}
      customDecision={customDecision}
      isCustomLoading={isCustomLoading}
      customError={customError}
      onSelectRegion={(regionId) => {
        onSelectRegionSpy?.(regionId)
        setTarget({ kind: 'region', regionId })
      }}
      onSelectCoordinates={(coords) => {
        onSelectCoordinatesSpy?.(coords)
        setTarget({ kind: 'coordinates', lat: coords.lat, lon: coords.lon })
      }}
    />
  )
}

describe('SpMonitoringMap camera centering and interactive popup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    leafletMockState.getZoom.mockReturnValue(11)
    leafletMockState.popupIsOpen = false
    leafletMockState.mapClickHandler = null
    leafletMockState.popupCloseHandler = null
    leafletMockState.markers = []
  })

  it('does not move camera or open popup on initial mount, and opens popup + pans when selecting a region', async () => {
    const user = userEvent.setup()
    const onSelectRegion = vi.fn()

    const { rerender } = render(
      <ControlledSpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        initialTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        onSelectRegionSpy={onSelectRegion}
      />,
    )

    expect(leafletMockState.panTo).not.toHaveBeenCalled()
    expect(leafletMockState.setView).not.toHaveBeenCalled()
    expect(leafletMockState.popupOpenOn).not.toHaveBeenCalled()

    rerender(
      <ControlledSpMonitoringMap
        regions={[{ ...mockRegionButanta, riskScore: 95 }, mockRegionItaquera]}
        initialTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        onSelectRegionSpy={onSelectRegion}
      />,
    )

    expect(leafletMockState.panTo).not.toHaveBeenCalled()
    expect(leafletMockState.setView).not.toHaveBeenCalled()
    expect(leafletMockState.popupOpenOn).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Itaquera/i }))
    expect(onSelectRegion).toHaveBeenCalledWith('zona-leste-itaquera')
    expect(leafletMockState.panTo).toHaveBeenCalledWith([-23.5419, -46.4563], { animate: true })

    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(1)
    expect(leafletMockState.popupSetLatLng).toHaveBeenCalledWith([-23.5419, -46.4563])
    const openedHtml = String(leafletMockState.popupSetContent.mock.calls.at(-1)?.[0] ?? '')
    expect(openedHtml).toContain('Itaquera')
    expect(openedHtml).toContain('Campanha Padrão')
    expect(openedHtml).toContain('Sem chuva no momento')
    expect(openedHtml).toContain('15% • 0,0 mm')
  })

  it('updates popup content in-place on 60s refresh without reopening and handles marker click & popupclose', () => {
    const onSelectRegion = vi.fn()

    const { rerender } = render(
      <SpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        selectedTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        onSelectRegion={onSelectRegion}
        onSelectCoordinates={vi.fn()}
      />,
    )

    const butantaMarker = leafletMockState.markers.find((marker) => marker.title === 'Butantã')
    expect(butantaMarker).toBeDefined()

    act(() => {
      butantaMarker?.clickHandler?.({})
    })

    expect(onSelectRegion).toHaveBeenCalledWith('zona-oeste-butanta')
    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(1)
    expect(leafletMockState.popupSetLatLng).toHaveBeenCalledWith([-23.5672, -46.729])

    const updatedButantaMarker = leafletMockState.markers.find((marker) => marker.title === 'Butantã')
    expect(updatedButantaMarker?.bindTooltip).not.toHaveBeenCalled()

    rerender(
      <SpMonitoringMap
        regions={[{ ...mockRegionButanta, riskScore: 98 }, mockRegionItaquera]}
        selectedTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        onSelectRegion={onSelectRegion}
        onSelectCoordinates={vi.fn()}
      />,
    )

    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(1)
    const refreshedHtml = String(leafletMockState.popupSetContent.mock.calls.at(-1)?.[0] ?? '')
    expect(refreshedHtml).toContain('Risco: 98/100')

    act(() => {
      leafletMockState.popupIsOpen = false
      leafletMockState.popupCloseHandler?.({ popup: undefined })
    })

    const markerAfterClose = leafletMockState.markers.find((marker) => marker.title === 'Butantã')
    expect(markerAfterClose?.bindTooltip).toHaveBeenCalled()

    act(() => {
      markerAfterClose?.clickHandler?.({})
    })

    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(2)
  })

  it('opens loading popup on free coordinate click and updates with Campinas result or error', () => {
    const onSelectCoordinates = vi.fn()

    const { rerender } = render(
      <ControlledSpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        initialTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        isCustomLoading={true}
        customError={null}
        onSelectCoordinatesSpy={onSelectCoordinates}
      />,
    )

    act(() => {
      leafletMockState.mapClickHandler?.({ latlng: { lat: -22.9099, lng: -47.0626 } })
    })

    expect(onSelectCoordinates).toHaveBeenCalledWith({ lat: -22.9099, lon: -47.0626 })
    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(1)
    expect(leafletMockState.popupSetLatLng).toHaveBeenCalledWith([-22.9099, -47.0626])
    expect(String(leafletMockState.popupSetContent.mock.calls.at(-1)?.[0] ?? '')).toContain(
      'Consultando coordenada...',
    )

    rerender(
      <ControlledSpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        initialTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={mockCampinasDecision}
        isCustomLoading={false}
        customError={null}
        onSelectCoordinatesSpy={onSelectCoordinates}
      />,
    )

    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(1)
    const campinasHtml = String(leafletMockState.popupSetContent.mock.calls.at(-1)?.[0] ?? '')
    expect(campinasHtml).toContain('Chovendo agora • Chuva moderada • 22,8 °C')
    expect(campinasHtml).toContain('Fora da cobertura CGE-SP')

    rerender(
      <ControlledSpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        initialTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        isCustomLoading={false}
        customError={new ApiError('Tempo limite excedido')}
        onSelectCoordinatesSpy={onSelectCoordinates}
      />,
    )

    expect(leafletMockState.popupOpenOn).toHaveBeenCalledTimes(1)
    expect(String(leafletMockState.popupSetContent.mock.calls.at(-1)?.[0] ?? '')).toContain(
      'Tempo limite excedido',
    )
  })

  it('calls onFocusDetails when clicking Ver detalhes completos inside the map container', () => {
    const onFocusDetails = vi.fn()

    render(
      <SpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        selectedTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        onSelectRegion={vi.fn()}
        onSelectCoordinates={vi.fn()}
        onFocusDetails={onFocusDetails}
      />,
    )

    const mapCanvas = screen.getByTestId('sp-monitoring-map-canvas')
    const button = document.createElement('button')
    button.setAttribute('type', 'button')
    button.setAttribute('data-ooh-action', 'focus-details')
    button.textContent = 'Ver detalhes completos'
    mapCanvas.appendChild(button)

    fireEvent.click(button)
    expect(onFocusDetails).toHaveBeenCalledTimes(1)
  })

  it('restores default zoom via setView when map is zoomed out below 11', async () => {
    const user = userEvent.setup()
    const onSelectRegion = vi.fn()
    leafletMockState.getZoom.mockReturnValue(8)

    render(
      <SpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        selectedTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        onSelectRegion={onSelectRegion}
        onSelectCoordinates={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Butantã/i }))
    expect(leafletMockState.setView).toHaveBeenCalledWith([-23.5672, -46.729], 11, {
      animate: true,
    })
  })

  it('shows and hides interactive legend tooltips on hover for severities and custom point', async () => {
    const user = userEvent.setup()

    render(
      <SpMonitoringMap
        regions={[mockRegionButanta, mockRegionItaquera]}
        selectedTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        onSelectRegion={vi.fn()}
        onSelectCoordinates={vi.fn()}
      />,
    )

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    const criticalLegendButton = screen.getByRole('button', { name: 'Crítico' })
    await user.hover(criticalLegendButton)

    const criticalTooltip = screen.getByRole('tooltip')
    expect(criticalTooltip).toHaveTextContent(
      'Alagamento ativo intransitável na zona ou chuva CGE ≥ 40 mm com pico ≥ 10 mm/h.',
    )

    const customPointLegendButton = screen.getByRole('button', { name: 'Ponto consultado' })
    await user.hover(customPointLegendButton)

    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Coordenada clicada livremente no mapa (CGE-SP na Capital ou Open-Meteo + INMET fora de SP).',
    )

    await user.unhover(customPointLegendButton)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })
})
