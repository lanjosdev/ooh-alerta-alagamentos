import { useQuery } from '@tanstack/react-query'
import { monitoringKeys } from '@/features/monitoring/hooks/monitoringKeys'
import { alertsService } from '@/services/alertsService'
import type { AlertTarget, ScenarioQueryParams } from '@/types/alerts'

export function useRssFeed(
  target: AlertTarget | null,
  scenario?: ScenarioQueryParams,
  enabled = true,
) {
  const rssScenario: ScenarioQueryParams = {
    cgeDate: scenario?.cgeDate,
    simulate: scenario?.simulate,
  }

  return useQuery({
    queryKey: monitoringKeys.rss(target, rssScenario),
    queryFn: () => {
      if (target === null) {
        throw new Error('Alvo não informado para consulta do feed RSS.')
      }

      return alertsService.getRssFeedXml(target, rssScenario)
    },
    enabled: target !== null && enabled,
  })
}
