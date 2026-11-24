import { useQuery } from '@tanstack/react-query'
import { monitoringKeys } from '@/features/monitoring/hooks/monitoringKeys'
import { alertsService } from '@/services/alertsService'
import type { ScenarioQueryParams } from '@/types/alerts'

export interface CoordinatesInput {
  lat: number
  lon: number
}

export function useCoordinatesAlert(
  coordinates: CoordinatesInput | null,
  scenario?: ScenarioQueryParams,
) {
  return useQuery({
    queryKey: monitoringKeys.coordinates(
      coordinates?.lat ?? 0,
      coordinates?.lon ?? 0,
      scenario,
    ),
    queryFn: () => {
      if (coordinates === null) {
        throw new Error('Coordenadas não informadas para consulta.')
      }

      return alertsService.getCoordinatesAlert(coordinates.lat, coordinates.lon, scenario)
    },
    enabled: coordinates !== null,
  })
}
