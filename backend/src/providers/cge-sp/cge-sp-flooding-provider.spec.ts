import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { CgeSpFloodingProvider } from './cge-sp-flooding-provider.js'
import { parseCgeFloodingPointsHtml, parseCgeStationHtml } from './cge-sp-parser.js'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')

function readFixture(filename: string): string {
  return readFileSync(path.join(fixturesDir, filename), 'utf8')
}

describe('CGE-SP parser e provider', () => {
  it('faz parse de múltiplas zonas, bairros e todos os 4 status de alagamento', () => {
    const html = readFixture('cge-alagamentos-15-01-2026.html')
    const points = parseCgeFloodingPointsHtml(html)

    expect(points).toHaveLength(4)

    expect(points[0]).toEqual({
      zone: 'Zona Norte',
      neighborhood: 'Casa Verde',
      street: 'R REIMS',
      direction: 'UNICO',
      reference: 'AV CASA VERDE',
      timeWindow: 'De 15:52 a 16:10',
      status: 'inativo-transitavel',
      active: false,
      passable: true,
    })

    expect(points[1]).toEqual({
      zone: 'Zona Norte',
      neighborhood: 'Santana',
      street: 'PTE DAS BANDEIRAS SEN ROMEU TUMA',
      direction: 'AMBOS',
      reference: 'ALTURA DO N. 296',
      timeWindow: 'Desde 16:08',
      status: 'ativo-transitavel',
      active: true,
      passable: true,
    })

    expect(points[2]).toEqual({
      zone: 'Zona Oeste',
      neighborhood: 'Butantã',
      street: 'AV CORIFEU DE AZEVEDO MARQUES',
      direction: 'BAIRRO/CENTRO',
      reference: 'ALTURA DO N. 1200',
      timeWindow: 'Desde 16:40',
      status: 'ativo-intransitavel',
      active: true,
      passable: false,
    })

    expect(points[3]).toMatchObject({
      zone: 'Zona Oeste',
      neighborhood: 'Butantã',
      street: 'AV VITAL BRASIL',
      status: 'inativo-intransitavel',
      active: false,
      passable: false,
    })
  })

  it('retorna lista vazia quando a página indica ausência de alagamentos', () => {
    const html = readFixture('cge-alagamentos-empty.html')
    expect(parseCgeFloodingPointsHtml(html)).toEqual([])
  })

  it('extrai métricas de chuva, temperatura e umidade isoladas por coluna na estação CGE-SP', () => {
    const html = readFixture('cge-estacao-butanta.html')
    const rainfall = parseCgeStationHtml(html, '1000842')

    expect(rainfall).toEqual({
      stationId: '1000842',
      stationName: 'Butantã',
      currentPeriodMm: 0.4,
      previousPeriodMm: 25.2,
      resetTime: '10:00:00',
      temperatureC: 25.6,
      humidityPercent: 75.1,
    })
  })

  it('retorna null quando HTML da estação não possui instrumentos válidos', () => {
    expect(parseCgeStationHtml('<html><body><p>Posto indisponível</p></body></html>', '999')).toBeNull()
  })

  it('consulta alagamentos com cgeDate, decodifica iso-8859-1 e consulta estação via fetchFn', async () => {
    const alagamentosHtml = readFixture('cge-alagamentos-15-01-2026.html')
    const estacaoHtml = readFixture('cge-estacao-butanta.html')
    const calledUrls: string[] = []

    const fetchFn: typeof fetch = vi.fn(async (input) => {
      const url = String(input)
      calledUrls.push(url)

      if (url.includes('alagamentos.jsp')) {
        const latin1Bytes = Buffer.from(alagamentosHtml, 'latin1')
        return new Response(latin1Bytes, {
          status: 200,
          headers: { 'content-type': 'text/html;charset=ISO-8859-1' },
        })
      }

      return new Response(estacaoHtml, {
        status: 200,
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      })
    })

    const provider = new CgeSpFloodingProvider({ fetchFn })
    const points = await provider.getFloodingPoints({ cgeDate: '15/01/2026' })
    const station = await provider.getStationRainfall('1000842')

    expect(calledUrls[0]).toContain('alagamentos.jsp?dataBusca=15%2F01%2F2026&enviaBusca=Buscar')
    expect(calledUrls[1]).toContain('estacao.jsp?POSTO=1000842')
    expect(points).toHaveLength(4)
    expect(points[2].neighborhood).toBe('Butantã')
    expect(station?.currentPeriodMm).toBe(0.4)
  })

  it('lança erro quando CGE-SP retorna erro HTTP', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => new Response('Bad Gateway', { status: 502 }))
    const provider = new CgeSpFloodingProvider({ fetchFn })

    await expect(provider.getFloodingPoints()).rejects.toThrow('CGE-SP alagamentos respondeu HTTP 502')
    await expect(provider.getStationRainfall('1000842')).rejects.toThrow(
      'CGE-SP estação respondeu HTTP 502',
    )
  })
})
