import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { playerKeys } from '@/features/player/hooks/playerKeys'
import { toApiError } from '@/lib/api-error'
import { playerService } from '@/services/playerService'
import type { ScenarioQueryParams } from '@/types/alerts'
import type { PlayerTarget } from '@/types/player'

export function usePlayerScene(target: PlayerTarget | null, scenario?: ScenarioQueryParams) {
  const isHistorical = Boolean(scenario?.date || scenario?.cgeDate)

  return useQuery({
    queryKey: playerKeys.scene(target, scenario),
    queryFn: () => {
      if (target === null) {
        throw new Error('Alvo do player não informado.')
      }

      return playerService.getScene(target, scenario)
    },
    enabled: target !== null,
    placeholderData: keepPreviousData,
    staleTime: isHistorical ? Infinity : 30_000,
    refetchInterval: isHistorical ? false : 60_000,
    retry: (failureCount, error) => {
      if (failureCount >= 1) {
        return false
      }
      const apiError = toApiError(error)
      if (
        apiError.isTimeout ||
        (apiError.status !== null && apiError.status >= 400 && apiError.status < 500)
      ) {
        return false
      }
      return true
    },
  })
}
