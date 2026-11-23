import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClimateRiskTab } from './ClimateRiskTab'
import { mockCampinasDecision, mockRegionButanta } from '@/test/fixtures/alerts'

describe('ClimateRiskTab', () => {
  it('displays CGE station weather, 2h/6h forecast timeline, active floodings and INMET alerts', () => {
    render(<ClimateRiskTab decision={mockRegionButanta} />)

    expect(screen.getByText('25,6 °C')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('12,4 mm')).toBeInTheDocument()
    expect(screen.getByText('25,2 mm')).toBeInTheDocument()

    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.getByText('19:00')).toBeInTheDocument()
    expect(screen.getAllByText('Tempestade com raios')).toHaveLength(2)

    expect(screen.getByText('Av. Marginal Tietê')).toBeInTheDocument()
    expect(screen.getByText('Ativo • Intransitável')).toBeInTheDocument()
    expect(screen.getByText('Data CGE: 15/01/2026')).toBeInTheDocument()

    expect(screen.getByText('Chuvas Intensas — Grau Perigo')).toBeInTheDocument()
    expect(screen.getByText('Não enfrente áreas alagadas')).toBeInTheDocument()
  })

  it('renders graceful multi-municipality fallback outside Capital SP when stationRainfall is null', () => {
    render(<ClimateRiskTab decision={mockCampinasDecision} />)

    expect(
      screen.getByText(
        'Fora da área de cobertura do CGE-SP — usando previsão por grade e avisos do INMET.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Chuva moderada').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sem cobertura CGE-SP para esta coordenada')).toBeInTheDocument()
    expect(screen.getByText('Sem avisos oficiais INMET vigentes')).toBeInTheDocument()
  })
})
