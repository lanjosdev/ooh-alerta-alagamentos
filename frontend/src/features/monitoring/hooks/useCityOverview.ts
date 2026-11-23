import { useQuery } from '@tanstack/react-query'
import { monitoringKeys } from '@/features/monitoring/hooks/monitoringKeys'
import { alertsService } from '@/services/alertsService'
import type { CityOverviewFilters } from '@/types/alerts'

export function useCityOverview(filters?: CityOverviewFilters) {
  return useQuery({
    queryKey: monitoringKeys.overview(filters),
    queryFn: () => alertsService.getCityOverview(filters),
    refetchInterval: 60_000,
  })
}
