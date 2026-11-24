import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockRegionButanta, mockRegionItaquera } from '@/test/fixtures/alerts'
import { SpMonitoringMap } from './SpMonitoringMap'

const leafletMockState = vi.hoisted(() => ({
  panTo: vi.fn(),
  setView: vi.fn(),
  getZoom: vi.fn(() => 11),
  popupIsOpen: false,
}))

vi.mock('leaflet', () => {
  const mapInstance = {
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    setView: leafletMockState.setView,
    panTo: leafletMockState.panTo,
    getZoom: leafletMockState.getZoom,
  }

  const layerGroupInstance = {
    clearLayers: vi.fn(),
    addTo: vi.fn(() => layerGroupInstance),
  }

  const markerInstance = {
    bindTooltip: vi.fn(() => markerInstance),
    on: vi.fn(() => markerInstance),
    addTo: vi.fn(() => markerInstance),
  }

  const popupInstance = {
    setLatLng: vi.fn(() => popupInstance),
    setContent: vi.fn(() => popupInstance),
    openOn: vi.fn(() => {
      leafletMockState.popupIsOpen = true
      return popupInstance
    }),
    close: vi.fn(() => {
      leafletMockState.popupIsOpen = false
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
      marker: vi.fn(() => markerInstance),
      point: vi.fn((x: number, y: number) => ({ x, y })),
      popup: vi.fn(() => popupInstance),
      DomEvent: {
        stopPropagation: vi.fn(),
      },
    },
  }
})

describe('SpMonitoringMap camera centering', () => {
  beforeEach(() => {
    leafletMockState.getZoom.mockReturnValue(11)
    leafletMockState.popupIsOpen = false
  })

  it('does not move camera on initial mount or data refresh, and pans when selecting a region', async () => {
    const user = userEvent.setup()
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

    expect(leafletMockState.panTo).not.toHaveBeenCalled()
    expect(leafletMockState.setView).not.toHaveBeenCalled()

    rerender(
      <SpMonitoringMap
        regions={[{ ...mockRegionButanta, riskScore: 95 }, mockRegionItaquera]}
        selectedTarget={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        customDecision={null}
        onSelectRegion={onSelectRegion}
        onSelectCoordinates={vi.fn()}
      />,
    )

    expect(leafletMockState.panTo).not.toHaveBeenCalled()
    expect(leafletMockState.setView).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /Itaquera/i }))
    expect(onSelectRegion).toHaveBeenCalledWith('zona-leste-itaquera')
    expect(leafletMockState.panTo).toHaveBeenCalledWith([-23.5419, -46.4563], { animate: true })
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
