import type { FloodingPoint } from '../../providers/flooding-monitor-provider.js'
import type { RegionForecast } from '../../providers/forecast-provider.js'
import type { OfficialWeatherAlert } from '../../providers/official-alerts-provider.js'
import type { OohDisplayMessage, RiskEvaluation } from './alert-types.js'

export interface BuildOohMessageInput {
  locationName: string
  zone: string | null
  evaluation: RiskEvaluation
  forecast: RegionForecast | null
  floodingPointsInZone: readonly FloodingPoint[]
  officialAlerts: readonly OfficialWeatherAlert[]
}

function selectTopActiveStreets(points: readonly FloodingPoint[], limit: number = 2): string[] {
  const prioritized = [...points]
    .filter((point) => point.active)
    .sort((a, b) => Number(a.passable) - Number(b.passable))

  const uniqueStreets: string[] = []
  for (const point of prioritized) {
    if (!uniqueStreets.includes(point.street)) {
      uniqueStreets.push(point.street)
    }
    if (uniqueStreets.length >= limit) {
      break
    }
  }

  return uniqueStreets
}

export class BuildOohMessageService {
  execute(input: BuildOohMessageInput): OohDisplayMessage {
    const { locationName, zone, evaluation, forecast, floodingPointsInZone, officialAlerts } = input
    const activeStreets = selectTopActiveStreets(floodingPointsInZone, 2)
    const rainProb = forecast ? Math.round(forecast.maxRainProbabilityNext2hPercent) : null
    const probabilityNote =
      rainProb !== null ? ` Probabilidade de chuva nas próximas 2h: ${rainProb}%.` : ''

    let headline: string
    let message: string

    switch (evaluation.severityLevel) {
      case 3:
        headline = `ALERTA CRÍTICO DE ALAGAMENTO — ${locationName}`
        message =
          activeStreets.length > 0
            ? `Alagamento ativo em ${activeStreets.join(' e ')}. Evite vias alagadas e busque rotas alternativas.${probabilityNote}`
            : `Risco crítico de chuva intensa e alagamentos em ${locationName}.${probabilityNote} Evite deslocamentos em áreas baixas.`
        break

      case 2:
        headline = `ALERTA DE CHUVA E ALAGAMENTO — ${locationName}`
        message =
          activeStreets.length > 0
            ? `Ponto de alagamento ativo em ${activeStreets.join(' e ')}. Redobre a atenção no trânsito.${probabilityNote}`
            : officialAlerts.length > 0
              ? `${officialAlerts[0].title} (${officialAlerts[0].severity}) em vigor para ${locationName}.${probabilityNote}`
              : `Condição severa de chuva prevista para ${locationName}.${probabilityNote} Evite áreas sujeitas a alagamento.`
        break

      case 1:
        headline = `ATENÇÃO PARA CHUVA FORTE — ${locationName}`
        message =
          rainProb !== null
            ? `Chuva prevista para ${locationName} (${rainProb}% de chance nas próximas 2h). Atenção em pontos críticos.`
            : officialAlerts.length > 0
              ? `${officialAlerts[0].title} (${officialAlerts[0].severity}) em vigor para ${locationName}. Atenção no trânsito.`
              : `Monitoramento em estado de atenção para ${locationName}. Acompanhe novas atualizações.`
        break

      case 0:
      default:
        headline = `TEMPO ESTÁVEL — ${locationName}`
        message =
          rainProb !== null
            ? `Sem alertas críticos em ${locationName}. Chance de chuva nas próximas 2h: ${rainProb}%.`
            : `Sem alertas ativos ou ocorrências críticas registradas para ${locationName}.`
        break
    }

    const subtextParts = [
      zone ? `${locationName} (${zone})` : locationName,
      `Nível ${evaluation.severityLabel} (${evaluation.riskScore}/100)`,
    ]

    if (activeStreets.length > 0) {
      subtextParts.push(`CGE-SP: ${activeStreets.join(', ')}`)
    }
    if (evaluation.simulated) {
      subtextParts.push('SIMULAÇÃO')
    }

    return {
      headline,
      message,
      subtext: subtextParts.join(' • '),
    }
  }
}
