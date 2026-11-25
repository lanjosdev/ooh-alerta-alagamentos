import { useQuery } from '@tanstack/react-query'
import { playerKeys } from '@/features/player/hooks/playerKeys'
import { playerService } from '@/services/playerService'

export function useAddressSearch(submittedQuery: string | null) {
  const trimmed = submittedQuery ? submittedQuery.trim() : ''
  const isEnabled = trimmed.length >= 3 && trimmed.length <= 120

  return useQuery({
    queryKey: playerKeys.geocode(isEnabled ? trimmed : null),
    queryFn: () => playerService.geocodeAddress(trimmed),
    enabled: isEnabled,
    staleTime: 5 * 60_000,
    retry: false,
  })
}
