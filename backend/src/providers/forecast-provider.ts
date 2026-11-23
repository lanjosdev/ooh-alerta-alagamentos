export interface HourlyRainPoint {
  time: string
  precipitationProbabilityPercent: number
  precipitationMm: number
  weatherCode: number
}

export interface RegionForecast {
  provider: string
  gridLatitude: number
  gridLongitude: number
  timezone: string
  maxRainProbabilityNext2hPercent: number
  expectedRainNext2hMm: number
  peakRainIntensityNext2hMmPerHour: number
  maxRainProbabilityNext6hPercent: number
  expectedRainNext6hMm: number
  hourly: HourlyRainPoint[]
}

export interface ForecastProvider {
  readonly providerName: string
  getHourlyForecast(lat: number, lon: number, now?: Date): Promise<RegionForecast>
}
