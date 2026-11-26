import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockPlayerSceneCritical, mockPlayerSceneNormal } from '@/test/fixtures/player'
import { maplibreMockState } from '@/test/mocks/maplibre'
import { FloodGenerativeMap } from './FloodGenerativeMap'

vi.mock('maplibre-gl', async () => {
  const { createMapLibreModuleMock } = await import('@/test/mocks/maplibre')
  return createMapLibreModuleMock()
})

vi.mock('@deck.gl/mapbox', async () => {
  const { createDeckGlMapboxMock } = await import('@/test/mocks/maplibre')
  return createDeckGlMapboxMock()
})

describe('FloodGenerativeMap', () => {
  beforeEach(() => {
    maplibreMockState.reset()
  })

  it('mounts MapboxOverlay interleaved, cleans up with finalize and map.remove on unmount, and renders ODbL attribution', () => {
    const { unmount } = render(
      <FloodGenerativeMap
        camera={mockPlayerSceneCritical.camera}
        roads={mockPlayerSceneCritical.roads}
        severityLevel={3}
        format="portrait"
      />,
    )

    expect(screen.getByTestId('flood-generative-map-canvas')).toBeInTheDocument()
    expect(screen.getByText('© OpenStreetMap • OpenFreeMap')).toBeInTheDocument()
    expect(maplibreMockState.maps).toHaveLength(1)
    expect(maplibreMockState.overlays).toHaveLength(1)

    const map = maplibreMockState.maps[0]
    const overlay = maplibreMockState.overlays[0]

    expect(map.addControl).toHaveBeenCalledWith(overlay)
    expect(map.fitBounds).toHaveBeenCalled()

    const latestProps = maplibreMockState.overlayPropsHistory.at(-1) as { layers?: unknown[] }
    expect(Array.isArray(latestProps.layers)).toBe(true)
    expect(latestProps.layers).toHaveLength(3)

    unmount()

    expect(overlay.finalize).toHaveBeenCalledTimes(1)
    expect(map.remove).toHaveBeenCalledTimes(1)
  })

  it('keeps deck.gl layers empty when severityLevel is 0 (NORMAL)', () => {
    render(
      <FloodGenerativeMap
        camera={mockPlayerSceneNormal.camera}
        roads={mockPlayerSceneNormal.roads}
        severityLevel={0}
        format="landscape"
      />,
    )

    const latestProps = maplibreMockState.overlayPropsHistory.at(-1) as { layers?: unknown[] }
    expect(latestProps.layers).toEqual([])
  })

  it('mounts discrete targetPin marker at center and removes it on unmount', () => {
    const { container, unmount } = render(
      <FloodGenerativeMap
        camera={mockPlayerSceneCritical.camera}
        roads={mockPlayerSceneCritical.roads}
        severityLevel={3}
        format="portrait"
        targetPin={{
          coordinates: mockPlayerSceneCritical.camera.center,
          label: 'VOCÊ ESTÁ AQUI',
        }}
      />,
    )

    expect(maplibreMockState.markers).toHaveLength(1)
    const targetMarker = maplibreMockState.markers[0]
    expect(targetMarker.options?.anchor).toBe('center')
    expect(targetMarker.setLngLat).toHaveBeenCalledWith(mockPlayerSceneCritical.camera.center)

    const root = container.querySelector('.player-target-pin-root')
    expect(root).not.toBeNull()
    expect(root?.querySelector('.player-target-pin__dot')).not.toBeNull()
    expect(screen.getByText('VOCÊ ESTÁ AQUI')).toBeInTheDocument()

    unmount()
    expect(targetMarker.remove).toHaveBeenCalled()
  })
})
