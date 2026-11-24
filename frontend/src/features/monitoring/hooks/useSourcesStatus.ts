import { useQuery } from '@tanstack/react-query'
import { monitoringKeys } from '@/features/monitoring/hooks/monitoringKeys'
import { sourcesService } from '@/services/sourcesService'

export function useSourcesStatus() {
  return useQuery({
    queryKey: monitoringKeys.sourcesStatus(),
    queryFn: () => sourcesService.getSourcesStatus(),
    refetchInterval: 60_000,
  })
}
