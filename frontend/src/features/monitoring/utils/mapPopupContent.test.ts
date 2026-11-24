import { describe, expect, it } from 'vitest'
import {
  mockCampinasDecision,
  mockRegionButanta,
  mockRegionItaquera,
} from '@/test/fixtures/alerts'
import type { OohAlertDecision } from '@/types/alerts'
import {
  buildDecisionPopupHtml,
  buildErrorPopupHtml,
  buildLoadingPopupHtml,
  escapeHtml,
} from './mapPopupContent'

describe('mapPopupContent', () => {
  it('escapa caracteres especiais HTML em textos dinâmicos e mensagens de erro', () => {
    expect(escapeHtml(`<script>alert("xss")</script> & 'aspas'`)).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;aspas&#39;',
    )

    const unsafeDecision: OohAlertDecision = {
      ...mockRegionButanta,
      location: {
        ...mockRegionButanta.location,
        name: 'Butantã <Teste> & "OOH"',
        zone: "Zona 'Oeste' & <Sul>",
      },
      officialAlerts: [
        {
          ...mockRegionButanta.officialAlerts[0],
          severity: 'Perigo <Extremo>',
        },
      ],
    }

    const html = buildDecisionPopupHtml(unsafeDecision)
    expect(html).toContain('Butantã &lt;Teste&gt; &amp; &quot;OOH&quot;')
    expect(html).toContain('Zona &#39;Oeste&#39; &amp; &lt;Sul&gt;')
    expect(html).toContain('1 vigente (Perigo &lt;Extremo&gt;)')
    expect(html).not.toContain('<script>')

    const errorHtml = buildErrorPopupHtml('Falha <HTTP 500> & "timeout"')
    expect(errorHtml).toContain('Falha &lt;HTTP 500&gt; &amp; &quot;timeout&quot;')
  })

  it('renderiza hierarquia completa para região crítica na Capital SP com coordenadas sutis, hero de clima e Alerta no OOH: Ativo', () => {
    const html = buildDecisionPopupHtml(mockRegionButanta)

    expect(html).toContain('ooh-popup-card--severity-3')
    expect(html).toContain('Butantã')
    expect(html).toContain('Zona Oeste • <span class="ooh-popup-coords-inline">-23.5672, -46.7290</span>')
    expect(html).toContain('Risco: Crítico • 92/100')
    expect(html).toContain('Alerta no OOH: Ativo')
    expect(html).toContain('25,6 °C')
    expect(html).toContain('Tempestade com raios')
    expect(html).toContain('Chovendo agora')
    expect(html).toContain('Acum. CGE: 12,4 mm')
    expect(html).toContain('Confirmado na estação CGE-SP • 18:00')
    expect(html).toContain('80% de chance nas próx. 2h (18,4 mm)')
    expect(html).toContain('Até 85% de chance nas próx. 6h')
    expect(html).toContain('1 ativo (1 intransitável)')
    expect(html).toContain('1 vigente (Perigo)')
    expect(html).toContain('data-ooh-action="focus-details"')
    expect(html).toContain('Ver detalhes completos →')
  })

  it('renderiza Alerta no OOH: Inativo com Campanha normal e previsão enxuta para região estável', () => {
    const html = buildDecisionPopupHtml(mockRegionItaquera)

    expect(html).toContain('ooh-popup-card--severity-0')
    expect(html).toContain('Itaquera')
    expect(html).toContain('Zona Leste • <span class="ooh-popup-coords-inline">-23.5419, -46.4563</span>')
    expect(html).toContain('Risco: Normal • 12/100')
    expect(html).toContain('Alerta no OOH: Inativo')
    expect(html).toContain('Campanha normal')
    expect(html).toContain('24,1 °C')
    expect(html).toContain('Parcialmente nublado')
    expect(html).toContain('Sem chuva no momento')
    expect(html).toContain('Estimado na grade (Open-Meteo) • 18:00')
    expect(html).not.toContain('Acum. CGE')
    expect(html).toContain('15% de chance nas próx. 2h')
    expect(html).not.toContain('(0,0 mm)')
    expect(html).toContain('Sem alagamentos ativos')
    expect(html).toContain('Sem avisos vigentes')
  })

  it('evita duplicar coordenadas quando o nome já as contém e exibe chuva atual fora da Capital SP', () => {
    const html = buildDecisionPopupHtml(mockCampinasDecision)

    expect(html).toContain('Ponto (-22.9099, -47.0626)')
    expect(html).toContain('Fora da Capital SP')
    expect(html).toContain('Risco: Atenção • 44/100')
    expect(html).toContain('Alerta no OOH: Ativo')
    expect(html).toContain('22,8 °C')
    expect(html).toContain('Chuva moderada')
    expect(html).toContain('Chovendo agora')
    expect(html).toContain('Chuva atual: 1,4 mm')
    expect(html).toContain('Estimado na grade (Open-Meteo) • 18:00')
    expect(html).toContain('65% de chance nas próx. 2h (5,5 mm)')
    expect(html).toContain('Até 70% de chance nas próx. 6h')
    expect(html).toContain('Fora da cobertura CGE-SP')
    expect(html).toContain('Sem avisos vigentes')
  })

  it('exibe Possível garoa na região para sinal fraco da grade', () => {
    const drizzleDecision: OohAlertDecision = {
      ...mockCampinasDecision,
      forecast: {
        ...mockCampinasDecision.forecast!,
        current: {
          observedAt: '2026-11-23T18:15',
          temperatureC: 21.5,
          humidityPercent: 79,
          precipitationMm: 0.1,
          rainMm: 0.1,
          weatherCode: 51,
          isDay: false,
          isRaining: false,
        },
      },
    }

    const html = buildDecisionPopupHtml(drizzleDecision)
    expect(html).toContain('21,5 °C')
    expect(html).toContain('Garoa leve')
    expect(html).toContain('Possível garoa na região')
    expect(html).toContain('Estimado na grade (Open-Meteo) • 18:15')
  })

  it('gera markup compacto para estados de loading e erro', () => {
    const loadingHtml = buildLoadingPopupHtml(-22.9099, -47.0626)
    expect(loadingHtml).toContain('Consultando coordenada...')
    expect(loadingHtml).toContain('-22.9099, -47.0626')

    const errorHtml = buildErrorPopupHtml('Não foi possível conectar ao servidor da API.')
    expect(errorHtml).toContain('Falha na consulta')
    expect(errorHtml).toContain('Não foi possível conectar ao servidor da API.')
  })
})
