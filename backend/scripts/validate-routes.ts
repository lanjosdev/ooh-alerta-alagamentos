import { buildApp } from '../src/app.js'
import type { SourceHealthSnapshot } from '../src/lib/cache.js'
import { logger } from '../src/lib/logger.js'
import type { MonitoringRegion } from '../src/repositories/region-repository.js'
import type { OohAlertDecision } from '../src/services/alerts/alert-types.js'
import type { CityOverviewResult } from '../src/services/alerts/get-city-overview-service.js'

interface ApiEnvelope<T> {
  success: boolean
  message: string | null
  data: T | null
}

interface CheckResult {
  block: string
  name: string
  passed: boolean
  statusCode: number | null
  latencyMs: number
  detail: string
}

interface HttpResult {
  status: number
  headers: Headers
  text: string
  latencyMs: number
}

function writeLine(text: string): void {
  process.stdout.write(`${text}\n`)
}

function assertCheck(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function parseJsonSafe<T>(rawText: string): T {
  return JSON.parse(rawText) as T
}

async function requestHttp(url: string): Promise<HttpResult> {
  const startedAt = performance.now()
  const response = await fetch(url)
  const text = await response.text()
  const latencyMs = Math.round(performance.now() - startedAt)
  return {
    status: response.status,
    headers: response.headers,
    text,
    latencyMs,
  }
}

async function fetchSuccessData<T>(
  url: string,
): Promise<{ status: number; latencyMs: number; data: T }> {
  const res = await requestHttp(url)
  assertCheck(res.status === 200, `Esperava HTTP 200, recebeu ${res.status}`)
  const body = parseJsonSafe<ApiEnvelope<T>>(res.text)
  assertCheck(body.success === true && body.data !== null, 'Envelope ApiResponse inválido')
  return {
    status: res.status,
    latencyMs: res.latencyMs,
    data: body.data,
  }
}

async function runCheck(
  results: CheckResult[],
  block: string,
  name: string,
  fn: () => Promise<{ statusCode: number; latencyMs: number; detail: string }>,
): Promise<void> {
  const startedAt = performance.now()
  try {
    const outcome = await fn()
    results.push({
      block,
      name,
      passed: true,
      statusCode: outcome.statusCode,
      latencyMs: outcome.latencyMs,
      detail: outcome.detail,
    })
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt)
    results.push({
      block,
      name,
      passed: false,
      statusCode: null,
      latencyMs,
      detail: error instanceof Error ? error.message : String(error),
    })
  }
}

async function startEphemeralServer(enableSimulationParams: boolean) {
  const app = await buildApp({ enableSimulationParams })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const address = app.server.address()
  if (!address || typeof address === 'string') {
    await app.close()
    throw new Error('Falha ao obter porta efêmera do servidor Fastify')
  }
  return {
    app,
    baseUrl: `http://127.0.0.1:${address.port}`,
  }
}

async function main(): Promise<void> {
  logger.level = 'warn'

  const externalBaseUrl = process.env.BASE_URL?.trim().replace(/\/$/, '') || null
  const mainServer = externalBaseUrl ? null : await startEphemeralServer(true)
  const baseUrl = externalBaseUrl ?? mainServer!.baseUrl
  const results: CheckResult[] = []

  writeLine('=== Validação Automatizada do Roteiro de Rotas (E2E HTTP Real) ===')
  writeLine(
    `Alvo: ${baseUrl} (${externalBaseUrl ? 'instância externa BASE_URL' : 'servidor efêmero autônomo'})`,
  )

  try {
    // -----------------------------------------------------------------------
    // Bloco 1 — Infraestrutura e Swagger
    // -----------------------------------------------------------------------
    await runCheck(results, '1. Infra & Swagger', 'GET /docs (Swagger UI)', async () => {
      const res = await requestHttp(`${baseUrl}/docs`)
      assertCheck(res.status === 200, `Esperava HTTP 200, recebeu ${res.status}`)
      const contentType = res.headers.get('content-type') ?? ''
      assertCheck(contentType.includes('text/html'), `Content-Type inesperado: ${contentType}`)
      assertCheck(
        res.text.toLowerCase().includes('swagger'),
        'HTML não contém referência ao Swagger UI',
      )
      return {
        statusCode: res.status,
        latencyMs: res.latencyMs,
        detail: 'Swagger UI HTML servido',
      }
    })

    await runCheck(results, '1. Infra & Swagger', 'GET /docs/json (OpenAPI 3.0)', async () => {
      const res = await requestHttp(`${baseUrl}/docs/json`)
      assertCheck(res.status === 200, `Esperava HTTP 200, recebeu ${res.status}`)
      const spec = parseJsonSafe<{ paths?: Record<string, unknown> }>(res.text)
      const paths = Object.keys(spec.paths ?? {})
      const expectedPaths = [
        '/v1/health',
        '/v1/sources/status',
        '/v1/regions',
        '/v1/alerts/regions',
        '/v1/alerts/regions/{regionId}',
        '/v1/alerts/by-coordinates',
        '/v1/alerts/feed.xml',
        '/v1/alerts/regions/{regionId}/feed.xml',
        '/v1/alerts/by-coordinates/feed.xml',
      ]
      for (const expected of expectedPaths) {
        assertCheck(paths.includes(expected), `Rota ausente no OpenAPI: ${expected}`)
      }
      return {
        statusCode: res.status,
        latencyMs: res.latencyMs,
        detail: `${paths.length} rotas documentadas no OpenAPI`,
      }
    })

    await runCheck(results, '1. Infra & Swagger', 'GET /v1/health', async () => {
      const { status, latencyMs, data } = await fetchSuccessData<{ status: string; uptime: number }>(
        `${baseUrl}/v1/health`,
      )
      assertCheck(data.status === 'ok', `Status inesperado: ${data.status}`)
      return {
        statusCode: status,
        latencyMs,
        detail: `status=${data.status}, uptime=${data.uptime.toFixed(2)}s`,
      }
    })

    await runCheck(
      results,
      '1. Infra & Swagger',
      'GET /v1/sources/status (estado inicial)',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<{
          providers: SourceHealthSnapshot[]
        }>(`${baseUrl}/v1/sources/status`)
        const names = data.providers.map((p) => p.provider)
        assertCheck(
          names.includes('open-meteo') && names.includes('inmet') && names.includes('cge-sp'),
          `Provedores inesperados: ${names.join(', ')}`,
        )
        if (!externalBaseUrl) {
          assertCheck(
            data.providers.every((p) => p.status === 'unknown'),
            'Esperava status inicial unknown antes das consultas',
          )
        }
        return {
          statusCode: status,
          latencyMs,
          detail: data.providers.map((p) => `${p.provider}=${p.status}`).join(', '),
        }
      },
    )

    // -----------------------------------------------------------------------
    // Bloco 2 — Catálogo de Regiões
    // -----------------------------------------------------------------------
    await runCheck(results, '2. Regiões', 'GET /v1/regions (todas)', async () => {
      const { status, latencyMs, data } = await fetchSuccessData<{
        total: number
        regions: MonitoringRegion[]
      }>(`${baseUrl}/v1/regions`)
      assertCheck(data.total === 12, `Esperava total=12, recebeu ${data.total}`)
      return { statusCode: status, latencyMs, detail: `total=${data.total}` }
    })

    await runCheck(results, '2. Regiões', 'GET /v1/regions?zone=Zona%20Oeste', async () => {
      const { status, latencyMs, data } = await fetchSuccessData<{
        total: number
        regions: MonitoringRegion[]
      }>(`${baseUrl}/v1/regions?zone=Zona%20Oeste`)
      assertCheck(data.total === 3, `Esperava total=3, recebeu ${data.total}`)
      return {
        statusCode: status,
        latencyMs,
        detail: data.regions.map((r) => r.name).join(', '),
      }
    })

    await runCheck(results, '2. Regiões', 'GET /v1/regions?ibgeCode=3550308 vs 3509502', async () => {
      const sp = await fetchSuccessData<{ total: number }>(`${baseUrl}/v1/regions?ibgeCode=3550308`)
      const cps = await fetchSuccessData<{ total: number }>(`${baseUrl}/v1/regions?ibgeCode=3509502`)
      assertCheck(sp.data.total === 12, `Esperava 12 para 3550308, recebeu ${sp.data.total}`)
      assertCheck(cps.data.total === 0, `Esperava 0 para 3509502, recebeu ${cps.data.total}`)
      return {
        statusCode: 200,
        latencyMs: sp.latencyMs + cps.latencyMs,
        detail: '3550308=12, 3509502=0',
      }
    })

    // -----------------------------------------------------------------------
    // Bloco 3 — Alertas por Região e Panorama Consolidado (JSON)
    // -----------------------------------------------------------------------
    let butantaGrid: { lat: number; lon: number } | null = null

    await runCheck(
      results,
      '3. Alertas JSON',
      'GET /v1/alerts/regions/zona-oeste-butanta',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<OohAlertDecision>(
          `${baseUrl}/v1/alerts/regions/zona-oeste-butanta`,
        )
        assertCheck(data.location.cgeStationId === '1000842', 'Estação CGE esperada: 1000842')
        assertCheck(data.forecast !== null, 'Open-Meteo não retornou previsão')
        assertCheck(
          data.sources.forecast.status === 'ok',
          `Forecast status=${data.sources.forecast.status}`,
        )
        assertCheck(
          data.sources.officialAlerts.status === 'ok',
          `INMET status=${data.sources.officialAlerts.status}`,
        )
        assertCheck(
          data.sources.floodingMonitor.status === 'ok',
          `CGE status=${data.sources.floodingMonitor.status}`,
        )
        butantaGrid = { lat: data.forecast.gridLatitude, lon: data.forecast.gridLongitude }
        return {
          statusCode: status,
          latencyMs,
          detail: `nivel=${data.severityLabel}, score=${data.riskScore}, grade=(${butantaGrid.lat}, ${butantaGrid.lon}), chuva2h=${data.forecast.maxRainProbabilityNext2hPercent}%`,
        }
      },
    )

    await runCheck(
      results,
      '3. Alertas JSON',
      'GET /v1/alerts/regions/zona-leste-itaquera (grade distinta)',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<OohAlertDecision>(
          `${baseUrl}/v1/alerts/regions/zona-leste-itaquera`,
        )
        assertCheck(data.location.cgeStationId === '1000864', 'Estação CGE esperada: 1000864')
        assertCheck(data.forecast !== null, 'Open-Meteo não retornou previsão')
        if (butantaGrid) {
          assertCheck(
            data.forecast.gridLatitude !== butantaGrid.lat ||
              data.forecast.gridLongitude !== butantaGrid.lon,
            'Esperava grade Open-Meteo distinta entre Itaquera e Butantã',
          )
        }
        return {
          statusCode: status,
          latencyMs,
          detail: `nivel=${data.severityLabel}, score=${data.riskScore}, grade=(${data.forecast.gridLatitude}, ${data.forecast.gridLongitude})`,
        }
      },
    )

    await runCheck(
      results,
      '3. Alertas JSON',
      'GET /v1/alerts/regions (panorama 12 regiões + ordenação)',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<CityOverviewResult>(
          `${baseUrl}/v1/alerts/regions`,
        )
        const { summary, regions } = data
        assertCheck(
          summary.totalRegions === 12 && regions.length === 12,
          `Esperava 12 regiões, recebeu ${summary.totalRegions}`,
        )
        for (let i = 0; i < regions.length - 1; i += 1) {
          const curr = regions[i]
          const next = regions[i + 1]
          const ordered =
            curr.severityLevel > next.severityLevel ||
            (curr.severityLevel === next.severityLevel && curr.riskScore >= next.riskScore)
          assertCheck(
            ordered,
            `Ordenação incorreta entre ${curr.location.id} e ${next.location.id}`,
          )
        }
        return {
          statusCode: status,
          latencyMs,
          detail: `total=12, maior=${summary.highestSeverityLabel}, overrides=${summary.overrideActiveCount}`,
        }
      },
    )

    await runCheck(results, '3. Alertas JSON', 'GET /v1/alerts/regions?zone=Zona%20Sul', async () => {
      const { status, latencyMs, data } = await fetchSuccessData<CityOverviewResult>(
        `${baseUrl}/v1/alerts/regions?zone=Zona%20Sul`,
      )
      assertCheck(
        data.summary.totalRegions === 2,
        `Esperava 2 regiões na Zona Sul, recebeu ${data.summary.totalRegions}`,
      )
      return {
        statusCode: status,
        latencyMs,
        detail: data.regions.map((r) => `${r.location.name}:${r.severityLabel}`).join(', '),
      }
    })

    // -----------------------------------------------------------------------
    // Bloco 4 — Coordenadas (Hiperlocal SP vs Multi-município)
    // -----------------------------------------------------------------------
    await runCheck(
      results,
      '4. Coordenadas',
      'Vila Leopoldina (-23.5317, -46.7294 -> Lapa 1000848)',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<OohAlertDecision>(
          `${baseUrl}/v1/alerts/by-coordinates?lat=-23.5317&lon=-46.7294`,
        )
        assertCheck(
          data.location.ibgeCode === '3550308',
          `ibgeCode inesperado: ${data.location.ibgeCode}`,
        )
        assertCheck(data.location.zone === 'Zona Oeste', `zone inesperada: ${data.location.zone}`)
        assertCheck(
          data.location.cgeStationId === '1000848',
          `Estação esperada 1000848, recebeu ${data.location.cgeStationId}`,
        )
        assertCheck(
          data.sources.floodingMonitor.status === 'ok',
          `CGE status=${data.sources.floodingMonitor.status}`,
        )
        return {
          statusCode: status,
          latencyMs,
          detail: `estação=${data.location.cgeStationName} (${data.location.cgeStationId}), nivel=${data.severityLabel}`,
        }
      },
    )

    await runCheck(
      results,
      '4. Coordenadas',
      'Campinas (-22.9099, -47.0626 -> CGE skipped)',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<OohAlertDecision>(
          `${baseUrl}/v1/alerts/by-coordinates?lat=-22.9099&lon=-47.0626`,
        )
        assertCheck(data.location.cgeStationId === null, 'Esperava cgeStationId null em Campinas')
        assertCheck(
          data.sources.floodingMonitor.status === 'skipped',
          `CGE status=${data.sources.floodingMonitor.status}`,
        )
        assertCheck(
          data.sources.forecast.status === 'ok',
          `Forecast status=${data.sources.forecast.status}`,
        )
        assertCheck(
          data.sources.officialAlerts.status === 'ok',
          `INMET status=${data.sources.officialAlerts.status}`,
        )
        return {
          statusCode: status,
          latencyMs,
          detail: `nivel=${data.severityLabel}, inmet=${data.officialAlerts.length} aviso(s), cge=${data.sources.floodingMonitor.status}`,
        }
      },
    )

    // -----------------------------------------------------------------------
    // Bloco 5 — Feeds XML / RSS 2.0
    // -----------------------------------------------------------------------
    await runCheck(
      results,
      '5. Feeds RSS 2.0',
      'GET /v1/alerts/regions/zona-oeste-butanta/feed.xml',
      async () => {
        const res = await requestHttp(`${baseUrl}/v1/alerts/regions/zona-oeste-butanta/feed.xml`)
        assertCheck(res.status === 200, `Esperava HTTP 200, recebeu ${res.status}`)
        const ct = res.headers.get('content-type') ?? ''
        assertCheck(ct.includes('application/rss+xml'), `Content-Type inesperado: ${ct}`)
        assertCheck(
          res.text.startsWith('<?xml version="1.0" encoding="UTF-8"?>'),
          'Cabeçalho XML ausente',
        )
        assertCheck(
          res.text.includes('xmlns:ooh="https://ooh-alerta-alagamentos.local/ns/1.0"'),
          'Namespace ooh ausente',
        )
        assertCheck(
          res.text.includes('<ooh:triggerOverride>') && res.text.includes('</rss>'),
          'Tags RSS/OOH ausentes',
        )
        assertCheck((res.text.match(/<item>/g) ?? []).length === 1, 'Esperava exatamente 1 <item>')
        return {
          statusCode: res.status,
          latencyMs: res.latencyMs,
          detail: `content-type=${ct}, 1 item`,
        }
      },
    )

    await runCheck(
      results,
      '5. Feeds RSS 2.0',
      'GET /v1/alerts/by-coordinates/feed.xml (Vila Leopoldina)',
      async () => {
        const res = await requestHttp(
          `${baseUrl}/v1/alerts/by-coordinates/feed.xml?lat=-23.5317&lon=-46.7294`,
        )
        assertCheck(res.status === 200, `Esperava HTTP 200, recebeu ${res.status}`)
        const ct = res.headers.get('content-type') ?? ''
        assertCheck(ct.includes('application/rss+xml'), `Content-Type inesperado: ${ct}`)
        assertCheck(
          res.text.includes('<ooh:zone>Zona Oeste</ooh:zone>'),
          'Tag <ooh:zone>Zona Oeste</ooh:zone> ausente',
        )
        assertCheck((res.text.match(/<item>/g) ?? []).length === 1, 'Esperava exatamente 1 <item>')
        return { statusCode: res.status, latencyMs: res.latencyMs, detail: 'Zona Oeste, 1 item' }
      },
    )

    await runCheck(
      results,
      '5. Feeds RSS 2.0',
      'GET /v1/alerts/feed.xml (consolidado 12 itens)',
      async () => {
        const res = await requestHttp(`${baseUrl}/v1/alerts/feed.xml`)
        assertCheck(res.status === 200, `Esperava HTTP 200, recebeu ${res.status}`)
        const ct = res.headers.get('content-type') ?? ''
        assertCheck(ct.includes('application/rss+xml'), `Content-Type inesperado: ${ct}`)
        const itemCount = (res.text.match(/<item>/g) ?? []).length
        assertCheck(itemCount === 12, `Esperava 12 <item>, recebeu ${itemCount}`)
        return {
          statusCode: res.status,
          latencyMs: res.latencyMs,
          detail: `${itemCount} itens RSS validados`,
        }
      },
    )

    // -----------------------------------------------------------------------
    // Bloco 6 — Simulação e Histórico CGE-SP
    // -----------------------------------------------------------------------
    await runCheck(
      results,
      '6. Simulação',
      'GET /v1/alerts/regions/zona-oeste-butanta?cgeDate=15/01/2026',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<OohAlertDecision>(
          `${baseUrl}/v1/alerts/regions/zona-oeste-butanta?cgeDate=15/01/2026`,
        )
        assertCheck(data.flooding.cgeDate === '15/01/2026', 'cgeDate não preservado')
        assertCheck(
          data.flooding.pointsInZone.length >= 1,
          'Esperava >= 1 ponto histórico na Zona Oeste em 15/01/2026',
        )
        return {
          statusCode: status,
          latencyMs,
          detail: `${data.flooding.pointsInZone.length} ponto(s) histórico(s), nivel=${data.severityLabel}`,
        }
      },
    )

    await runCheck(results, '6. Simulação', 'GET ?simulate=critical (JSON + RSS)', async () => {
      const jsonResult = await fetchSuccessData<OohAlertDecision>(
        `${baseUrl}/v1/alerts/regions/zona-oeste-butanta?simulate=critical`,
      )
      const rssRes = await requestHttp(
        `${baseUrl}/v1/alerts/regions/zona-oeste-butanta/feed.xml?simulate=critical`,
      )
      assertCheck(rssRes.status === 200, `Status RSS=${rssRes.status}`)
      assertCheck(
        jsonResult.data.simulated === true &&
          jsonResult.data.severityLevel === 3 &&
          jsonResult.data.severityLabel === 'CRITICO' &&
          jsonResult.data.triggerOverride === true,
        'Payload JSON simulado inválido',
      )
      assertCheck(
        rssRes.text.includes('<ooh:simulated>true</ooh:simulated>') &&
          rssRes.text.includes('<ooh:severityLabel>CRITICO</ooh:severityLabel>'),
        'Payload RSS simulado inválido',
      )
      return {
        statusCode: 200,
        latencyMs: jsonResult.latencyMs + rssRes.latencyMs,
        detail: 'JSON e RSS retornaram CRITICO (simulated=true)',
      }
    })

    if (!externalBaseUrl) {
      await runCheck(
        results,
        '6. Simulação',
        'Bloqueio 400 com ENABLE_SIMULATION_PARAMS=false',
        async () => {
          const lockedServer = await startEphemeralServer(false)
          try {
            const simRes = await requestHttp(
              `${lockedServer.baseUrl}/v1/alerts/regions/centro-se?simulate=critical`,
            )
            const dateRes = await requestHttp(
              `${lockedServer.baseUrl}/v1/alerts/regions/centro-se?cgeDate=15/01/2026`,
            )
            assertCheck(
              simRes.status === 400 && dateRes.status === 400,
              `Esperava 400/400, recebeu ${simRes.status}/${dateRes.status}`,
            )
            const simBody = parseJsonSafe<ApiEnvelope<null>>(simRes.text)
            assertCheck(simBody.success === false && simBody.data === null, 'Envelope de erro inválido')
            return {
              statusCode: 400,
              latencyMs: simRes.latencyMs + dateRes.latencyMs,
              detail: 'simulate e cgeDate bloqueados com HTTP 400',
            }
          } finally {
            await lockedServer.app.close()
          }
        },
      )
    }

    // -----------------------------------------------------------------------
    // Bloco 7 — Tratamento de Erros (400 e 404)
    // -----------------------------------------------------------------------
    const errorCases: Array<{ name: string; path: string; expectedStatus: number }> = [
      {
        name: 'Região inexistente (JSON)',
        path: '/v1/alerts/regions/inexistente',
        expectedStatus: 404,
      },
      {
        name: 'Região inexistente (RSS)',
        path: '/v1/alerts/regions/inexistente/feed.xml',
        expectedStatus: 404,
      },
      { name: 'Rota sem prefixo /v1', path: '/health', expectedStatus: 404 },
      {
        name: 'Latitude fora do intervalo (95)',
        path: '/v1/alerts/by-coordinates?lat=95&lon=-46.63',
        expectedStatus: 400,
      },
      {
        name: 'Latitude vazia',
        path: '/v1/alerts/by-coordinates?lat=&lon=-46.63',
        expectedStatus: 400,
      },
      {
        name: 'cgeDate malformado (2026-01-15)',
        path: '/v1/alerts/regions/centro-se?cgeDate=2026-01-15',
        expectedStatus: 400,
      },
      {
        name: 'simulate inválido',
        path: '/v1/alerts/regions/centro-se?simulate=invalido',
        expectedStatus: 400,
      },
    ]

    for (const errorCase of errorCases) {
      await runCheck(results, '7. Erros 4xx', errorCase.name, async () => {
        const res = await requestHttp(`${baseUrl}${errorCase.path}`)
        assertCheck(
          res.status === errorCase.expectedStatus,
          `Esperava HTTP ${errorCase.expectedStatus}, recebeu ${res.status}`,
        )
        const body = parseJsonSafe<ApiEnvelope<null>>(res.text)
        assertCheck(
          body.success === false && body.data === null && typeof body.message === 'string',
          'Envelope de erro ApiResponse inválido',
        )
        return { statusCode: res.status, latencyMs: res.latencyMs, detail: body.message ?? '' }
      })
    }

    // -----------------------------------------------------------------------
    // Bloco 8 — Cache TTL e Telemetria das Fontes
    // -----------------------------------------------------------------------
    await runCheck(
      results,
      '8. Cache & Telemetria',
      'Cache hit em nova chamada de zona-oeste-butanta',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<OohAlertDecision>(
          `${baseUrl}/v1/alerts/regions/zona-oeste-butanta`,
        )
        const { forecast, officialAlerts, floodingMonitor } = data.sources
        assertCheck(
          forecast.cached && officialAlerts.cached && floodingMonitor.cached,
          `Esperava cached=true em todas as fontes (forecast=${forecast.cached}, inmet=${officialAlerts.cached}, cge=${floodingMonitor.cached})`,
        )
        return {
          statusCode: status,
          latencyMs,
          detail: `forecast.cached=${forecast.cached}, inmet.cached=${officialAlerts.cached}, cge.cached=${floodingMonitor.cached}`,
        }
      },
    )

    await runCheck(
      results,
      '8. Cache & Telemetria',
      'GET /v1/sources/status (telemetria final)',
      async () => {
        const { status, latencyMs, data } = await fetchSuccessData<{
          providers: SourceHealthSnapshot[]
        }>(`${baseUrl}/v1/sources/status`)
        for (const provider of data.providers) {
          assertCheck(provider.status === 'ok', `${provider.provider} com status=${provider.status}`)
          assertCheck(provider.cachedKeys > 0, `${provider.provider} sem chaves em cache`)
          assertCheck(provider.lastSuccessAt !== null, `${provider.provider} sem lastSuccessAt`)
          assertCheck(provider.lastLatencyMs !== null, `${provider.provider} sem lastLatencyMs`)
        }
        return {
          statusCode: status,
          latencyMs,
          detail: data.providers
            .map((p) => `${p.provider}(ok, keys=${p.cachedKeys}, ${p.lastLatencyMs}ms)`)
            .join(' | '),
        }
      },
    )

    // -----------------------------------------------------------------------
    // Relatório Final
    // -----------------------------------------------------------------------
    writeLine('')
    let currentBlock = ''
    for (const item of results) {
      if (item.block !== currentBlock) {
        currentBlock = item.block
        writeLine(`--- ${currentBlock} ---`)
      }
      const badge = item.passed ? '[PASS]' : '[FAIL]'
      const statusText = item.statusCode !== null ? `HTTP ${item.statusCode}` : 'ERR'
      writeLine(`${badge} ${item.name} (${statusText}, ${item.latencyMs}ms) -> ${item.detail}`)
    }

    const passedCount = results.filter((r) => r.passed).length
    const failedCount = results.length - passedCount
    writeLine('')
    writeLine(
      `Resumo: ${passedCount}/${results.length} verificações aprovadas, ${failedCount} falha(s).`,
    )

    if (failedCount > 0) {
      process.exitCode = 1
    }
  } finally {
    if (mainServer) {
      await mainServer.app.close()
    }
  }
}

try {
  await main()
} catch (error) {
  logger.error({ err: error }, 'Erro fatal na validação automatizada das rotas')
  process.stderr.write(`[FAIL] ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
