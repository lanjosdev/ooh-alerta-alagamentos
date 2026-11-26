import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { playerService } from '@/services/playerService'
import { mockCityOverview } from '@/test/fixtures/alerts'
import { mockGeocodeResponse, mockPlayerAssetsData } from '@/test/fixtures/player'
import { maplibreMockState } from '@/test/mocks/maplibre'
import { ExplorerMapPanel } from './ExplorerMapPanel'

vi.mock('maplibre-gl', async () => {
  const { createMapLibreModuleMock } = await import('@/test/mocks/maplibre')
  return createMapLibreModuleMock()
})

vi.mock('@/services/playerService', async () => {
  const actual = await vi.importActual<typeof import('@/services/playerService')>(
    '@/services/playerService',
  )
  return {
    playerService: {
      ...actual.playerService,
      geocodeAddress: vi.fn(),
    },
  }
})

function renderExplorerPanel(overrides?: Partial<React.ComponentProps<typeof ExplorerMapPanel>>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  const defaultProps: React.ComponentProps<typeof ExplorerMapPanel> = {
    activeLayer: 'assets',
    onChangeLayer: vi.fn(),
    assets: mockPlayerAssetsData.assets,
    totalAssetsCount: 7,
    regions: mockCityOverview.regions,
    totalRegionsCount: 12,
    selectedTarget: { kind: 'asset', assetId: 'av-roberto-marinho' },
    selectedRegionId: null,
    zoneFilter: 'Todas',
    onChangeZoneFilter: vi.fn(),
    severityFilter: 'all',
    onChangeSeverityFilter: vi.fn(),
    onSelectAsset: vi.fn(),
    onSelectRegion: vi.fn(),
    onSelectCoordinates: vi.fn(),
    ...overrides,
  }

  return {
    ...render(
      <QueryClientProvider client={client}>
        <ExplorerMapPanel {...defaultProps} />
      </QueryClientProvider>,
    ),
    props: defaultProps,
  }
}

describe('ExplorerMapPanel', () => {
  beforeEach(() => {
    maplibreMockState.reset()
    vi.clearAllMocks()
  })

  it('triggers Nominatim search only on form submit (never onChange) and selects candidate', async () => {
    const user = userEvent.setup()
    const geocodeMock = vi
      .mocked(playerService.geocodeAddress)
      .mockResolvedValueOnce(mockGeocodeResponse)
    const onSelectCoordinates = vi.fn()

    renderExplorerPanel({ onSelectCoordinates })

    const input = screen.getByLabelText(/Buscar endereço ou avenida em SP/i)
    await user.type(input, 'Avenida Paulista')

    // Must not call geocodeAddress while typing
    expect(geocodeMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => {
      expect(geocodeMock).toHaveBeenCalledTimes(1)
      expect(geocodeMock).toHaveBeenCalledWith('Avenida Paulista')
    })

    const candidateButton = await screen.findByRole('button', { name: /Avenida Paulista, Bela Vista/i })
    await user.click(candidateButton)

    expect(onSelectCoordinates).toHaveBeenCalledWith({
      lat: -23.5614,
      lon: -46.6559,
      label: 'Avenida Paulista',
    })
  })

  it('toggles between Pontos OOH (7) and Regiões SP (12) and handles pin and free map clicks', async () => {
    const user = userEvent.setup()
    const onChangeLayer = vi.fn()
    const onSelectAsset = vi.fn()
    const onSelectCoordinates = vi.fn()

    renderExplorerPanel({ onChangeLayer, onSelectAsset, onSelectCoordinates })

    expect(screen.getByText('© OpenStreetMap • OpenFreeMap')).toBeInTheDocument()

    // Click an OOH asset marker
    await user.click(
      screen.getByRole('button', { name: /Av\. Jornalista Roberto Marinho/i }),
    )
    expect(onSelectAsset).toHaveBeenCalledWith('av-roberto-marinho')

    // Toggle layer to Regiões SP (12)
    await user.click(screen.getByRole('button', { name: /Regiões SP \(12\)/i }))
    expect(onChangeLayer).toHaveBeenCalledWith('regions')

    // Free map click
    maplibreMockState.triggerMapClick({ lng: -46.6559, lat: -23.5614 })
    expect(onSelectCoordinates).toHaveBeenCalledWith({
      lat: -23.5614,
      lon: -46.6559,
    })
  })

  it('uses isolated root wrapper with anchor center, adds NavigationControl, and keeps visual classes on inner span', () => {
    renderExplorerPanel()

    const map = maplibreMockState.maps[0]
    expect(map.addControl).toHaveBeenCalledWith(expect.any(Object), 'top-right')

    const assetButton = screen.getByRole('button', { name: /Av\. Jornalista Roberto Marinho/i })
    expect(assetButton).toHaveClass('ooh-map-marker-root', 'ooh-map-marker-root--selected')
    expect(assetButton).not.toHaveClass('ooh-map-marker')

    const innerDot = assetButton.querySelector('span')
    expect(innerDot).not.toBeNull()
    expect(innerDot).toHaveClass('ooh-map-marker', 'ooh-map-marker--selected')

    expect(maplibreMockState.markers.length).toBeGreaterThan(0)
    for (const marker of maplibreMockState.markers) {
      expect(marker.options?.anchor).toBe('center')
    }
  })

  it('suppresses duplicate custom pin in Regiões SP mode when a region is selected, and shows it on free coordinate selection', () => {
    const selectedRegion = mockCityOverview.regions[0]
    const { container, rerender } = renderExplorerPanel({
      activeLayer: 'regions',
      selectedRegionId: selectedRegion.location.id,
      selectedTarget: {
        kind: 'coordinates',
        lat: selectedRegion.location.latitude,
        lon: selectedRegion.location.longitude,
        label: selectedRegion.location.name,
      },
    })

    expect(container.querySelector('.ooh-map-marker--custom')).toBeNull()

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    rerender(
      <QueryClientProvider client={client}>
        <ExplorerMapPanel
          activeLayer="assets"
          onChangeLayer={vi.fn()}
          assets={mockPlayerAssetsData.assets}
          totalAssetsCount={7}
          regions={mockCityOverview.regions}
          totalRegionsCount={12}
          selectedTarget={{ kind: 'coordinates', lat: -23.5614, lon: -46.6559 }}
          selectedRegionId={null}
          zoneFilter="Todas"
          onChangeZoneFilter={vi.fn()}
          severityFilter="all"
          onChangeSeverityFilter={vi.fn()}
          onSelectAsset={vi.fn()}
          onSelectRegion={vi.fn()}
          onSelectCoordinates={vi.fn()}
        />
      </QueryClientProvider>,
    )

    const customButton = container.querySelector('.ooh-map-marker-root--custom')
    expect(customButton).not.toBeNull()
    expect(customButton?.querySelector('.ooh-map-marker--custom')).not.toBeNull()

    const customMarker = maplibreMockState.markers.find(
      (marker) => marker.options?.element === customButton,
    )
    expect(customMarker?.setLngLat).toHaveBeenCalledWith([-46.6559, -23.5614])
  })
})
