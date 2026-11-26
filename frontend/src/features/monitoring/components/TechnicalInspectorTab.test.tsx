import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { getValidatedEnv } from '@/env'
import { alertsService } from '@/services/alertsService'
import { mockRegionButanta, mockRssXml } from '@/test/fixtures/alerts'
import { mockPlayerSceneCritical } from '@/test/fixtures/player'
import { TechnicalInspectorTab } from './TechnicalInspectorTab'

vi.mock('@/services/alertsService', async () => {
  const actual = await vi.importActual<typeof import('@/services/alertsService')>(
    '@/services/alertsService',
  )
  return {
    alertsService: {
      ...actual.alertsService,
      getRssFeedXml: vi.fn(),
    },
  }
})

function renderWithQuery(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('TechnicalInspectorTab', () => {
  it('renders reasons, 5-source telemetry when scene is provided, JSON, XML RSS 2.0 and GeoJSON (Cena DOOH)', async () => {
    const user = userEvent.setup()
    const writeTextMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    const rssMock = vi.mocked(alertsService.getRssFeedXml).mockResolvedValueOnce(mockRssXml)

    renderWithQuery(
      <TechnicalInspectorTab
        decision={mockRegionButanta}
        target={{ kind: 'region', regionId: 'zona-oeste-butanta' }}
        scenario={{ cgeDate: '15/01/2026' }}
        scene={mockPlayerSceneCritical}
        playerTarget={{ kind: 'asset', assetId: 'av-roberto-marinho' }}
      />,
    )

    expect(
      screen.getByText('1 ponto de alagamento ativo e intransitável na Zona Oeste (CGE-SP)'),
    ).toBeInTheDocument()
    expect(screen.getByText('(open-meteo)')).toBeInTheDocument()
    expect(screen.getByText('(inmet)')).toBeInTheDocument()
    expect(screen.getByText('(cge-sp)')).toBeInTheDocument()
    expect(screen.getByText('(osm-curated-snapshot)')).toBeInTheDocument()
    expect(screen.getByText('(geosampa-wfs)')).toBeInTheDocument()
    expect(screen.getAllByText('Cache')).toHaveLength(2)

    const expectedUrl = `${getValidatedEnv().VITE_API_BASE_URL}/alerts/regions/zona-oeste-butanta?cgeDate=15%2F01%2F2026`
    expect(screen.getByText(expectedUrl)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Copiar URL/i }))
    expect(writeTextMock).toHaveBeenCalledWith(expectedUrl)

    await user.click(screen.getByRole('tab', { name: /XML \/ RSS 2\.0/i }))

    await waitFor(() => {
      expect(rssMock).toHaveBeenCalledWith(
        { kind: 'region', regionId: 'zona-oeste-butanta' },
        { cgeDate: '15/01/2026' },
      )
    })

    expect(
      await screen.findByText(/<ooh:severityLabel>CRITICO<\/ooh:severityLabel>/),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Copiar payload/i }))
    expect(writeTextMock).toHaveBeenCalledWith(mockRssXml)

    await user.click(screen.getByRole('tab', { name: /GeoJSON \(Cena DOOH\)/i }))
    expect(screen.getByText(/Trechos viários: 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Manchas GeoSampa: 2/i)).toBeInTheDocument()
    expect(
      screen.getByText(
        `${getValidatedEnv().VITE_API_BASE_URL}/player/scene?assetId=av-roberto-marinho&cgeDate=15%2F01%2F2026`,
      ),
    ).toBeInTheDocument()
  })
})
