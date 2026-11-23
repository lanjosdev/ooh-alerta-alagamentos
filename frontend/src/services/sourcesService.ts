import { apiClient, unwrapApiResponse } from '@/lib/api'
import type { SourcesStatusData } from '@/types/alerts'
import type { ApiResponse } from '@/types/api'

export const sourcesService = Object.freeze({
  async getSourcesStatus(): Promise<SourcesStatusData> {
    const response = await apiClient.get<ApiResponse<SourcesStatusData>>('/sources/status')
    return unwrapApiResponse(response)
  },
})
