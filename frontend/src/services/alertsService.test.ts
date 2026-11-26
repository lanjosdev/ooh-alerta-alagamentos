import { describe, expect, it, vi } from 'vitest'
import { getValidatedEnv } from '@/env'
import { apiClient } from '@/lib/api'
import type { CityOverviewData, OohAlertDecision } from '@/types/alerts'
import { alertsService } from './alertsService'

const sampleDecision: OohAlertDecision = {
  evaluatedAt: '2026-11-23T19:00:00.000Z',
  temporal: {
    mode: 'realtime',
    date: null,
    time: null,
    resolvedTime: null,
    referenceAt: '2026-11-23T16:00:00-03:00',
  },
  location: {
    id: 'zona-oeste-butanta',
    name: 'Butantã',
    city: 'São Paulo',
    state: 'SP',
    ibgeCode: '3550308',
    zone: 'Zona Oeste',
    latitude: -23.5672,
    longitude: -46.729,
    cgeStationId: '1000842',
    cgeStationName: 'Butantã',
    historicalRiskWeight: 0.75,
  },
  triggerOverride: false,
  severityLevel: 0,
  severityLabel: 'NORMAL',
  riskScore: 10,
  simulated: false,
  reasons: ['Condições dentro dos limites operacionais normais'],
  display: {
    headline: 'TEMPO ESTÁVEL — Butantã',
    message: 'Sem risco elevado de alagamento nas próximas horas.',
    subtext: 'Butantã (Zona Oeste) • Nível NORMAL (10/100)',
  },
  forecast: null,
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
    forecast: {
      provider: 'open-meteo',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-23T19:00:00.000Z',
      error: null,
    },
    officialAlerts: {
      provider: 'inmet',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-23T19:00:00.000Z',
      error: null,
    },
    floodingMonitor: {
      provider: 'cge-sp',
      status: 'ok',
      cached: false,
      stale: false,
      fetchedAt: '2026-11-23T19:00:00.000Z',
      error: null,
    },
  },
}

const sampleOverview: CityOverviewData = {
  generatedAt: '2026-11-23T19:00:00.000Z',
  summary: {
    totalRegions: 1,
    overrideActiveCount: 0,
    highestSeverityLevel: 0,
    highestSeverityLabel: 'NORMAL',
    countsBySeverity: {
      NORMAL: 1,
      ATENCAO: 0,
      ALERTA: 0,
      CRITICO: 0,
    },
  },
  regions: [sampleDecision],
}

describe('alertsService', () => {
  it('fetches city overview and unwraps ApiResponse envelope', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        message: null,
        data: sampleOverview,
      },
    })

    const result = await alertsService.getCityOverview({
      cgeDate: '15/01/2026',
      zone: 'Zona Oeste',
    })

    expect(getSpy).toHaveBeenCalledWith('/alerts/regions', {
      params: {
        cgeDate: '15/01/2026',
        zone: 'Zona Oeste',
      },
    })
    expect(result).toEqual(sampleOverview)
  })

  it('fetches region alert and omits undefined scenario parameters', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        message: null,
        data: sampleDecision,
      },
    })

    const result = await alertsService.getRegionAlert('zona-oeste-butanta', {})

    expect(getSpy).toHaveBeenCalledWith('/alerts/regions/zona-oeste-butanta', {
      params: {},
    })
    expect(result).toEqual(sampleDecision)
  })

  it('fetches coordinates alert with lat, lon and simulation param', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        message: null,
        data: sampleDecision,
      },
    })

    const result = await alertsService.getCoordinatesAlert(-23.5317, -46.7294, {
      simulate: 'critical',
    })

    expect(getSpy).toHaveBeenCalledWith('/alerts/by-coordinates', {
      params: {
        lat: -23.5317,
        lon: -46.7294,
        simulate: 'critical',
      },
    })
    expect(result).toEqual(sampleDecision)
  })

  it('fetches raw XML RSS 2.0 feed for both region and coordinates targets', async () => {
    const xmlPayload = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"></rss>'
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      status: 200,
      data: xmlPayload,
    })

    const regionXml = await alertsService.getRssFeedXml(
      { kind: 'region', regionId: 'zona-oeste-butanta' },
      { cgeDate: '15/01/2026' },
    )
    expect(regionXml).toBe(xmlPayload)
    expect(getSpy).toHaveBeenNthCalledWith(1, '/alerts/regions/zona-oeste-butanta/feed.xml', {
      params: { cgeDate: '15/01/2026' },
      responseType: 'text',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })

    const coordsXml = await alertsService.getRssFeedXml({
      kind: 'coordinates',
      lat: -22.9099,
      lon: -47.0626,
    })
    expect(coordsXml).toBe(xmlPayload)
    expect(getSpy).toHaveBeenNthCalledWith(2, '/alerts/by-coordinates/feed.xml', {
      params: { lat: -22.9099, lon: -47.0626 },
      responseType: 'text',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    })
  })

  it('builds copyable endpoint URLs for JSON and XML formats', () => {
    const baseUrl = getValidatedEnv().VITE_API_BASE_URL

    expect(
      alertsService.buildAlertEndpointUrl(
        { kind: 'region', regionId: 'zona-oeste-butanta' },
        'json',
      ),
    ).toBe(`${baseUrl}/alerts/regions/zona-oeste-butanta`)

    expect(
      alertsService.buildAlertEndpointUrl(
        { kind: 'region', regionId: 'zona-oeste-butanta' },
        'xml',
        { cgeDate: '15/01/2026' },
      ),
    ).toBe(`${baseUrl}/alerts/regions/zona-oeste-butanta/feed.xml?cgeDate=15%2F01%2F2026`)

    expect(
      alertsService.buildAlertEndpointUrl(
        { kind: 'coordinates', lat: -23.5317, lon: -46.7294 },
        'xml',
        { simulate: 'alert', date: '2025-01-24', time: '20:30' },
      ),
    ).toBe(
      `${baseUrl}/alerts/by-coordinates/feed.xml?lat=-23.5317&lon=-46.7294&simulate=alert`,
    )

    expect(
      alertsService.buildAlertEndpointUrl(
        { kind: 'region', regionId: 'zona-oeste-butanta' },
        'json',
        { date: '2025-01-24', time: '20:30' },
      ),
    ).toBe(`${baseUrl}/alerts/regions/zona-oeste-butanta?date=2025-01-24&time=20%3A30`)
  })
})
