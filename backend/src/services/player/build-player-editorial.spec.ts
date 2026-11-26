import { describe, expect, it } from 'vitest'
import type { OohAlertDecision, SourceExecutionStatus } from '../alerts/alert-types.js'
import { buildPlayerEditorial } from './build-player-editorial.js'

function okStatus(provider: string): SourceExecutionStatus {
  return {
    provider,
    status: 'ok',
    cached: false,
    stale: false,
    fetchedAt: '2026-11-25T15:00:00.000Z',
    error: null,
  }
}

function makeDecision(overrides: Partial<OohAlertDecision>): OohAlertDecision {
  return {
    evaluatedAt: '2026-11-25T15:00:00.000Z',
    temporal: {
      mode: 'realtime',
      date: null,
      time: null,
      resolvedTime: null,
      referenceAt: '2026-11-25T12:00:00-03:00',
    },
    location: {
      id: 'coord:-23.6217,-46.6869',
      name: 'São Paulo — próximo a Santo Amaro',
      city: 'São Paulo',
      state: 'SP',
      ibgeCode: '3550308',
      zone: 'Zona Sul',
      latitude: -23.6217,
      longitude: -46.6869,
      cgeStationId: '1000852',
      cgeStationName: 'Santo Amaro',
      historicalRiskWeight: 0.85,
    },
    triggerOverride: false,
    severityLevel: 0,
    severityLabel: 'NORMAL',
    riskScore: 10,
    simulated: false,
    reasons: [],
    display: {
      headline: 'TEMPO ESTÁVEL',
      message: 'Sem alertas',
      subtext: 'Normal',
    },
    forecast: {
      provider: 'open-meteo',
      gridLatitude: -23.62,
      gridLongitude: -46.69,
      timezone: 'America/Sao_Paulo',
      current: null,
      maxRainProbabilityNext2hPercent: 20,
      expectedRainNext2hMm: 0,
      peakRainIntensityNext2hMmPerHour: 0,
      maxRainProbabilityNext6hPercent: 20,
      expectedRainNext6hMm: 0,
      hourly: [],
    },
    officialAlerts: [],
    flooding: {
      cgeDate: null,
      activeInZoneCount: 0,
      impassableInZoneCount: 0,
      passableInZoneCount: 0,
      pointsInZone: [],
      stationRainfall: null,
    },
    sources: {
      forecast: okStatus('open-meteo'),
      officialAlerts: okStatus('inmet'),
      floodingMonitor: okStatus('cge-sp'),
    },
    ...overrides,
  }
}

describe('buildPlayerEditorial', () => {
  it('gera textos em PT-BR e selos para TEMPO REAL, REPLAY HISTÓRICO e SIMULAÇÃO', () => {
    const realtimeEditorial = buildPlayerEditorial({
      decision: makeDecision({ severityLevel: 0, severityLabel: 'NORMAL' }),
      corridorNameOverride: 'Av. Jornalista Roberto Marinho',
      hasGeoSampaData: true,
      sources: {
        forecast: okStatus('open-meteo'),
        officialAlerts: okStatus('inmet'),
        floodingMonitor: okStatus('cge-sp'),
        roadGeometry: okStatus('osm-curated-snapshot'),
        floodSusceptibility: okStatus('geosampa-wfs'),
      },
    })

    expect(realtimeEditorial).toEqual({
      headline: 'TRÂNSITO LIVRE • SEM ALAGAMENTOS',
      corridorName: 'Av. Jornalista Roberto Marinho',
      riskWindowLabel: 'Sem risco no momento',
      statusNote: 'Via sem risco no momento • Monitoramento ativo',
      sourcesLabel: 'Dados CGE-SP / INMET / Open-Meteo / GeoSampa',
      telemetryModeLabel: 'TEMPO REAL',
      telemetryStatusPill: 'ATUALIZADO AGORA',
    })

    const replayEditorial = buildPlayerEditorial({
      decision: makeDecision({
        severityLevel: 3,
        severityLabel: 'CRITICO',
        triggerOverride: true,
        temporal: {
          mode: 'historical',
          date: '2025-01-24',
          time: '20:30',
          resolvedTime: '20:30',
          referenceAt: '2025-01-24T20:30:00-03:00',
        },
        flooding: {
          cgeDate: '24/01/2025',
          activeInZoneCount: 2,
          impassableInZoneCount: 1,
          passableInZoneCount: 1,
          pointsInZone: [],
          stationRainfall: null,
        },
      }),
      corridorNameOverride: 'Marginal Pinheiros',
      hasGeoSampaData: false,
      sources: {
        forecast: okStatus('open-meteo-historical'),
        officialAlerts: { ...okStatus('inmet'), status: 'skipped' },
        floodingMonitor: okStatus('cge-sp'),
        roadGeometry: okStatus('osm-curated-snapshot'),
        floodSusceptibility: { ...okStatus('geosampa-wfs'), status: 'error' },
      },
    })

    expect(replayEditorial.headline).toBe('ALAGAMENTO INTRANSITÁVEL NA VIA')
    expect(replayEditorial.telemetryModeLabel).toBe('REPLAY • 24/01/2025 20:30')
    expect(replayEditorial.telemetryStatusPill).toBe('REPLAY HISTÓRICO')
    expect(replayEditorial.sourcesLabel).toBe('Dados CGE-SP / Open-Meteo Histórico')

    const simEditorial = buildPlayerEditorial({
      decision: makeDecision({
        severityLevel: 2,
        severityLabel: 'ALERTA',
        simulated: true,
        temporal: {
          mode: 'simulated',
          date: null,
          time: null,
          resolvedTime: null,
          referenceAt: '2026-11-25T12:00:00-03:00',
        },
      }),
      hasGeoSampaData: true,
      sources: {
        forecast: okStatus('open-meteo'),
        officialAlerts: okStatus('inmet'),
        floodingMonitor: okStatus('cge-sp'),
        roadGeometry: okStatus('overpass'),
        floodSusceptibility: okStatus('geosampa-wfs'),
      },
    })

    expect(simEditorial.telemetryModeLabel).toBe('SIMULAÇÃO')
    expect(simEditorial.telemetryStatusPill).toBe('MODO SIMULADO')
  })
})
