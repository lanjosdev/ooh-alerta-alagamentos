import { useQuery } from '@tanstack/react-query'
import { monitoringKeys } from '@/features/monitoring/hooks/monitoringKeys'
import { alertsService } from '@/services/alertsService'
import type { CityOverviewFilters } from '@/types/alerts'

export function useCityOverview(filters?: CityOverviewFilters) {
  const isHistorical = Boolean(filters?.date || filters?.cgeDate)

  return useQuery({
    queryKey: monitoringKeys.overview(filters),
    queryFn: () => alertsService.getCityOverview(filters),
    staleTime: isHistorical ? Infinity : 30_000,
    refetchInterval: isHistorical ? false : 60_000,
  })
}
