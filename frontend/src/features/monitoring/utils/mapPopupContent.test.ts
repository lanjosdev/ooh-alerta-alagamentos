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
    expect(html).toContain('1 aviso vigente (Perigo &lt;Extremo&gt;)')
    expect(html).not.toContain('<script>')

    const errorHtml = buildErrorPopupHtml('Falha <HTTP 500> & "timeout"')
    expect(errorHtml).toContain('Falha &lt;HTTP 500&gt; &amp; &quot;timeout&quot;')
  })

  it('renderiza resumo completo para região crítica na Capital SP com CGE, INMET e Gatilho ATIVO', () => {
    const html = buildDecisionPopupHtml(mockRegionButanta)

    expect(html).toContain('Butantã')
    expect(html).toContain('Zona Oeste')
    expect(html).toContain('Crítico')
    expect(html).toContain('Risco: 92/100')
    expect(html).toContain('Gatilho OOH: ATIVO')
    expect(html).toContain('Chovendo agora • Tempestade com raios • 25,6 °C • Acum. CGE: 12,4 mm')
    expect(html).toContain('80% • 18,4 mm • 6h: 85%')
    expect(html).toContain('1 ativo (1 intransitável)')
    expect(html).toContain('1 aviso vigente (Perigo)')
    expect(html).toContain('data-ooh-action="focus-details"')
    expect(html).toContain('Ver detalhes completos')
  })

  it('renderiza Campanha Padrão e Sem chuva no momento para região estável', () => {
    const html = buildDecisionPopupHtml(mockRegionItaquera)

    expect(html).toContain('Itaquera')
    expect(html).toContain('Normal')
    expect(html).toContain('Risco: 12/100')
    expect(html).toContain('Campanha Padrão')
    expect(html).toContain('Sem chuva no momento • Parcialmente nublado • 24,1 °C')
    expect(html).not.toContain('Acum. CGE')
    expect(html).toContain('Sem alagamentos ativos')
    expect(html).toContain('Sem avisos vigentes')
  })

  it('exibe Fora da cobertura CGE-SP e temperatura de forecast.current fora da Capital SP', () => {
    const html = buildDecisionPopupHtml(mockCampinasDecision)

    expect(html).toContain('Ponto (-22.9099, -47.0626)')
    expect(html).toContain('Atenção')
    expect(html).toContain('Gatilho OOH: ATIVO')
    expect(html).toContain('Chovendo agora • Chuva moderada • 22,8 °C')
    expect(html).toContain('Fora da cobertura CGE-SP')
    expect(html).toContain('Sem avisos vigentes')
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
