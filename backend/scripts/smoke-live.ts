import { buildApp } from '../src/app.js'
import type { SourceHealthSnapshot } from '../src/lib/cache.js'
import { logger } from '../src/lib/logger.js'
import type { OohAlertDecision } from '../src/services/alerts/alert-types.js'

interface Envelope<T> {
  success: boolean
  message: string | null
  data: T | null
}

function assertCondition(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function writeLine(text: string): void {
  process.stdout.write(`${text}\n`)
}

async function runLiveSmokeChecks(): Promise<void> {
  const app = await buildApp({ enableSimulationParams: true })
  await app.ready()

  try {
    writeLine('=== Smoke Test Ao Vivo: OOH Alerta Alagamentos ===')

    // 1. Duas regiões opostas em São Paulo (diferenciação de grade Open-Meteo)
    const itaqueraRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/zona-leste-itaquera',
    })
    const butantaRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/zona-oeste-butanta',
    })

    assertCondition(itaqueraRes.statusCode === 200, `Itaquera retornou HTTP ${itaqueraRes.statusCode}`)
    assertCondition(butantaRes.statusCode === 200, `Butantã retornou HTTP ${butantaRes.statusCode}`)

    const itaqueraBody = itaqueraRes.json() as Envelope<OohAlertDecision>
    const butantaBody = butantaRes.json() as Envelope<OohAlertDecision>

    assertCondition(
      itaqueraBody.success && itaqueraBody.data !== null,
      'Payload inválido para Itaquera',
    )
    assertCondition(
      butantaBody.success && butantaBody.data !== null,
      'Payload inválido para Butantã',
    )

    const itaquera = itaqueraBody.data
    const butanta = butantaBody.data

    assertCondition(itaquera.forecast !== null, 'Open-Meteo não retornou previsão para Itaquera')
    assertCondition(butanta.forecast !== null, 'Open-Meteo não retornou previsão para Butantã')
    assertCondition(
      itaquera.forecast.gridLatitude !== butanta.forecast.gridLatitude ||
        itaquera.forecast.gridLongitude !== butanta.forecast.gridLongitude,
      'Esperava células de grade distintas entre Itaquera e Butantã',
    )

    writeLine(
      `[OK] 1. Grade diferenciada: Itaquera (${itaquera.forecast.gridLatitude}, ${itaquera.forecast.gridLongitude}, ${itaquera.forecast.maxRainProbabilityNext2hPercent}% 2h) vs Butantã (${butanta.forecast.gridLatitude}, ${butanta.forecast.gridLongitude}, ${butanta.forecast.maxRainProbabilityNext2hPercent}% 2h)`,
    )

    // 2. Consulta histórica CGE-SP (15/01/2026)
    const historicalRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/zona-oeste-butanta?cgeDate=15/01/2026',
    })
    assertCondition(
      historicalRes.statusCode === 200,
      `Butantã cgeDate retornou HTTP ${historicalRes.statusCode}`,
    )

    const historicalBody = historicalRes.json() as Envelope<OohAlertDecision>
    assertCondition(
      historicalBody.success && historicalBody.data !== null,
      'Payload inválido para Butantã histórico',
    )
    assertCondition(
      historicalBody.data.flooding.cgeDate === '15/01/2026',
      'cgeDate não preservado no retorno',
    )
    assertCondition(
      historicalBody.data.flooding.pointsInZone.length >= 1,
      'Esperava ao menos 1 registro histórico de alagamento do CGE-SP na Zona Oeste em 15/01/2026',
    )

    writeLine(
      `[OK] 2. Histórico CGE-SP (15/01/2026): ${historicalBody.data.flooding.pointsInZone.length} ponto(s) parseado(s) na Zona Oeste (severity=${historicalBody.data.severityLabel})`,
    )

    // 3. Coordenada em bairro fora das 12 regiões nomeadas (Vila Leopoldina -> Lapa 1000848)
    const vilaLeopoldinaRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates?lat=-23.5317&lon=-46.7294',
    })
    assertCondition(
      vilaLeopoldinaRes.statusCode === 200,
      `Vila Leopoldina retornou HTTP ${vilaLeopoldinaRes.statusCode}`,
    )

    const vilaLeopoldinaBody = vilaLeopoldinaRes.json() as Envelope<OohAlertDecision>
    assertCondition(
      vilaLeopoldinaBody.success && vilaLeopoldinaBody.data !== null,
      'Payload inválido para Vila Leopoldina',
    )

    const vilaLeopoldina = vilaLeopoldinaBody.data
    assertCondition(
      vilaLeopoldina.location.cgeStationId === '1000848',
      `Esperava estação Lapa (1000848), recebeu ${vilaLeopoldina.location.cgeStationId}`,
    )
    assertCondition(
      vilaLeopoldina.location.zone === 'Zona Oeste',
      `Esperava Zona Oeste, recebeu ${vilaLeopoldina.location.zone}`,
    )
    assertCondition(
      vilaLeopoldina.location.ibgeCode === '3550308',
      `Esperava ibgeCode 3550308, recebeu ${vilaLeopoldina.location.ibgeCode}`,
    )
    assertCondition(
      vilaLeopoldina.sources.floodingMonitor.status !== 'skipped',
      'CGE-SP deveria ter sido executado para Vila Leopoldina',
    )

    writeLine(
      `[OK] 3. Lookup hiperlocal Vila Leopoldina: estação ${vilaLeopoldina.location.cgeStationName} (${vilaLeopoldina.location.cgeStationId}), zona ${vilaLeopoldina.location.zone}, CGE status=${vilaLeopoldina.sources.floodingMonitor.status}`,
    )

    // 4. Coordenada fora da Capital SP (Campinas -> multi-município sem CGE-SP)
    const campinasRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates?lat=-22.9099&lon=-47.0626',
    })
    assertCondition(
      campinasRes.statusCode === 200,
      `Campinas retornou HTTP ${campinasRes.statusCode}`,
    )

    const campinasBody = campinasRes.json() as Envelope<OohAlertDecision>
    assertCondition(
      campinasBody.success && campinasBody.data !== null,
      'Payload inválido para Campinas',
    )

    const campinas = campinasBody.data
    assertCondition(
      campinas.location.cgeStationId === null,
      `Esperava cgeStationId null em Campinas, recebeu ${campinas.location.cgeStationId}`,
    )
    assertCondition(
      campinas.sources.floodingMonitor.status === 'skipped',
      `Esperava CGE-SP skipped em Campinas, recebeu ${campinas.sources.floodingMonitor.status}`,
    )
    assertCondition(
      campinas.sources.forecast.status === 'ok',
      `Open-Meteo falhou em Campinas: ${campinas.sources.forecast.error}`,
    )
    assertCondition(
      campinas.sources.officialAlerts.status === 'ok',
      `INMET falhou em Campinas: ${campinas.sources.officialAlerts.error}`,
    )

    writeLine(
      `[OK] 4. Multi-município Campinas: Open-Meteo=${campinas.sources.forecast.status}, INMET=${campinas.sources.officialAlerts.status} (${campinas.officialAlerts.length} aviso(s)), CGE-SP=${campinas.sources.floodingMonitor.status}`,
    )

    // 5. Feeds XML RSS 2.0 (Região SP e Coordenada fora da capital)
    const regionRssRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/regions/zona-oeste-butanta/feed.xml',
    })
    const coordRssRes = await app.inject({
      method: 'GET',
      url: '/v1/alerts/by-coordinates/feed.xml?lat=-22.9099&lon=-47.0626',
    })

    for (const [label, res] of [
      ['Butantã RSS', regionRssRes],
      ['Campinas RSS', coordRssRes],
    ] as const) {
      assertCondition(res.statusCode === 200, `${label} retornou HTTP ${res.statusCode}`)
      const contentType = String(res.headers['content-type'] ?? '')
      assertCondition(
        contentType.includes('application/rss+xml'),
        `${label} com content-type inesperado: ${contentType}`,
      )
      assertCondition(
        res.body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
        `${label} não iniciou com cabeçalho XML`,
      )
      assertCondition(
        res.body.includes('<ooh:severityLabel>') && res.body.includes('</rss>'),
        `${label} sem tags <ooh:*> ou fechamento </rss>`,
      )
    }

    writeLine('[OK] 5. Feeds XML RSS 2.0 validados com sucesso (Capital SP + Multi-município)')

    // 6. Saúde consolidada das fontes
    const statusRes = await app.inject({ method: 'GET', url: '/v1/sources/status' })
    assertCondition(statusRes.statusCode === 200, `/v1/sources/status retornou HTTP ${statusRes.statusCode}`)
    const statusBody = statusRes.json() as Envelope<{
      checkedAt: string
      providers: SourceHealthSnapshot[]
    }>
    assertCondition(statusBody.success && statusBody.data !== null, 'Payload inválido de sources/status')

    writeLine('--- Saúde das Fontes ---')
    for (const provider of statusBody.data.providers) {
      writeLine(
        `  * ${provider.provider}: status=${provider.status}, cachedKeys=${provider.cachedKeys}, lastLatencyMs=${provider.lastLatencyMs ?? 'n/a'}`,
      )
    }
    writeLine('=== Smoke Test Ao Vivo Concluído com Sucesso ===')
  } finally {
    await app.close()
  }
}

try {
  await runLiveSmokeChecks()
} catch (error) {
  logger.error({ err: error }, 'Falha no smoke test ao vivo')
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`[FAIL] ${message}\n`)
  process.exitCode = 1
}
