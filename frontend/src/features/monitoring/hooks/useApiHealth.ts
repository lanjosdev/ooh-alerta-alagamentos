import { useQuery } from '@tanstack/react-query'
import { monitoringKeys } from '@/features/monitoring/hooks/monitoringKeys'
import { sourcesService } from '@/services/sourcesService'

export function useApiHealth() {
  return useQuery({
    queryKey: monitoringKeys.health(),
    queryFn: () => sourcesService.getHealth(),
    staleTime: 60_000,
  })
}
