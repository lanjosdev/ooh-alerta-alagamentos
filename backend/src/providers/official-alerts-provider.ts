export type OfficialAlertSeverityRank = 1 | 2 | 3

export interface OfficialWeatherAlert {
  id: string
  code: string
  title: string
  severity: string
  severityRank: OfficialAlertSeverityRank
  colorHex: string
  startsAt: string
  endsAt: string
  risks: string[]
  instructions: string[]
  matchedBy: ('ibge' | 'polygon')[]
}

export interface AlertMatchInput {
  ibgeCode?: string
  lat: number
  lon: number
}

export interface OfficialAlertsProvider {
  readonly providerName: string
  getActiveAlerts(input: AlertMatchInput): Promise<OfficialWeatherAlert[]>
}
