import { describe, expect, it, vi } from 'vitest'
import inmetSample from './__fixtures__/inmet-avisos-sample.json' with { type: 'json' }
import { InmetAlertsProvider } from './inmet-alerts-provider.js'

describe('InmetAlertsProvider', () => {
  it('filtra por IBGE e polígono, deduplica hoje/futuro, ignora encerrados e ordena por severidade', async () => {
    const fetchFn: typeof fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(inmetSample), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )

    const provider = new InmetAlertsProvider({ fetchFn })
    const spAlerts = await provider.getActiveAlerts({
      ibgeCode: '3550308',
      lat: -23.5505,
      lon: -46.6333,
    })

    // 56494 (Perigo, rank 2, IBGE, polígono malformado ignorado) + 56489 (Perigo Potencial, rank 1, hoje tem prioridade)
    expect(spAlerts).toHaveLength(2)
    expect(spAlerts[0]).toMatchObject({
      id: '56494',
      title: 'Tempestade',
      severity: 'Perigo',
      severityRank: 2,
      matchedBy: ['ibge'],
    })
    expect(spAlerts[1]).toMatchObject({
      id: '56489',
      title: 'Chuvas Intensas',
      severity: 'Perigo Potencial',
      severityRank: 1,
      risks: ['Chuva entre 20 e 30 mm/h ou até 50 mm/dia.'],
      instructions: ['Evite áreas sujeitas a alagamentos.'],
      matchedBy: ['ibge', 'polygon'],
    })
  })

  it('corresponde alertas multi-município apenas por polígono GeoJSON quando ibgeCode está ausente', async () => {
    const fetchFn: typeof fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(inmetSample), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    )

    const provider = new InmetAlertsProvider({ fetchFn })
    const campinasAlerts = await provider.getActiveAlerts({
      lat: -22.9099,
      lon: -47.0626,
    })

    expect(campinasAlerts).toHaveLength(1)
    expect(campinasAlerts[0]).toMatchObject({
      id: '56499',
      severityRank: 2,
      matchedBy: ['polygon'],
    })
  })

  it('lança erro quando INMET retorna erro HTTP', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => new Response('Error', { status: 500 }))
    const provider = new InmetAlertsProvider({ fetchFn })

    await expect(provider.getActiveAlerts({ lat: -23.55, lon: -46.63 })).rejects.toThrow(
      'INMET respondeu HTTP 500',
    )
  })
})
