import type { OohAssetRepository } from '../../repositories/ooh-asset-repository.js'
import type { SimulationMode } from '../alerts/alert-types.js'
import type { GetLocationAlertService } from '../alerts/get-location-alert-service.js'
import type { PlayerAssetSummary } from './player-types.js'

export interface ListPlayerAssetsInput {
  date?: string
  time?: string
  cgeDate?: string
  simulate?: SimulationMode
}

export class ListPlayerAssetsService {
  constructor(
    private readonly oohAssetRepository: OohAssetRepository,
    private readonly getLocationAlertService: GetLocationAlertService,
  ) {}

  async execute(input: ListPlayerAssetsInput = {}): Promise<PlayerAssetSummary[]> {
    this.getLocationAlertService.validateInput({
      date: input.date,
      time: input.time,
      cgeDate: input.cgeDate,
      simulate: input.simulate,
    })

    const assets = await this.oohAssetRepository.listAll()

    return Promise.all(
      assets.map(async (asset) => {
        const decision = await this.getLocationAlertService.execute({
          mode: 'coordinates',
          lat: asset.latitude,
          lon: asset.longitude,
          date: input.date,
          time: input.time,
          cgeDate: input.cgeDate,
          simulate: input.simulate,
        })

        return {
          id: asset.id,
          name: asset.name,
          corridorName: asset.corridorName,
          neighborhood: asset.neighborhood,
          zone: asset.zone,
          latitude: asset.latitude,
          longitude: asset.longitude,
          camera: asset.camera,
          severityLevel: decision.severityLevel,
          severityLabel: decision.severityLabel,
          riskScore: decision.riskScore,
          triggerOverride: decision.triggerOverride,
          activeInZoneCount: decision.flooding.activeInZoneCount,
        }
      }),
    )
  }
}
