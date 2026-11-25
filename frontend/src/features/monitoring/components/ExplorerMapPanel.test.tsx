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
})
