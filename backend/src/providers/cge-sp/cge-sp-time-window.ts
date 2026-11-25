import type { FloodingPoint, FloodingPointStatus } from '../flooding-monitor-provider.js'

const MAX_MINUTE_OF_DAY = 23 * 60 + 59

export interface ParsedCgeTimeWindow {
  startMinutes: number
  endMinutes: number
}

export interface CgeTimeWindowOptions {
  isToday?: boolean
  nowMinutes?: number
}

export interface HistoricalFloodingSnapshot {
  points: FloodingPoint[]
  resolvedTime: string | null
}

function parseHmToMinutes(hoursStr: string, minutesStr: string): number | null {
  const hours = Number.parseInt(hoursStr, 10)
  const minutes = Number.parseInt(minutesStr, 10)
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }
  return hours * 60 + minutes
}

export function formatMinutesAsHm(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(MAX_MINUTE_OF_DAY, Math.floor(totalMinutes)))
  const hours = Math.floor(clamped / 60)
  const minutes = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Faz parse das janelas textuais do CGE-SP (`De HH:MM a HH:MM` ou `Desde HH:MM`).
 *
 * Limitação conhecida: quando um alagamento vira a meia-noite (`endMinutes < startMinutes`),
 * a janela é estendida até `23:59` do dia de início da consulta — ocorrências iniciadas no dia
 * anterior não aparecem na listagem de `dataBusca` do dia seguinte.
 */
export function parseCgeTimeWindow(
  timeWindow: string | null,
  options: CgeTimeWindowOptions = {},
): ParsedCgeTimeWindow | null {
  if (!timeWindow) {
    return null
  }

  const normalized = timeWindow.trim().replace(/\s+/g, ' ')

  const rangeMatch = /^De\s+(\d{1,2}):(\d{2})\s+a\s+(\d{1,2}):(\d{2})$/i.exec(normalized)
  if (rangeMatch) {
    const startMinutes = parseHmToMinutes(rangeMatch[1], rangeMatch[2])
    const rawEndMinutes = parseHmToMinutes(rangeMatch[3], rangeMatch[4])
    if (startMinutes === null || rawEndMinutes === null) {
      return null
    }

    const endMinutes = rawEndMinutes < startMinutes ? MAX_MINUTE_OF_DAY : rawEndMinutes
    return { startMinutes, endMinutes }
  }

  const sinceMatch = /^Desde\s+(\d{1,2}):(\d{2})$/i.exec(normalized)
  if (sinceMatch) {
    const startMinutes = parseHmToMinutes(sinceMatch[1], sinceMatch[2])
    if (startMinutes === null) {
      return null
    }

    const endMinutes = options.isToday
      ? Math.max(startMinutes, Math.min(MAX_MINUTE_OF_DAY, options.nowMinutes ?? MAX_MINUTE_OF_DAY))
      : MAX_MINUTE_OF_DAY
    return { startMinutes, endMinutes }
  }

  return null
}

function buildStatus(active: boolean, passable: boolean): FloodingPointStatus {
  if (active) {
    return passable ? 'ativo-transitavel' : 'ativo-intransitavel'
  }
  return passable ? 'inativo-transitavel' : 'inativo-intransitavel'
}

/**
 * Reconstrói o snapshot histórico dos pontos do CGE-SP para `targetTime` (`HH:MM`).
 * Se `targetTime` não for informado, detecta automaticamente o minuto de pico do dia
 * (maior número de pontos simultâneos, desempate por intransitáveis, depois horário mais cedo).
 */
export function resolveHistoricalFloodingSnapshot(
  points: readonly FloodingPoint[],
  targetTime?: string,
  options: CgeTimeWindowOptions = {},
): HistoricalFloodingSnapshot {
  const parsedEntries = points.map((point) => ({
    point,
    window: parseCgeTimeWindow(point.timeWindow, options),
  }))

  let resolvedMinutes: number | null = null

  if (targetTime) {
    const match = /^(\d{2}):(\d{2})$/.exec(targetTime)
    resolvedMinutes = match ? parseHmToMinutes(match[1], match[2]) : null
  } else {
    const candidateStarts = Array.from(
      new Set(
        parsedEntries
          .map((entry) => entry.window?.startMinutes)
          .filter((minute): minute is number => minute !== undefined),
      ),
    ).sort((a, b) => a - b)

    let bestActiveCount = -1
    let bestImpassableCount = -1

    for (const candidateMinute of candidateStarts) {
      let activeCount = 0
      let impassableCount = 0

      for (const entry of parsedEntries) {
        if (
          entry.window &&
          candidateMinute >= entry.window.startMinutes &&
          candidateMinute <= entry.window.endMinutes
        ) {
          activeCount += 1
          if (!entry.point.passable) {
            impassableCount += 1
          }
        }
      }

      if (
        activeCount > bestActiveCount ||
        (activeCount === bestActiveCount && impassableCount > bestImpassableCount)
      ) {
        bestActiveCount = activeCount
        bestImpassableCount = impassableCount
        resolvedMinutes = candidateMinute
      }
    }
  }

  const resolvedPoints: FloodingPoint[] = parsedEntries.map(({ point, window }) => {
    const isActive =
      resolvedMinutes !== null &&
      window !== null &&
      resolvedMinutes >= window.startMinutes &&
      resolvedMinutes <= window.endMinutes

    return {
      ...point,
      active: isActive,
      status: buildStatus(isActive, point.passable),
    }
  })

  return {
    points: resolvedPoints,
    resolvedTime: resolvedMinutes !== null ? formatMinutesAsHm(resolvedMinutes) : null,
  }
}
