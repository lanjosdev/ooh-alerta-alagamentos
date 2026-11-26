import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockSourcesStatus } from '@/test/fixtures/alerts'
import { TopControlBar } from './TopControlBar'

describe('TopControlBar', () => {
  it('disables Simular button with explanatory title when backend simulation capability is false', () => {
    render(
      <TopControlBar
        selection={{ mode: 'realtime' }}
        onChangeSelection={vi.fn()}
        simulationEnabled={false}
        sourcesStatus={mockSourcesStatus}
        isSourcesLoading={false}
        isSourcesError={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    )

    const simulateButton = screen.getByRole('button', { name: /Simular/i })
    expect(simulateButton).toBeDisabled()
    expect(simulateButton).toHaveAttribute(
      'title',
      'Simulação desabilitada no backend (ENABLE_SIMULATION_PARAMS=false)',
    )
  })

  it('applies historical shortcut 24/01/2025 • 20:30 and custom replay date/time', async () => {
    const user = userEvent.setup()
    const onChangeSelection = vi.fn()

    render(
      <TopControlBar
        selection={{ mode: 'realtime' }}
        onChangeSelection={onChangeSelection}
        simulationEnabled={true}
        sourcesStatus={mockSourcesStatus}
        isSourcesLoading={false}
        isSourcesError={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Histórico/i }))
    await user.click(screen.getByRole('button', { name: /24\/01\/2025 • 20:30/i }))

    expect(onChangeSelection).toHaveBeenCalledWith({
      mode: 'historical',
      date: '2025-01-24',
      time: '20:30',
    })

    await user.click(screen.getByRole('button', { name: /Simular/i }))
    await user.click(screen.getByRole('menuitemradio', { name: /Crítico/i }))

    expect(onChangeSelection).toHaveBeenCalledWith({
      mode: 'simulated',
      simulate: 'critical',
    })
  })

  it('shows lastErrorMessage in sources popover when a provider is degraded', async () => {
    const user = userEvent.setup()

    render(
      <TopControlBar
        selection={{ mode: 'realtime' }}
        onChangeSelection={vi.fn()}
        simulationEnabled={true}
        sourcesStatus={{
          checkedAt: '2026-11-25T18:00:00',
          providers: [
            ...mockSourcesStatus.providers,
            {
              provider: 'overpass',
              status: 'degraded',
              cachedKeys: 0,
              lastSuccessAt: null,
              lastErrorAt: '2026-11-25T18:00:00',
              lastErrorMessage: 'Overpass respondeu HTTP 502',
              lastLatencyMs: 5400,
            },
          ],
        }}
        isSourcesLoading={false}
        isSourcesError={false}
        isRefreshing={false}
        onRefresh={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Fontes: atenção/i }))
    expect(screen.getByText('Overpass OSM')).toBeInTheDocument()
    expect(screen.getByText('Overpass respondeu HTTP 502')).toBeInTheDocument()
  })
})
