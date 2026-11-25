import { apiClient, unwrapApiResponse } from '@/lib/api'
import type { HealthData, SourcesStatusData } from '@/types/alerts'
import type { ApiResponse } from '@/types/api'

export const sourcesService = Object.freeze({
  async getHealth(): Promise<HealthData> {
    const response = await apiClient.get<ApiResponse<HealthData>>('/health')
    return unwrapApiResponse(response)
  },

  async getSourcesStatus(): Promise<SourcesStatusData> {
    const response = await apiClient.get<ApiResponse<SourcesStatusData>>('/sources/status')
    return unwrapApiResponse(response)
  },
})
