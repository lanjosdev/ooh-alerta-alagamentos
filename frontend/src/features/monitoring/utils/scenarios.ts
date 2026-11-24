import type { OohAlertDecision, ScenarioQueryParams } from '@/types/alerts'

export type ScenarioPresetId =
  | 'realtime'
  | 'cge_rain_2026_01_15'
  | 'simulate_normal'
  | 'simulate_attention'
  | 'simulate_alert'
  | 'simulate_critical'

export interface ScenarioPreset {
  id: ScenarioPresetId
  label: string
  shortLabel: string
  description: string
  query: ScenarioQueryParams
  isSimulation: boolean
}

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: 'realtime',
    label: 'Tempo Real (Hoje)',
    shortLabel: 'Tempo Real',
    description: 'Leitura ao vivo de Open-Meteo, INMET e CGE-SP.',
    query: {},
    isSimulation: false,
  },
  {
    id: 'cge_rain_2026_01_15',
    label: 'Dia Chuvoso Real (CGE 15/01/2026)',
    shortLabel: 'CGE 15/01/2026',
    description: 'Consulta pontos reais de alagamento registrados pelo CGE-SP em 15/01/2026.',
    query: { cgeDate: '15/01/2026' },
    isSimulation: true,
  },
  {
    id: 'simulate_normal',
    label: 'Simular Normal',
    shortLabel: 'Simular Normal',
    description: 'Força nível 0 (NORMAL) mantendo dados climáticos reais.',
    query: { simulate: 'normal' },
    isSimulation: true,
  },
  {
    id: 'simulate_attention',
    label: 'Simular Atenção',
    shortLabel: 'Simular Atenção',
    description: 'Força nível 1 (ATENCAO) com gatilho OOH ativo.',
    query: { simulate: 'attention' },
    isSimulation: true,
  },
  {
    id: 'simulate_alert',
    label: 'Simular Alerta',
    shortLabel: 'Simular Alerta',
    description: 'Força nível 2 (ALERTA) com gatilho OOH ativo.',
    query: { simulate: 'alert' },
    isSimulation: true,
  },
  {
    id: 'simulate_critical',
    label: 'Simular Crítico',
    shortLabel: 'Simular Crítico',
    description: 'Força nível 3 (CRITICO) com override máximo OOH.',
    query: { simulate: 'critical' },
    isSimulation: true,
  },
] as const

export function getScenarioPreset(presetId: ScenarioPresetId): ScenarioPreset {
  return SCENARIO_PRESETS.find((preset) => preset.id === presetId) ?? SCENARIO_PRESETS[0]
}

export const ZONE_FILTER_OPTIONS = [
  'Todas',
  'Centro',
  'Zona Norte',
  'Zona Oeste',
  'Zona Leste',
  'Zona Sul',
  'Zona Sudeste',
] as const

export type ZoneFilter = (typeof ZONE_FILTER_OPTIONS)[number]
export type SeverityFilter = 'all' | 'alerts_only'

function normalizeZoneText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function filterRegions(
  regions: OohAlertDecision[],
  zoneFilter: ZoneFilter,
  severityFilter: SeverityFilter,
): OohAlertDecision[] {
  const normalizedTargetZone = normalizeZoneText(zoneFilter)

  return regions.filter((region) => {
    if (zoneFilter !== 'Todas') {
      const regionZone = region.location.zone ? normalizeZoneText(region.location.zone) : ''
      if (regionZone !== normalizedTargetZone) {
        return false
      }
    }

    if (severityFilter === 'alerts_only' && region.severityLevel < 1) {
      return false
    }

    return true
  })
}
