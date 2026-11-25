import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { playerService } from '@/services/playerService'
import { mockPlayerSceneHistorical } from '@/test/fixtures/player'
import { maplibreMockState } from '@/test/mocks/maplibre'
import { CleanPlayerPage } from './CleanPlayerPage'

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
      getScene: vi.fn(),
    },
  }
})

function renderCleanPlayer(search: string) {
  window.history.replaceState({}, '', `/${search}`)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <CleanPlayerPage />
    </QueryClientProvider>,
  )
}

describe('CleanPlayerPage', () => {
  beforeEach(() => {
    maplibreMockState.reset()
    vi.clearAllMocks()
  })

  it('parses URL params, validates brand/accent with safe fallback, and renders fullscreen landscape player', async () => {
    const getSceneMock = vi
      .mocked(playerService.getScene)
      .mockResolvedValueOnce(mockPlayerSceneHistorical)

    const longBrand = 'Rede Metropolitana Paulista Digital Out Of Home Extra'
    const { container } = renderCleanPlayer(
      `?mode=player&asset=marginal-pinheiros&format=landscape&date=2025-01-24&time=20:30&brand=${encodeURIComponent(
        longBrand,
      )}&tag=${encodeURIComponent('Corredor Zona Oeste')}&accent=not-hex`,
    )

    await waitFor(() => {
      expect(getSceneMock).toHaveBeenCalledWith(
        { kind: 'asset', assetId: 'marginal-pinheiros' },
        { date: '2025-01-24', time: '20:30' },
      )
    })

    const article = await screen.findByLabelText(/Peça DOOH 16:9 — Marginal Pinheiros/i)
    expect(article).toBeInTheDocument()
    // Invalid accent falls back to default 0057FF
    expect(article).toHaveStyle('--player-accent: #0057FF')
    // Brand truncated to 40 chars
    const truncatedBrand = longBrand.slice(0, 40).trim()
    expect(screen.getAllByText(truncatedBrand).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Corredor Zona Oeste')).toBeInTheDocument()
    expect(screen.getByText('- REPLAY • 24/01/2025 20:30 -')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="flood-generative-map-canvas"]')).toBeInTheDocument()
  })
})
