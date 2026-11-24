export interface CurrentWeather {
  observedAt: string
  temperatureC: number | null
  humidityPercent: number | null
  precipitationMm: number
  rainMm: number
  weatherCode: number
  isDay: boolean
  isRaining: boolean
}

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
  current: CurrentWeather | null
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
