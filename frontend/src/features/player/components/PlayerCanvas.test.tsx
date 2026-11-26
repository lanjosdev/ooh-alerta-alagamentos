import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mockPlayerSceneCoordinates,
  mockPlayerSceneCritical,
  mockPlayerSceneHistorical,
  mockPlayerSceneNormal,
} from '@/test/fixtures/player'
import { maplibreMockState } from '@/test/mocks/maplibre'
import { PlayerCanvas } from './PlayerCanvas'

vi.mock('maplibre-gl', async () => {
  const { createMapLibreModuleMock } = await import('@/test/mocks/maplibre')
  return createMapLibreModuleMock()
})

vi.mock('@deck.gl/mapbox', async () => {
  const { createDeckGlMapboxMock } = await import('@/test/mocks/maplibre')
  return createDeckGlMapboxMock()
})

describe('PlayerCanvas', () => {
  beforeEach(() => {
    maplibreMockState.reset()
  })

  it('renders 9:16 portrait anatomy with white-label brand, tag, telemetry seal and accent CSS variable', () => {
    const { container } = render(
      <PlayerCanvas
        scene={mockPlayerSceneCritical}
        format="portrait"
        brandConfig={{ brand: 'Rede Paulista', tag: 'Corredor Sul', accent: '00AAFF' }}
      />,
    )

    const article = container.querySelector('article[data-player-format="portrait"]')
    expect(article).toBeInTheDocument()
    expect(article).toHaveStyle('--player-accent: #00AAFF')

    expect(screen.getAllByText('Rede Paulista').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Corredor Sul')).toBeInTheDocument()
    expect(screen.getByText('ALAGAMENTO INTRANSITÁVEL NA VIA')).toBeInTheDocument()
    expect(screen.getByText('Av. Jornalista Roberto Marinho')).toBeInTheDocument()
    expect(screen.getByText('Via com bloqueio por alagamento')).toBeInTheDocument()
    expect(screen.getByText('- TEMPO REAL -')).toBeInTheDocument()
    expect(screen.getByText('ATUALIZADO AGORA')).toBeInTheDocument()
    expect(screen.getByText('VOCÊ ESTÁ AQUI')).toBeInTheDocument()
  })

  it('renders 16:9 landscape split horizontal with historical REPLAY seal and normal state note', () => {
    const { container, rerender } = render(
      <PlayerCanvas
        scene={mockPlayerSceneHistorical}
        format="landscape"
        brandConfig={{ brand: 'Alerta OOH', tag: 'Monitoramento Urbano', accent: 'invalid' }}
      />,
    )

    const article = container.querySelector('article[data-player-format="landscape"]')
    expect(article).toBeInTheDocument()
    expect(article).toHaveStyle('--player-accent: #0057FF')
    expect(screen.getByText('- REPLAY • 24/01/2025 20:30 -')).toBeInTheDocument()
    expect(screen.getByText('REPLAY HISTÓRICO')).toBeInTheDocument()

    rerender(
      <PlayerCanvas
        scene={mockPlayerSceneNormal}
        format="landscape"
        brandConfig={{ brand: 'Alerta OOH', tag: 'Monitoramento Urbano', accent: '0057FF' }}
      />,
    )

    expect(screen.getByText('TRÂNSITO LIVRE • SEM ALAGAMENTOS')).toBeInTheDocument()
    expect(
      screen.getByText('Em produção, este ponto exibirá a campanha normal.'),
    ).toBeInTheDocument()
  })

  it('renders PONTO ALVO label in free-coordinate scenes', () => {
    render(
      <PlayerCanvas
        scene={mockPlayerSceneCoordinates}
        format="portrait"
        brandConfig={{ brand: 'Alerta OOH', tag: 'Monitoramento Urbano', accent: '0057FF' }}
      />,
    )

    expect(screen.getByText('PONTO ALVO')).toBeInTheDocument()
  })
})
