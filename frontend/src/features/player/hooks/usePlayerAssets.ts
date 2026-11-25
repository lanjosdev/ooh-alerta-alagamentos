import { useQuery } from '@tanstack/react-query'
import { playerKeys } from '@/features/player/hooks/playerKeys'
import { playerService } from '@/services/playerService'
import type { ScenarioQueryParams } from '@/types/alerts'

export function usePlayerAssets(scenario?: ScenarioQueryParams) {
  const isHistorical = Boolean(scenario?.date || scenario?.cgeDate)

  return useQuery({
    queryKey: playerKeys.assets(scenario),
    queryFn: () => playerService.getAssets(scenario),
    staleTime: isHistorical ? Infinity : 30_000,
    refetchInterval: isHistorical ? false : 60_000,
  })
}
