import { getValidatedEnv } from '@/env'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import type { ScenarioQueryParams } from '@/types/alerts'
import type { ApiResponse } from '@/types/api'
import type {
  PlayerAssetsData,
  PlayerGeocodeData,
  PlayerSceneData,
  PlayerTarget,
} from '@/types/player'

function compactPlayerScenarioParams(scenario?: ScenarioQueryParams): Record<string, string> {
  const params: Record<string, string> = {}

  if (scenario?.date) {
    params.date = scenario.date
  }

  if (scenario?.time) {
    params.time = scenario.time
  }

  if (scenario?.cgeDate) {
    params.cgeDate = scenario.cgeDate
  }

  if (scenario?.simulate) {
    params.simulate = scenario.simulate
  }

  return params
}

export const playerService = Object.freeze({
  async getAssets(scenario?: ScenarioQueryParams): Promise<PlayerAssetsData> {
    const response = await apiClient.get<ApiResponse<PlayerAssetsData>>('/player/assets', {
      params: compactPlayerScenarioParams(scenario),
    })
    return unwrapApiResponse(response)
  },

  async geocodeAddress(query: string): Promise<PlayerGeocodeData> {
    const response = await apiClient.get<ApiResponse<PlayerGeocodeData>>('/player/geocode', {
      params: { q: query.trim() },
    })
    return unwrapApiResponse(response)
  },

  async getScene(target: PlayerTarget, scenario?: ScenarioQueryParams): Promise<PlayerSceneData> {
    const scenarioParams = compactPlayerScenarioParams(scenario)
    const params: Record<string, string | number> =
      target.kind === 'asset'
        ? { assetId: target.assetId, ...scenarioParams }
        : { lat: target.lat, lon: target.lon, ...scenarioParams }

    const response = await apiClient.get<ApiResponse<PlayerSceneData>>('/player/scene', {
      params,
    })
    return unwrapApiResponse(response)
  },

  buildSceneEndpointUrl(target: PlayerTarget, scenario?: ScenarioQueryParams): string {
    const baseUrl = getValidatedEnv().VITE_API_BASE_URL.replace(/\/+$/, '')
    const searchParams = new URLSearchParams()

    if (target.kind === 'asset') {
      searchParams.set('assetId', target.assetId)
    } else {
      searchParams.set('lat', String(target.lat))
      searchParams.set('lon', String(target.lon))
    }

    for (const [key, value] of Object.entries(compactPlayerScenarioParams(scenario))) {
      searchParams.set(key, value)
    }

    return `${baseUrl}/player/scene?${searchParams.toString()}`
  },
})
