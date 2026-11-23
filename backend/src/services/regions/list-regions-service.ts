import type {
  MonitoringRegion,
  RegionFilters,
  RegionRepository,
} from '../../repositories/region-repository.js'

export class ListRegionsService {
  constructor(private readonly regionRepository: RegionRepository) {}

  async execute(filters?: RegionFilters): Promise<MonitoringRegion[]> {
    return this.regionRepository.listAll(filters)
  }
}
