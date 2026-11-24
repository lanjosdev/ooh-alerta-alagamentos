import { describe, expect, it, vi } from 'vitest'
import openMeteoSample from './__fixtures__/open-meteo-sample.json' with { type: 'json' }
import { OpenMeteoForecastProvider } from './open-meteo-forecast-provider.js'

describe('OpenMeteoForecastProvider', () => {
  it('calcula métricas das próximas 2h e 6h no fuso America/Sao_Paulo usando fixture real', async () => {
    let capturedUrl = ''
    const fetchFn: typeof fetch = vi.fn(async (input) => {
      capturedUrl = String(input)
      return new Response(JSON.stringify(openMeteoSample), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = new OpenMeteoForecastProvider({ fetchFn, timeoutMs: 2000 })
    // 2026-11-23T14:25:00-03:00 -> janela inicia em 2026-11-23T14:00
    const referenceNow = new Date('2026-11-23T17:25:00.000Z')
    const forecast = await provider.getHourlyForecast(-23.5672, -46.729, referenceNow)

    expect(capturedUrl).toContain('latitude=-23.5672')
    expect(capturedUrl).toContain('longitude=-46.729')
    expect(capturedUrl).toContain(
      'current=temperature_2m%2Crelative_humidity_2m%2Cprecipitation%2Crain%2Cweather_code%2Cis_day',
    )
    expect(capturedUrl).toContain('timezone=America%2FSao_Paulo')

    expect(forecast).toEqual({
      provider: 'open-meteo',
      gridLatitude: -23.585238,
      gridLongitude: -46.754486,
      timezone: 'America/Sao_Paulo',
      current: {
        observedAt: '2026-11-23T14:15',
        temperatureC: 23.4,
        humidityPercent: 84,
        precipitationMm: 1.8,
        rainMm: 1.8,
        weatherCode: 80,
        isDay: true,
        isRaining: true,
      },
      maxRainProbabilityNext2hPercent: 90,
      expectedRainNext2hMm: 24.6,
      peakRainIntensityNext2hMmPerHour: 18.2,
      maxRainProbabilityNext6hPercent: 90,
      expectedRainNext6hMm: 31,
      hourly: [
        {
          time: '2026-11-23T14:00',
          precipitationProbabilityPercent: 80,
          precipitationMm: 6.4,
          weatherCode: 80,
        },
        {
          time: '2026-11-23T15:00',
          precipitationProbabilityPercent: 90,
          precipitationMm: 18.2,
          weatherCode: 95,
        },
        {
          time: '2026-11-23T16:00',
          precipitationProbabilityPercent: 75,
          precipitationMm: 4.1,
          weatherCode: 63,
        },
        {
          time: '2026-11-23T17:00',
          precipitationProbabilityPercent: 50,
          precipitationMm: 1.3,
          weatherCode: 61,
        },
        {
          time: '2026-11-23T18:00',
          precipitationProbabilityPercent: 40,
          precipitationMm: 0.8,
          weatherCode: 51,
        },
        {
          time: '2026-11-23T19:00',
          precipitationProbabilityPercent: 25,
          precipitationMm: 0.2,
          weatherCode: 3,
        },
      ],
    })
  })

  it('normaliza tempo seco (isRaining=false, isDay=false) e chuva inferida via código WMO', async () => {
    const dryPayload = {
      ...openMeteoSample,
      current: {
        time: '2026-11-23T22:00',
        temperature_2m: 20.156,
        relative_humidity_2m: 68,
        precipitation: 0,
        rain: 0,
        weather_code: 2,
        is_day: 0,
      },
    }

    const dryProvider = new OpenMeteoForecastProvider({
      fetchFn: vi.fn(
        async () =>
          new Response(JSON.stringify(dryPayload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    })

    const dryForecast = await dryProvider.getHourlyForecast(
      -23.5672,
      -46.729,
      new Date('2026-11-23T17:25:00.000Z'),
    )

    expect(dryForecast.current).toEqual({
      observedAt: '2026-11-23T22:00',
      temperatureC: 20.16,
      humidityPercent: 68,
      precipitationMm: 0,
      rainMm: 0,
      weatherCode: 2,
      isDay: false,
      isRaining: false,
    })

    const drizzlePayload = {
      ...openMeteoSample,
      current: {
        time: '2026-11-23T14:30',
        temperature_2m: null,
        relative_humidity_2m: null,
        precipitation: 0,
        rain: 0,
        weather_code: 51,
        is_day: 1,
      },
    }

    const drizzleProvider = new OpenMeteoForecastProvider({
      fetchFn: vi.fn(
        async () =>
          new Response(JSON.stringify(drizzlePayload), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    })

    const drizzleForecast = await drizzleProvider.getHourlyForecast(
      -23.5672,
      -46.729,
      new Date('2026-11-23T17:25:00.000Z'),
    )

    expect(drizzleForecast.current).toEqual({
      observedAt: '2026-11-23T14:30',
      temperatureC: null,
      humidityPercent: null,
      precipitationMm: 0,
      rainMm: 0,
      weatherCode: 51,
      isDay: true,
      isRaining: true,
    })
  })

  it('degrada graciosamente com current=null quando Open-Meteo omite o bloco current', async () => {
    const { current: _omittedCurrent, current_units: _omittedUnits, ...withoutCurrent } =
      openMeteoSample
    const provider = new OpenMeteoForecastProvider({
      fetchFn: vi.fn(
        async () =>
          new Response(JSON.stringify(withoutCurrent), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      ),
    })

    const forecast = await provider.getHourlyForecast(
      -23.5672,
      -46.729,
      new Date('2026-11-23T17:25:00.000Z'),
    )

    expect(forecast.current).toBeNull()
  })

  it('lança erro quando Open-Meteo retorna status HTTP diferente de 2xx', async () => {
    const fetchFn: typeof fetch = vi.fn(async () => new Response('Unavailable', { status: 503 }))
    const provider = new OpenMeteoForecastProvider({ fetchFn })

    await expect(provider.getHourlyForecast(-23.55, -46.63)).rejects.toThrow(
      'Open-Meteo respondeu HTTP 503',
    )
  })
})
