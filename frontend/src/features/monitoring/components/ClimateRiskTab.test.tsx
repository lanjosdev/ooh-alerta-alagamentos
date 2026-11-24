import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { mockCampinasDecision, mockRegionButanta } from '@/test/fixtures/alerts'
import { ClimateRiskTab } from './ClimateRiskTab'

describe('ClimateRiskTab', () => {
  it('displays CGE station weather, 2h/6h forecast timeline and collapses flooding/INMET sections by default', async () => {
    const user = userEvent.setup()

    render(<ClimateRiskTab decision={mockRegionButanta} />)

    expect(screen.getByText('25,6 °C')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('12,4 mm')).toBeInTheDocument()
    expect(screen.getByText('25,2 mm')).toBeInTheDocument()

    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.getByText('19:00')).toBeInTheDocument()
    expect(screen.getAllByText('Tempestade com raios')).toHaveLength(2)

    const floodingToggle = screen.getByRole('button', { name: /Alagamentos na Zona \(CGE-SP\)/i })
    const inmetToggle = screen.getByRole('button', { name: /Avisos Oficiais \(INMET\)/i })

    expect(floodingToggle).toHaveAttribute('aria-expanded', 'false')
    expect(inmetToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Data CGE: 15/01/2026')).toBeInTheDocument()
    expect(screen.getByText('1 vigente')).toBeInTheDocument()
    expect(screen.queryByText('Av. Marginal Tietê')).not.toBeInTheDocument()
    expect(screen.queryByText('Chuvas Intensas — Grau Perigo')).not.toBeInTheDocument()

    await user.click(floodingToggle)
    expect(floodingToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Av. Marginal Tietê')).toBeInTheDocument()
    expect(screen.getByText('Ativo • Intransitável')).toBeInTheDocument()

    await user.click(inmetToggle)
    expect(inmetToggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Chuvas Intensas — Grau Perigo')).toBeInTheDocument()
    expect(screen.getByText('Não enfrente áreas alagadas')).toBeInTheDocument()
  })

  it('renders graceful multi-municipality fallback outside Capital SP when expanded', async () => {
    const user = userEvent.setup()

    render(<ClimateRiskTab decision={mockCampinasDecision} />)

    expect(
      screen.getByText(
        'Fora da área de cobertura do CGE-SP — usando previsão por grade e avisos do INMET.',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Chuva moderada').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('0 vigentes')).toBeInTheDocument()

    const floodingToggle = screen.getByRole('button', { name: /Alagamentos na Zona \(CGE-SP\)/i })
    const inmetToggle = screen.getByRole('button', { name: /Avisos Oficiais \(INMET\)/i })

    await user.click(floodingToggle)
    await user.click(inmetToggle)

    expect(screen.getByText('Sem cobertura CGE-SP para esta coordenada')).toBeInTheDocument()
    expect(screen.getByText('Sem avisos oficiais INMET vigentes')).toBeInTheDocument()
  })
})
