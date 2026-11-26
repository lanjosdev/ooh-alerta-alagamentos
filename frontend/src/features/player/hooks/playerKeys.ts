import type { ScenarioQueryParams } from '@/types/alerts'
import type { PlayerTarget } from '@/types/player'

function normalizeScenario(scenario?: ScenarioQueryParams) {
  return {
    date: scenario?.date ?? null,
    time: scenario?.time ?? null,
    cgeDate: scenario?.cgeDate ?? null,
    simulate: scenario?.simulate ?? null,
  }
}

function normalizeTarget(target: PlayerTarget | null) {
  if (target === null) {
    return null
  }

  if (target.kind === 'asset') {
    return { kind: 'asset' as const, assetId: target.assetId }
  }

  return {
    kind: 'coordinates' as const,
    lat: Number(target.lat.toFixed(5)),
    lon: Number(target.lon.toFixed(5)),
  }
}

export const playerKeys = {
  all: ['player'] as const,
  assets: (scenario?: ScenarioQueryParams) =>
    [...playerKeys.all, 'assets', normalizeScenario(scenario)] as const,
  scene: (target: PlayerTarget | null, scenario?: ScenarioQueryParams) =>
    [...playerKeys.all, 'scene', normalizeTarget(target), normalizeScenario(scenario)] as const,
  geocode: (query: string | null) =>
    [...playerKeys.all, 'geocode', query ? query.trim().toLowerCase() : null] as const,
}
