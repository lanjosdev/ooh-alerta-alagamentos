import { describe, expect, it } from 'vitest'
import type { FloodingPoint } from '../../providers/flooding-monitor-provider.js'
import type { RegionForecast } from '../../providers/forecast-provider.js'
import { BuildOohMessageService } from './build-ooh-message-service.js'

const sampleForecast: RegionForecast = {
  provider: 'open-meteo',
  gridLatitude: -23.56,
  gridLongitude: -46.72,
  timezone: 'America/Sao_Paulo',
  maxRainProbabilityNext2hPercent: 85,
  expectedRainNext2hMm: 18,
  peakRainIntensityNext2hMmPerHour: 12,
  maxRainProbabilityNext6hPercent: 85,
  expectedRainNext6hMm: 25,
  hourly: [],
}

describe('BuildOohMessageService', () => {
  const service = new BuildOohMessageService()

  it('cita região, probabilidade % e no máximo 2 vias ativas priorizando intransitáveis', () => {
    const points: FloodingPoint[] = [
      {
        zone: 'Zona Oeste',
        neighborhood: 'Pinheiros',
        street: 'RUA TEODORO SAMPAIO',
        direction: 'AMBOS',
        reference: null,
        timeWindow: 'Desde 16:00',
        status: 'ativo-transitavel',
        active: true,
        passable: true,
      },
      {
        zone: 'Zona Oeste',
        neighborhood: 'Butantã',
        street: 'AV CORIFEU DE AZEVEDO MARQUES',
        direction: 'BAIRRO/CENTRO',
        reference: 'N 1200',
        timeWindow: 'Desde 16:10',
        status: 'ativo-intransitavel',
        active: true,
        passable: false,
      },
      {
        zone: 'Zona Oeste',
        neighborhood: 'Lapa',
        street: 'AV MARGINAL TIETE',
        direction: 'LESTE/OESTE',
        reference: 'PTE PIQUERI',
        timeWindow: 'Desde 16:15',
        status: 'ativo-intransitavel',
        active: true,
        passable: false,
      },
    ]

    const display = service.execute({
      locationName: 'Butantã',
      zone: 'Zona Oeste',
      evaluation: {
        severityLevel: 3,
        severityLabel: 'CRITICO',
        triggerOverride: true,
        riskScore: 95,
        simulated: false,
        reasons: ['Alagamento ativo'],
      },
      forecast: sampleForecast,
      floodingPointsInZone: points,
      officialAlerts: [],
    })

    expect(display.headline).toContain('CRÍTICO')
    expect(display.headline).toContain('Butantã')
    expect(display.message).toContain('85%')
    expect(display.message).toContain('AV CORIFEU DE AZEVEDO MARQUES')
    expect(display.message).toContain('AV MARGINAL TIETE')
    expect(display.message).not.toContain('RUA TEODORO SAMPAIO')
    expect(display.subtext).toContain('Zona Oeste')
    expect(display.subtext).toContain('95/100')
  })

  it('gera mensagem adequada para cenário normal e cenário simulado sem previsão', () => {
    const normal = service.execute({
      locationName: 'Vila Mariana',
      zone: 'Zona Sul',
      evaluation: {
        severityLevel: 0,
        severityLabel: 'NORMAL',
        triggerOverride: false,
        riskScore: 10,
        simulated: false,
        reasons: ['Normal'],
      },
      forecast: sampleForecast,
      floodingPointsInZone: [],
      officialAlerts: [],
    })

    expect(normal.headline).toContain('TEMPO ESTÁVEL')
    expect(normal.message).toContain('85%')

    const simulated = service.execute({
      locationName: 'Campinas',
      zone: null,
      evaluation: {
        severityLevel: 2,
        severityLabel: 'ALERTA',
        triggerOverride: true,
        riskScore: 75,
        simulated: true,
        reasons: ['Simulação'],
      },
      forecast: null,
      floodingPointsInZone: [],
      officialAlerts: [],
    })

    expect(simulated.headline).toContain('Campinas')
    expect(simulated.subtext).toContain('SIMULAÇÃO')
  })
})
