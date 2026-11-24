import { describe, expect, it } from 'vitest'
import type { OohAlertDecision } from '../services/alerts/alert-types.js'
import { OOH_XML_NAMESPACE, escapeXml, formatAlertsAsRss } from './rss-formatter.js'

function makeDecision(
  id: string,
  name: string,
  current: NonNullable<OohAlertDecision['forecast']>['current'] = {
    observedAt: '2026-11-23T18:00',
    temperatureC: 24.5,
    humidityPercent: 82,
    precipitationMm: 3.4,
    rainMm: 3.4,
    weatherCode: 95,
    isDay: false,
    isRaining: true,
  },
): OohAlertDecision {
  return {
    evaluatedAt: '2026-11-23T18:00:00.000Z',
    location: {
      id,
      name,
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
    triggerOverride: true,
    severityLevel: 3,
    severityLabel: 'CRITICO',
    riskScore: 95,
    simulated: false,
    reasons: ['Alagamento ativo'],
    display: {
      headline: `ALERTA <CRÍTICO> & "OOH" — ${name}`,
      message: "Evite AV CORIFEU & 'rotas baixas'.",
      subtext: `${name} • Nível CRITICO (95/100)`,
    },
    forecast: {
      provider: 'open-meteo',
      gridLatitude: -23.58,
      gridLongitude: -46.75,
      timezone: 'America/Sao_Paulo',
      current,
      maxRainProbabilityNext2hPercent: 90,
      expectedRainNext2hMm: 22,
      peakRainIntensityNext2hMmPerHour: 15,
      maxRainProbabilityNext6hPercent: 90,
      expectedRainNext6hMm: 28,
      hourly: [],
    },
    officialAlerts: [],
    flooding: {
      cgeDate: null,
      activeInZoneCount: 1,
      impassableInZoneCount: 1,
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
        fetchedAt: '2026-11-23T18:00:00.000Z',
        error: null,
      },
      officialAlerts: {
        provider: 'inmet',
        status: 'ok',
        cached: false,
        stale: false,
        fetchedAt: '2026-11-23T18:00:00.000Z',
        error: null,
      },
      floodingMonitor: {
        provider: 'cge-sp',
        status: 'ok',
        cached: false,
        stale: false,
        fetchedAt: '2026-11-23T18:00:00.000Z',
        error: null,
      },
    },
  }
}

describe('rss-formatter', () => {
  it('escapa todos os caracteres reservados XML rigorosamente', () => {
    expect(escapeXml(`A & B <tag> "aspas" 'simples'`)).toBe(
      'A &amp; B &lt;tag&gt; &quot;aspas&quot; &apos;simples&apos;',
    )
  })

  it('gera RSS 2.0 válido com namespace ooh e escapa texto nas tags', () => {
    const xml = formatAlertsAsRss({
      title: 'Feed OOH & Alertas <SP>',
      link: 'http://localhost:3333/v1/alerts/feed.xml?a=1&b=2',
      description: 'Alertas para painéis DOOH',
      decisions: [
        makeDecision('zona-oeste-butanta', 'Butantã'),
        makeDecision('zona-oeste-lapa', 'Lapa'),
      ],
      generatedAt: new Date('2026-11-23T18:00:00.000Z'),
    })

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain(`<rss version="2.0" xmlns:ooh="${OOH_XML_NAMESPACE}">`)
    expect(xml).toContain('<title>Feed OOH &amp; Alertas &lt;SP&gt;</title>')
    expect(xml).toContain('<link>http://localhost:3333/v1/alerts/feed.xml?a=1&amp;b=2</link>')
    expect(xml).toContain(
      '<ooh:headline>ALERTA &lt;CRÍTICO&gt; &amp; &quot;OOH&quot; — Butantã</ooh:headline>',
    )
    expect(xml).toContain(
      '<ooh:message>Evite AV CORIFEU &amp; &apos;rotas baixas&apos;.</ooh:message>',
    )
    expect(xml).toContain('<ooh:triggerOverride>true</ooh:triggerOverride>')
    expect(xml).toContain('<ooh:severityLevel>3</ooh:severityLevel>')
    expect(xml).toContain('<ooh:rainProbabilityNext2hPercent>90</ooh:rainProbabilityNext2hPercent>')
    expect(xml).toContain('<ooh:isRainingNow>true</ooh:isRainingNow>')
    expect(xml).toContain('<ooh:activeFloodingsInZone>1</ooh:activeFloodingsInZone>')
    expect(xml.match(/<item>/g)).toHaveLength(2)
  })

  it('serializa ooh:isRainingNow como false quando seco e vazio quando forecast.current é null', () => {
    const dryDecision = makeDecision('zona-leste-itaquera', 'Itaquera', {
      observedAt: '2026-11-23T18:00',
      temperatureC: 22.1,
      humidityPercent: 60,
      precipitationMm: 0,
      rainMm: 0,
      weatherCode: 2,
      isDay: false,
      isRaining: false,
    })
    const unavailableDecision = makeDecision('zona-sul-santo-amaro', 'Santo Amaro', null)

    const xml = formatAlertsAsRss({
      title: 'Feed OOH',
      link: 'http://localhost:3333/v1/alerts/feed.xml',
      description: 'Alertas OOH',
      decisions: [dryDecision, unavailableDecision],
      generatedAt: new Date('2026-11-23T18:00:00.000Z'),
    })

    expect(xml).toContain('<ooh:isRainingNow>false</ooh:isRainingNow>')
    expect(xml).toContain('<ooh:isRainingNow></ooh:isRainingNow>')
  })
})
