import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { FloodingPoint } from '../flooding-monitor-provider.js'
import { parseCgeFloodingPointsHtml } from './cge-sp-parser.js'
import { parseCgeTimeWindow, resolveHistoricalFloodingSnapshot } from './cge-sp-time-window.js'

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__')

function makePoint(overrides: Partial<FloodingPoint>): FloodingPoint {
  return {
    zone: 'Zona Oeste',
    neighborhood: 'Pinheiros',
    street: 'AV MARGINAL PINHEIROS',
    direction: 'AMBOS',
    reference: null,
    timeWindow: 'De 10:00 a 11:00',
    status: 'inativo-transitavel',
    active: false,
    passable: true,
    ...overrides,
  }
}

describe('cge-sp-time-window', () => {
  it('faz parse de De HH:MM a HH:MM, Desde HH:MM (hoje vs passado) e virada de meia-noite', () => {
    expect(parseCgeTimeWindow('De 19:50 a 21:15')).toEqual({
      startMinutes: 19 * 60 + 50,
      endMinutes: 21 * 60 + 15,
    })

    // Virada de meia-noite estende até 23:59 do dia de início
    expect(parseCgeTimeWindow('De 23:10 a 01:30')).toEqual({
      startMinutes: 23 * 60 + 10,
      endMinutes: 23 * 60 + 59,
    })

    expect(parseCgeTimeWindow('Desde 16:08', { isToday: false })).toEqual({
      startMinutes: 16 * 60 + 8,
      endMinutes: 23 * 60 + 59,
    })

    expect(parseCgeTimeWindow('Desde 16:08', { isToday: true, nowMinutes: 17 * 60 + 30 })).toEqual({
      startMinutes: 16 * 60 + 8,
      endMinutes: 17 * 60 + 30,
    })

    expect(parseCgeTimeWindow(null)).toBeNull()
    expect(parseCgeTimeWindow('Horário indisponível')).toBeNull()
  })

  it('reconstrói snapshot histórico real de 24/01/2025 para horário específico e pico automático', () => {
    const html = readFileSync(
      path.join(fixturesDir, 'cge-alagamentos-24-01-2025-historico.html'),
      'utf8',
    )
    const parsedPoints = parseCgeFloodingPointsHtml(html)
    expect(parsedPoints).toHaveLength(3)

    // No pico automático (20:20), todos os 3 pontos estão ativos simultaneamente
    const peakSnapshot = resolveHistoricalFloodingSnapshot(parsedPoints)
    expect(peakSnapshot.resolvedTime).toBe('20:20')
    expect(peakSnapshot.points.every((point) => point.active)).toBe(true)
    expect(peakSnapshot.points.map((point) => point.status)).toEqual([
      'ativo-intransitavel',
      'ativo-transitavel',
      'ativo-intransitavel',
    ])

    // Às 20:00 apenas Marginal Pinheiros estava ativa
    const earlySnapshot = resolveHistoricalFloodingSnapshot(parsedPoints, '20:00')
    expect(earlySnapshot.resolvedTime).toBe('20:00')
    expect(earlySnapshot.points.map((point) => ({ street: point.street, active: point.active, status: point.status }))).toEqual([
      { street: 'AV MARGINAL PINHEIROS', active: true, status: 'ativo-intransitavel' },
      { street: 'AV DO ESTADO', active: false, status: 'inativo-transitavel' },
      { street: 'PTE DAS BANDEIRAS SEN ROMEU TUMA', active: false, status: 'inativo-intransitavel' },
    ])
  })

  it('desempata pico automático por maior quantidade de intransitáveis e depois horário mais cedo', () => {
    const points: FloodingPoint[] = [
      makePoint({ street: 'VIA 1', timeWindow: 'De 14:00 a 14:30', passable: true }),
      makePoint({ street: 'VIA 2', timeWindow: 'De 14:10 a 14:30', passable: true }),
      makePoint({ street: 'VIA 3', timeWindow: 'De 16:00 a 16:30', passable: false }),
      makePoint({ street: 'VIA 4', timeWindow: 'De 16:15 a 16:30', passable: false }),
      makePoint({ street: 'VIA 5', timeWindow: null, passable: false }),
    ]

    const snapshot = resolveHistoricalFloodingSnapshot(points)
    expect(snapshot.resolvedTime).toBe('16:15')
    expect(snapshot.points.filter((p) => p.active).map((p) => p.street)).toEqual(['VIA 3', 'VIA 4'])
    expect(snapshot.points.find((p) => p.street === 'VIA 5')).toMatchObject({
      active: false,
      status: 'inativo-intransitavel',
    })
  })

  it('retorna resolvedTime null quando não há pontos ou nenhuma janela válida no dia', () => {
    expect(resolveHistoricalFloodingSnapshot([])).toEqual({ points: [], resolvedTime: null })

    const withoutWindow = resolveHistoricalFloodingSnapshot([
      makePoint({ timeWindow: null, active: true, status: 'ativo-transitavel' }),
    ])
    expect(withoutWindow.resolvedTime).toBeNull()
    expect(withoutWindow.points[0]).toMatchObject({
      active: false,
      status: 'inativo-transitavel',
    })
  })
})
