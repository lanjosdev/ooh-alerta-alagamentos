import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-error'
import { alertsService } from '@/services/alertsService'
import { sourcesService } from '@/services/sourcesService'
import {
  mockCampinasDecision,
  mockCityOverview,
  mockRssXml,
  mockSimulatedCriticalOverview,
  mockSourcesStatus,
} from '@/test/fixtures/alerts'
import { MonitoringPage } from './MonitoringPage'

const leafletMockState = vi.hoisted(() => ({
  clickHandler: null as ((event: { latlng: { lat: number; lng: number } }) => void) | null,
}))

vi.mock('leaflet', () => {
  const mapInstance = {
    on: vi.fn((eventName: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => {
      if (eventName === 'click') {
        leafletMockState.clickHandler = handler
      }
      return mapInstance
    }),
    off: vi.fn(),
    remove: vi.fn(),
    setView: vi.fn(),
    panTo: vi.fn(),
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

vi.mock('@/services/alertsService', async () => {
  const actual = await vi.importActual<typeof import('@/services/alertsService')>(
    '@/services/alertsService',
  )
  return {
    alertsService: {
      ...actual.alertsService,
      getCityOverview: vi.fn(),
      getRegionAlert: vi.fn(),
      getCoordinatesAlert: vi.fn(),
      getRssFeedXml: vi.fn(),
    },
  }
})

vi.mock('@/services/sourcesService', () => ({
  sourcesService: {
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

describe('MonitoringPage integration flow', () => {
  beforeEach(() => {
    leafletMockState.clickHandler = null
  })

  it('loads overview, switches scenarios, selects regions, queries free coordinates and inspects RSS', async () => {
    const user = userEvent.setup()

    const overviewMock = vi
      .mocked(alertsService.getCityOverview)
      .mockResolvedValueOnce(mockCityOverview)
      .mockResolvedValueOnce(mockCityOverview)
      .mockResolvedValueOnce(mockSimulatedCriticalOverview)

    const coordsMock = vi
      .mocked(alertsService.getCoordinatesAlert)
      .mockResolvedValueOnce(mockCampinasDecision)

    const rssMock = vi.mocked(alertsService.getRssFeedXml).mockResolvedValueOnce(mockRssXml)
    vi.mocked(sourcesService.getSourcesStatus).mockResolvedValue(mockSourcesStatus)

    renderMonitoringPage()

    expect(screen.getByLabelText('Carregando mapa e painel')).toBeInTheDocument()

    expect(await screen.findByText('Crítico: 1')).toBeInTheDocument()
    expect(screen.getByText('Normal: 1')).toBeInTheDocument()
    expect(screen.getByText('Gatilho OOH ativo: 1/2')).toBeInTheDocument()
    expect(screen.getByText('Open-Meteo')).toBeInTheDocument()
    expect(screen.getByText('ALERTA CRÍTICO DE ALAGAMENTO — Butantã')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Itaquera/i }))
    expect(screen.getByText('CONDIÇÕES NORMAIS — Itaquera')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Dia Chuvoso Real \(CGE 15\/01\/2026\)/i }))
    await waitFor(() => {
      expect(overviewMock).toHaveBeenCalledWith({ cgeDate: '15/01/2026' })
    })

    await user.click(screen.getByRole('button', { name: /Simular Crítico/i }))
    await waitFor(() => {
      expect(overviewMock).toHaveBeenCalledWith({ simulate: 'critical' })
    })
    expect(await screen.findByText(/Modo de demonstração ativo: Simular Crítico/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Técnico \(JSON \/ XML\)/i }))
    await user.click(screen.getByRole('tab', { name: /XML \/ RSS 2\.0/i }))
    await waitFor(() => {
      expect(rssMock).toHaveBeenCalled()
    })
    expect(
      await screen.findByText(/<ooh:severityLabel>CRITICO<\/ooh:severityLabel>/),
    ).toBeInTheDocument()

    expect(leafletMockState.clickHandler).not.toBeNull()
    leafletMockState.clickHandler?.({ latlng: { lat: -22.9099, lng: -47.0626 } })

    await waitFor(() => {
      expect(coordsMock).toHaveBeenCalledWith(-22.9099, -47.0626, { simulate: 'critical' })
    })
    expect(await screen.findByText('Ponto (-22.9099, -47.0626)')).toBeInTheDocument()
  })

  it('shows friendly QueryErrorAlert with recovery action when simulation params are disabled on backend', async () => {
    const user = userEvent.setup()

    vi.mocked(sourcesService.getSourcesStatus).mockResolvedValue(mockSourcesStatus)
    vi.mocked(alertsService.getCityOverview)
      .mockResolvedValueOnce(mockCityOverview)
      .mockRejectedValueOnce(
        new ApiError('Parâmetros de simulação desabilitados neste ambiente.', { status: 400 }),
      )
      .mockResolvedValueOnce(mockCityOverview)

    renderMonitoringPage()

    expect(await screen.findByText('Crítico: 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Simular Crítico/i }))

    expect(
      await screen.findByText('Parâmetros de simulação desabilitados neste ambiente.'),
    ).toBeInTheDocument()

    const backButtons = screen.getAllByRole('button', { name: /Voltar ao Tempo Real/i })
    await user.click(backButtons[backButtons.length - 1])

    expect(await screen.findByText('ALERTA CRÍTICO DE ALAGAMENTO — Butantã')).toBeInTheDocument()
  })
})
