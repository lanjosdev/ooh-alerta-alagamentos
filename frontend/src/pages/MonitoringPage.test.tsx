import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { alertsService } from '@/services/alertsService'
import { playerService } from '@/services/playerService'
import { sourcesService } from '@/services/sourcesService'
import {
  mockCityOverview,
  mockRssXml,
  mockSourcesStatus,
} from '@/test/fixtures/alerts'
import {
  mockGeocodeResponse,
  mockHealthDataDisabled,
  mockHealthDataEnabled,
  mockPlayerAssetsData,
  mockPlayerSceneCoordinates,
  mockPlayerSceneCritical,
  mockPlayerSceneHistorical,
  mockPlayerSceneNormal,
} from '@/test/fixtures/player'
import { maplibreMockState } from '@/test/mocks/maplibre'
import { MonitoringPage } from './MonitoringPage'

vi.mock('maplibre-gl', async () => {
  const { createMapLibreModuleMock } = await import('@/test/mocks/maplibre')
  return createMapLibreModuleMock()
})

vi.mock('@deck.gl/mapbox', async () => {
  const { createDeckGlMapboxMock } = await import('@/test/mocks/maplibre')
  return createDeckGlMapboxMock()
})

vi.mock('@/services/playerService', async () => {
  const actual = await vi.importActual<typeof import('@/services/playerService')>(
    '@/services/playerService',
  )
  return {
    playerService: {
      ...actual.playerService,
      getAssets: vi.fn(),
      geocodeAddress: vi.fn(),
      getScene: vi.fn(),
    },
  }
})

vi.mock('@/services/alertsService', async () => {
  const actual = await vi.importActual<typeof import('@/services/alertsService')>(
    '@/services/alertsService',
  )
  return {
    alertsService: {
      ...actual.alertsService,
      getCityOverview: vi.fn(),
      getRssFeedXml: vi.fn(),
    },
  }
})

vi.mock('@/services/sourcesService', () => ({
  sourcesService: {
    getHealth: vi.fn(),
    getSourcesStatus: vi.fn(),
  },
}))

function renderMonitoringPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MonitoringPage />
    </QueryClientProvider>,
  )
}

describe('MonitoringPage unified 2-route dashboard', () => {
  beforeEach(() => {
    maplibreMockState.reset()
    vi.clearAllMocks()
  })

  it('opens Preview OOH by default, supports pin selection, historical replay, Nominatim search, 16:9 modal and Clima/Técnico tabs', async () => {
    const user = userEvent.setup()

    vi.mocked(sourcesService.getHealth).mockResolvedValue(mockHealthDataDisabled)
    vi.mocked(sourcesService.getSourcesStatus).mockResolvedValue(mockSourcesStatus)
    vi.mocked(alertsService.getCityOverview).mockResolvedValue(mockCityOverview)
    vi.mocked(alertsService.getRssFeedXml).mockResolvedValue(mockRssXml)

    const getAssetsMock = vi
      .mocked(playerService.getAssets)
      .mockResolvedValue(mockPlayerAssetsData)

    const getSceneMock = vi
      .mocked(playerService.getScene)
      .mockImplementation(async (target, scenario) => {
        if (scenario?.date === '2025-01-24') {
          return mockPlayerSceneHistorical
        }
        if (target.kind === 'asset' && target.assetId === 'av-radial-leste') {
          return mockPlayerSceneNormal
        }
        if (target.kind === 'coordinates') {
          return mockPlayerSceneCoordinates
        }
        return mockPlayerSceneCritical
      })

    const geocodeMock = vi
      .mocked(playerService.geocodeAddress)
      .mockResolvedValueOnce(mockGeocodeResponse)

    renderMonitoringPage()

    expect(
      screen.getByLabelText('Carregando mapa explorador e preview DOOH'),
    ).toBeInTheDocument()

    // Preview OOH opens by default on the right stage
    expect(
      await screen.findByLabelText(/Peça DOOH 9:16 — Av\. Jornalista Roberto Marinho/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Fontes: OK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Simular/i })).toBeDisabled()

    // Click another OOH pin (Radial Leste)
    await user.click(
      screen.getByRole('button', { name: /Av\. Alcântara Machado \(Radial Leste\)/i }),
    )
    expect(
      await screen.findByLabelText(/Peça DOOH 9:16 — Av\. Alcântara Machado/i),
    ).toBeInTheDocument()
    expect(screen.getByText('TRÂNSITO LIVRE • SEM ALAGAMENTOS')).toBeInTheDocument()

    // Apply historical replay shortcut 24/01/2025 • 20:30
    await user.click(screen.getByRole('button', { name: /Histórico/i }))
    await user.click(screen.getByRole('button', { name: /24\/01\/2025 • 20:30/i }))

    await waitFor(() => {
      expect(getAssetsMock).toHaveBeenCalledWith({ date: '2025-01-24', time: '20:30' })
      expect(getSceneMock).toHaveBeenCalledWith(
        { kind: 'asset', assetId: 'av-radial-leste' },
        { date: '2025-01-24', time: '20:30' },
      )
    })
    expect(await screen.findByText('- REPLAY • 24/01/2025 20:30 -')).toBeInTheDocument()

    // Open 16:9 split horizontal modal and confirm inline 9:16 preview unmounts
    await user.click(screen.getByRole('button', { name: '16:9' }))
    expect(
      await screen.findByRole('dialog', { name: /Palco expandido 16:9/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Preview inline pausado temporariamente/i),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))

    // Search address via Nominatim (submit only)
    const searchInput = screen.getByLabelText(/Buscar endereço ou avenida em SP/i)
    await user.type(searchInput, 'Avenida Paulista')
    expect(geocodeMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    const candidate = await screen.findByRole('button', { name: /Avenida Paulista, Bela Vista/i })
    await user.click(candidate)

    await waitFor(() => {
      expect(getSceneMock).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'coordinates', lat: -23.5614, lon: -46.6559 }),
        { date: '2025-01-24', time: '20:30' },
      )
    })

    // Switch to Clima & Risco and Técnico (GeoJSON + XML)
    await user.click(screen.getByRole('tab', { name: /Clima & Risco/i }))
    expect(await screen.findByText(/Previsão de Chuva \(2h e 6h\)/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Técnico/i }))
    await user.click(screen.getByRole('tab', { name: /GeoJSON \(Cena DOOH\)/i }))
    expect(await screen.findByText(/Trechos viários: 2/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /XML \/ RSS 2\.0/i }))
    expect(await screen.findByText(/Feed RSS protegido em tempo real/i)).toBeInTheDocument()
  })

  it('shows friendly QueryErrorAlert with recovery action when backend rejects request in historical or simulated mode', async () => {
    const user = userEvent.setup()

    vi.mocked(sourcesService.getHealth).mockResolvedValue(mockHealthDataEnabled)
    vi.mocked(sourcesService.getSourcesStatus).mockResolvedValue(mockSourcesStatus)
    vi.mocked(alertsService.getCityOverview).mockResolvedValue(mockCityOverview)
    vi.mocked(playerService.getScene).mockResolvedValue(mockPlayerSceneCritical)
    vi.mocked(playerService.getAssets)
      .mockResolvedValueOnce(mockPlayerAssetsData)
      .mockRejectedValueOnce(
        new ApiError('Parâmetros de simulação desabilitados neste ambiente.', { status: 400 }),
      )
      .mockResolvedValueOnce(mockPlayerAssetsData)

    renderMonitoringPage()

    expect(
      await screen.findByLabelText(/Peça DOOH 9:16 — Av\. Jornalista Roberto Marinho/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Simular/i }))
    await user.click(screen.getByRole('menuitemradio', { name: /Crítico/i }))

    expect(
      await screen.findByText('Parâmetros de simulação desabilitados neste ambiente.'),
    ).toBeInTheDocument()

    const backButtons = screen.getAllByRole('button', { name: /Voltar ao Tempo Real/i })
    await user.click(backButtons[backButtons.length - 1])

    expect(
      await screen.findByLabelText(/Peça DOOH 9:16 — Av\. Jornalista Roberto Marinho/i),
    ).toBeInTheDocument()
  })
})
