import type {
  FloodingPoint,
  StationRainfall,
} from '../../providers/flooding-monitor-provider.js'
import type { RegionForecast } from '../../providers/forecast-provider.js'
import type { OfficialWeatherAlert } from '../../providers/official-alerts-provider.js'
import type {
  RiskEvaluation,
  SeverityLabel,
  SeverityLevel,
  SimulationMode,
} from './alert-types.js'

export interface EvaluateRiskInput {
  forecast: RegionForecast | null
  officialAlerts: readonly OfficialWeatherAlert[]
  floodingPointsInZone: readonly FloodingPoint[]
  stationRainfall: StationRainfall | null
  historicalRiskWeight: number
  simulate?: SimulationMode
}

const SIMULATION_PRESETS: Record<
  SimulationMode,
  { severityLevel: SeverityLevel; severityLabel: SeverityLabel; riskScore: number; reason: string }
> = {
  normal: {
    severityLevel: 0,
    severityLabel: 'NORMAL',
    riskScore: 10,
    reason: 'Modo de simulação ativo: cenário NORMAL',
  },
  attention: {
    severityLevel: 1,
    severityLabel: 'ATENCAO',
    riskScore: 45,
    reason: 'Modo de simulação ativo: cenário ATENÇÃO',
  },
  alert: {
    severityLevel: 2,
    severityLabel: 'ALERTA',
    riskScore: 75,
    reason: 'Modo de simulação ativo: cenário ALERTA',
  },
  critical: {
    severityLevel: 3,
    severityLabel: 'CRITICO',
    riskScore: 95,
    reason: 'Modo de simulação ativo: cenário CRÍTICO',
  },
}

const SEVERITY_LABELS: Record<SeverityLevel, SeverityLabel> = {
  0: 'NORMAL',
  1: 'ATENCAO',
  2: 'ALERTA',
  3: 'CRITICO',
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function getSeverityLabel(level: SeverityLevel): SeverityLabel {
  return SEVERITY_LABELS[level]
}

export class EvaluateRiskService {
  execute(input: EvaluateRiskInput): RiskEvaluation {
    if (input.simulate) {
      const preset = SIMULATION_PRESETS[input.simulate]
      return {
        severityLevel: preset.severityLevel,
        severityLabel: preset.severityLabel,
        triggerOverride: preset.severityLevel >= 1,
        riskScore: preset.riskScore,
        simulated: true,
        reasons: [preset.reason],
      }
    }

    const activeFloodings = input.floodingPointsInZone.filter((point) => point.active)
    const activeImpassable = activeFloodings.filter((point) => !point.passable)
    const activePassable = activeFloodings.filter((point) => point.passable)

    const stationRainMm = input.stationRainfall?.currentPeriodMm ?? 0
    const prob2h = input.forecast?.maxRainProbabilityNext2hPercent ?? 0
    const peak2h = input.forecast?.peakRainIntensityNext2hMmPerHour ?? 0
    const highestInmetRank = input.officialAlerts.reduce(
      (maxRank, alert) => Math.max(maxRank, alert.severityRank),
      0,
    )

    const reasons: string[] = []
    let severityLevel: SeverityLevel = 0

    // Critérios Nível 3 (CRÍTICO)
    if (activeImpassable.length >= 1) {
      severityLevel = 3
      reasons.push(
        `${activeImpassable.length} ponto(s) de alagamento ativo e intransitável na zona`,
      )
    }

    if (stationRainMm >= 40 && peak2h >= 10) {
      severityLevel = 3
      reasons.push(
        `Chuva na estação CGE (${stationRainMm.toFixed(1)} mm) combinada com pico previsto de ${peak2h.toFixed(1)} mm/h nas próximas 2h`,
      )
    }

    // Critérios Nível 2 (ALERTA)
    if (activePassable.length >= 1) {
      severityLevel = Math.max(severityLevel, 2) as SeverityLevel
      reasons.push(`${activePassable.length} ponto(s) de alagamento ativo e transitável na zona`)
    }

    if (stationRainMm >= 20) {
      severityLevel = Math.max(severityLevel, 2) as SeverityLevel
      reasons.push(`Chuva acumulada elevada na estação CGE (${stationRainMm.toFixed(1)} mm)`)
    }

    if (prob2h >= 65 && peak2h >= 15) {
      severityLevel = Math.max(severityLevel, 2) as SeverityLevel
      reasons.push(
        `Previsão de chuva intensa nas próximas 2h (${prob2h}% de chance, pico de ${peak2h.toFixed(1)} mm/h)`,
      )
    }

    if (highestInmetRank >= 2) {
      severityLevel = Math.max(severityLevel, 2) as SeverityLevel
      reasons.push(`Aviso oficial INMET severo ativo (rank ${highestInmetRank})`)
    }

    // Critérios Nível 1 (ATENÇÃO)
    if (prob2h >= 60 && peak2h >= 5) {
      severityLevel = Math.max(severityLevel, 1) as SeverityLevel
      reasons.push(
        `Previsão de chuva moderada a forte nas próximas 2h (${prob2h}% de chance, pico de ${peak2h.toFixed(1)} mm/h)`,
      )
    }

    if (highestInmetRank === 1) {
      severityLevel = Math.max(severityLevel, 1) as SeverityLevel
      reasons.push('Aviso oficial INMET ativo em grau Perigo Potencial')
    }

    if (reasons.length === 0) {
      reasons.push('Condições meteorológicas e viárias dentro da normalidade')
    }

    const weight = clamp(input.historicalRiskWeight, 0, 1)
    let riskScore: number

    if (severityLevel === 3) {
      const intensityBonus = activeImpassable.length * 3 + (stationRainMm >= 40 ? 4 : 0)
      riskScore = clamp(85 + Math.round(weight * 8) + Math.min(7, intensityBonus), 85, 100)
    } else if (severityLevel === 2) {
      const intensityBonus =
        activePassable.length * 4 +
        (stationRainMm >= 20 ? 5 : 0) +
        (highestInmetRank >= 2 ? 5 : 0) +
        (prob2h >= 65 && peak2h >= 15 ? 5 : 0)
      riskScore = clamp(60 + Math.round(weight * 10) + Math.min(14, intensityBonus), 60, 84)
    } else if (severityLevel === 1) {
      const intensityBonus = Math.round((prob2h / 100) * 10) + (highestInmetRank === 1 ? 7 : 0)
      riskScore = clamp(30 + Math.round(weight * 12) + Math.min(17, intensityBonus), 30, 59)
    } else {
      riskScore = clamp(
        Math.round(weight * 10 + (prob2h / 100) * 12 + Math.min(7, stationRainMm / 2)),
        0,
        29,
      )
    }

    return {
      severityLevel,
      severityLabel: getSeverityLabel(severityLevel),
      triggerOverride: severityLevel >= 1,
      riskScore,
      simulated: false,
      reasons,
    }
  }
}
