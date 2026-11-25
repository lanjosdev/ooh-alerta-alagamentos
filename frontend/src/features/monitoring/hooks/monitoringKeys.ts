import type { AlertTarget, CityOverviewFilters, ScenarioQueryParams } from '@/types/alerts'

function normalizeScenario(scenario?: ScenarioQueryParams) {
  return {
    date: scenario?.date ?? null,
    time: scenario?.time ?? null,
    cgeDate: scenario?.cgeDate ?? null,
    simulate: scenario?.simulate ?? null,
  }
}

function normalizeOverviewFilters(filters?: CityOverviewFilters) {
  return {
    ...normalizeScenario(filters),
    zone: filters?.zone ?? null,
    ibgeCode: filters?.ibgeCode ?? null,
  }
}

export const monitoringKeys = {
  all: ['monitoring'] as const,
  overview: (filters?: CityOverviewFilters) =>
    [...monitoringKeys.all, 'overview', normalizeOverviewFilters(filters)] as const,
  region: (regionId: string, scenario?: ScenarioQueryParams) =>
    [...monitoringKeys.all, 'region', regionId, normalizeScenario(scenario)] as const,
  coordinates: (lat: number, lon: number, scenario?: ScenarioQueryParams) =>
    [...monitoringKeys.all, 'coordinates', lat, lon, normalizeScenario(scenario)] as const,
  rss: (target: AlertTarget | null, scenario?: ScenarioQueryParams) =>
    [...monitoringKeys.all, 'rss', target, normalizeScenario(scenario)] as const,
  health: () => [...monitoringKeys.all, 'health'] as const,
  sourcesStatus: () => [...monitoringKeys.all, 'sources-status'] as const,
}
