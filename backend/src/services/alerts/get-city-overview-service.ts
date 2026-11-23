import type { RegionRepository } from '../../repositories/region-repository.js'
import { BadRequestError } from '../../utils/application-error.js'
import type { OohAlertDecision, SeverityLabel, SeverityLevel, SimulationMode } from './alert-types.js'
import { getSeverityLabel } from './evaluate-risk-service.js'
import type { GetLocationAlertService } from './get-location-alert-service.js'

export interface GetCityOverviewInput {
  zone?: string
  ibgeCode?: string
  cgeDate?: string
  simulate?: SimulationMode
}

export interface CityOverviewResult {
  generatedAt: string
  summary: {
    totalRegions: number
    overrideActiveCount: number
    highestSeverityLevel: SeverityLevel
    highestSeverityLabel: SeverityLabel
    countsBySeverity: Record<SeverityLabel, number>
  }
  regions: OohAlertDecision[]
}

export class GetCityOverviewService {
  constructor(
    private readonly regionRepository: RegionRepository,
    private readonly getLocationAlertService: GetLocationAlertService,
  ) {}

  async execute(input: GetCityOverviewInput = {}): Promise<CityOverviewResult> {
    if (
      !this.getLocationAlertService.isSimulationEnabled() &&
      (input.cgeDate !== undefined || input.simulate !== undefined)
    ) {
      throw new BadRequestError(
        'Parâmetros de simulação (cgeDate e simulate) estão desabilitados neste ambiente.',
      )
    }

    const regions = await this.regionRepository.listAll({
      zone: input.zone,
      ibgeCode: input.ibgeCode,
    })

    const decisions = await Promise.all(
      regions.map((region) =>
        this.getLocationAlertService.execute({
          mode: 'region',
          regionId: region.id,
          cgeDate: input.cgeDate,
          simulate: input.simulate,
        }),
      ),
    )

    decisions.sort((a, b) => {
      if (b.severityLevel !== a.severityLevel) {
        return b.severityLevel - a.severityLevel
      }
      if (b.riskScore !== a.riskScore) {
        return b.riskScore - a.riskScore
      }
      return a.location.id.localeCompare(b.location.id)
    })

    const countsBySeverity: Record<SeverityLabel, number> = {
      NORMAL: 0,
      ATENCAO: 0,
      ALERTA: 0,
      CRITICO: 0,
    }

    let highestSeverityLevel: SeverityLevel = 0
    let overrideActiveCount = 0

    for (const decision of decisions) {
      countsBySeverity[decision.severityLabel] += 1
      if (decision.triggerOverride) {
        overrideActiveCount += 1
      }
      if (decision.severityLevel > highestSeverityLevel) {
        highestSeverityLevel = decision.severityLevel
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRegions: decisions.length,
        overrideActiveCount,
        highestSeverityLevel,
        highestSeverityLabel: getSeverityLabel(highestSeverityLevel),
        countsBySeverity,
      },
      regions: decisions,
    }
  }
}
