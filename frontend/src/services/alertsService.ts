import { getValidatedEnv } from '@/env'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type {
  AlertTarget,
  CityOverviewData,
  CityOverviewFilters,
  OohAlertDecision,
  ScenarioQueryParams,
} from '@/types/alerts'
import type { ApiResponse } from '@/types/api'

function compactScenarioParams(scenario?: ScenarioQueryParams): Record<string, string> {
  const params: Record<string, string> = {}

  if (scenario?.cgeDate) {
    params.cgeDate = scenario.cgeDate
  }

  if (scenario?.simulate) {
    params.simulate = scenario.simulate
  }

  return params
}

function compactOverviewParams(filters?: CityOverviewFilters): Record<string, string> {
  const params = compactScenarioParams(filters)

  if (filters?.zone) {
    params.zone = filters.zone
  }

  if (filters?.ibgeCode) {
    params.ibgeCode = filters.ibgeCode
  }

  return params
}

function buildTargetPath(target: AlertTarget, format: 'json' | 'xml'): string {
  const suffix = format === 'xml' ? '/feed.xml' : ''

  if (target.kind === 'region') {
    return `/alerts/regions/${encodeURIComponent(target.regionId)}${suffix}`
  }

  return `/alerts/by-coordinates${suffix}`
}

export const alertsService = Object.freeze({
  async getCityOverview(filters?: CityOverviewFilters): Promise<CityOverviewData> {
    const response = await apiClient.get<ApiResponse<CityOverviewData>>('/alerts/regions', {
      params: compactOverviewParams(filters),
    })
    return unwrapApiResponse(response)
  },

  async getRegionAlert(
    regionId: string,
    scenario?: ScenarioQueryParams,
  ): Promise<OohAlertDecision> {
    const response = await apiClient.get<ApiResponse<OohAlertDecision>>(
      `/alerts/regions/${encodeURIComponent(regionId)}`,
      {
        params: compactScenarioParams(scenario),
      },
    )
    return unwrapApiResponse(response)
  },

  async getCoordinatesAlert(
    lat: number,
    lon: number,
    scenario?: ScenarioQueryParams,
  ): Promise<OohAlertDecision> {
    const response = await apiClient.get<ApiResponse<OohAlertDecision>>('/alerts/by-coordinates', {
      params: {
        lat,
        lon,
        ...compactScenarioParams(scenario),
      },
    })
    return unwrapApiResponse(response)
  },

  async getRssFeedXml(target: AlertTarget, scenario?: ScenarioQueryParams): Promise<string> {
    const path = buildTargetPath(target, 'xml')
    const baseParams = compactScenarioParams(scenario)
    const params =
      target.kind === 'coordinates'
        ? { lat: target.lat, lon: target.lon, ...baseParams }
        : baseParams

    const response = await apiClient.get<string>(path, {
      params,
      responseType: 'text',
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
      },
    })

    if (typeof response.data !== 'string' || response.data.trim().length === 0) {
      throw new ApiError('Feed XML / RSS 2.0 retornou conteúdo vazio.', {
        status: response.status,
      })
    }

    return response.data
  },

  buildAlertEndpointUrl(
    target: AlertTarget,
    format: 'json' | 'xml',
    scenario?: ScenarioQueryParams,
  ): string {
    const baseUrl = getValidatedEnv().VITE_API_BASE_URL.replace(/\/+$/, '')
    const path = buildTargetPath(target, format)
    const searchParams = new URLSearchParams()

    if (target.kind === 'coordinates') {
      searchParams.set('lat', String(target.lat))
      searchParams.set('lon', String(target.lon))
    }

    if (scenario?.cgeDate) {
      searchParams.set('cgeDate', scenario.cgeDate)
    }

    if (scenario?.simulate) {
      searchParams.set('simulate', scenario.simulate)
    }

    const queryString = searchParams.toString()
    return queryString.length > 0 ? `${baseUrl}${path}?${queryString}` : `${baseUrl}${path}`
  },
})
