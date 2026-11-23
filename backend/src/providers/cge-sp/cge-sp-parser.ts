import * as cheerio from 'cheerio'
import type {
  FloodingPoint,
  FloodingPointStatus,
  StationRainfall,
} from '../flooding-monitor-provider.js'
import { findCgeStationById } from './cge-sp-stations.js'

const VALID_FLOODING_STATUSES: ReadonlySet<FloodingPointStatus> = new Set([
  'ativo-transitavel',
  'ativo-intransitavel',
  'inativo-transitavel',
  'inativo-intransitavel',
])

function isFloodingPointStatus(value: string): value is FloodingPointStatus {
  return VALID_FLOODING_STATUSES.has(value as FloodingPointStatus)
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractLinesFromFragment(rawHtml: string): string[] {
  if (!rawHtml) {
    return []
  }

  const withNewlines = rawHtml.replace(/<br\s*\/?>/gi, '\n')
  const fragment$ = cheerio.load(`<div id="__cge_frag">${withNewlines}</div>`)
  const decodedText = fragment$('#__cge_frag').text()

  return decodedText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0)
}

function parseMetricNumber(rawText: string | undefined): number | null {
  if (!rawText) {
    return null
  }
  const match = /-?\d+(?:[.,]\d+)?/.exec(rawText)
  if (!match) {
    return null
  }
  const parsed = Number.parseFloat(match[0].replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function resolvePointStatus(
  $: cheerio.CheerioAPI,
  pointEl: ReturnType<cheerio.CheerioAPI>,
): FloodingPointStatus | null {
  for (const liEl of pointEl.find('li[class]').toArray()) {
    const classTokens = ($(liEl).attr('class') ?? '').split(/\s+/)
    const matched = classTokens.find(isFloodingPointStatus)
    if (matched) {
      return matched
    }
  }
  return null
}

/** Faz parse puro do HTML de `alagamentos.jsp` do CGE-SP. */
export function parseCgeFloodingPointsHtml(html: string): FloodingPoint[] {
  if (html.includes('Não há registros de alagamentos')) {
    return []
  }

  const $ = cheerio.load(html)
  const points: FloodingPoint[] = []
  let currentZone = 'Desconhecida'

  $('h1.tit-bairros, table.tb-pontos-de-alagamentos').each((_, element) => {
    const tagName = element.tagName.toLowerCase()

    if (tagName === 'h1') {
      const zoneText = normalizeWhitespace($(element).text())
      if (zoneText) {
        currentZone = zoneText
      }
      return
    }

    const tableEl = $(element)
    const neighborhood = normalizeWhitespace(
      tableEl.find('td.bairro').first().clone().children('hr').remove().end().text(),
    )

    tableEl.find('div.ponto-de-alagamento').each((__, pointElement) => {
      const pointEl = $(pointElement)
      const status = resolvePointStatus($, pointEl)

      if (!status) {
        return
      }

      const localLines = extractLinesFromFragment(pointEl.find('li.col-local').first().html() ?? '')
      let timeWindow: string | null = null
      let street = ''

      if (localLines.length >= 2 && /^(De|Desde)\b/i.test(localLines[0])) {
        timeWindow = localLines[0]
        street = localLines.slice(1).join(' ')
      } else {
        street = localLines.join(' ')
      }

      const detailLines = extractLinesFromFragment(
        pointEl.find('li.arial-descr-alag').not('.col-local').first().html() ?? '',
      )

      let direction: string | null = null
      let reference: string | null = null

      for (const line of detailLines) {
        const directionMatch = /^Sentido:\s*(.*)$/i.exec(line)
        if (directionMatch) {
          direction = directionMatch[1].trim() || null
          continue
        }

        const referenceMatch = /^Refer[êe]ncia:\s*(.*)$/i.exec(line)
        if (referenceMatch) {
          reference = referenceMatch[1].trim() || null
        }
      }

      points.push({
        zone: currentZone,
        neighborhood: neighborhood || 'Não informado',
        street: street || 'Via não informada',
        direction,
        reference,
        timeWindow,
        status,
        active: status.startsWith('ativo-'),
        passable: status === 'ativo-transitavel' || status === 'inativo-transitavel',
      })
    })
  })

  return points
}

/** Faz parse puro do HTML de `estacao.jsp?POSTO={id}` do CGE-SP. */
export function parseCgeStationHtml(
  html: string,
  stationId: string,
  stationName?: string | null,
): StationRainfall | null {
  const $ = cheerio.load(html)
  const instrumentos = $('#instrumentos')
  const hasDadosEstacoes = $('table.dados_estacoes').length > 0

  if (instrumentos.length === 0 && !hasDadosEstacoes) {
    return null
  }

  const candidateTables = instrumentos.length > 0 ? instrumentos.find('table') : $('table')
  const outerTable = candidateTables
    .filter((_, el) => $(el).find('table.dados_estacoes').length > 0)
    .first()

  if (outerTable.length === 0) {
    return null
  }

  const headers = outerTable
    .find('th')
    .map((_, el) => normalizeWhitespace($(el).text()).toLowerCase())
    .get()

  const columnCells = outerTable
    .find('td')
    .filter((_, el) => $(el).children('table.dados_estacoes').length > 0)
    .toArray()

  let currentPeriodMm: number | null = null
  let previousPeriodMm: number | null = null
  let resetTime: string | null = null
  let temperatureC: number | null = null
  let humidityPercent: number | null = null

  columnCells.forEach((cell, columnIndex) => {
    const header = headers[columnIndex] ?? ''
    const nestedTable = $(cell).children('table.dados_estacoes').first()
    const metrics = new Map<string, string>()

    nestedTable.find('tr').each((_, row) => {
      const cells = $(row).children('td')
      if (cells.length < 2) {
        return
      }
      const key = normalizeWhitespace(cells.eq(0).text()).replace(/:$/, '').toLowerCase()
      const value = normalizeWhitespace(cells.eq(1).text())
      metrics.set(key, value)
    })

    if (header.includes('chuva')) {
      currentPeriodMm = parseMetricNumber(metrics.get('per. atual'))
      previousPeriodMm = parseMetricNumber(metrics.get('per. anterior'))
      resetTime = metrics.get('zeramento') || null
    } else if (header.includes('temperatura')) {
      temperatureC = parseMetricNumber(metrics.get('atual'))
    } else if (header.includes('umidade')) {
      humidityPercent = parseMetricNumber(metrics.get('atual'))
    }
  })

  return {
    stationId,
    stationName: stationName ?? findCgeStationById(stationId)?.name ?? null,
    currentPeriodMm,
    previousPeriodMm,
    resetTime,
    temperatureC,
    humidityPercent,
  }
}
