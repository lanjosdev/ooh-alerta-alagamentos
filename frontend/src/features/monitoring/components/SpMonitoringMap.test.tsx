import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockRegionButanta, mockRegionItaquera } from '@/test/fixtures/alerts'
import { SpMonitoringMap } from './SpMonitoringMap'

const leafletMockState = vi.hoisted(() => ({
  panTo: vi.fn(),
  setView: vi.fn(),
  getZoom: vi.fn(() => 11),
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

  return {
    default: {
      map: vi.fn(() => mapInstance),
      tileLayer: vi.fn(() => ({ addTo: vi.fn() })),
      layerGroup: vi.fn(() => layerGroupInstance),
      divIcon: vi.fn(() => ({})),
      marker: vi.fn(() => markerInstance),
      DomEvent: {
        stopPropagation: vi.fn(),
      },
    },
  }
})

describe('SpMonitoringMap camera centering', () => {
  beforeEach(() => {
    leafletMockState.getZoom.mockReturnValue(11)
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
})
