import { z } from 'zod'
import { successResponseSchema } from './common.js'

export const simulationModeSchema = z.enum(['normal', 'attention', 'alert', 'critical'])

export const cgeDateSchema = z
  .string()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data deve estar no formato DD/MM/AAAA')

export const regionIdParamsSchema = z.object({
  regionId: z.string().trim().min(1),
})

export const simulationQuerySchema = z.object({
  cgeDate: cgeDateSchema.optional(),
  simulate: simulationModeSchema.optional(),
})

export const cityOverviewQuerySchema = z.object({
  zone: z.string().trim().min(1).optional(),
  ibgeCode: z.string().trim().min(1).optional(),
  cgeDate: cgeDateSchema.optional(),
  simulate: simulationModeSchema.optional(),
})

function coordinateSchema(min: number, max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().finite().min(min).max(max),
  )
}

export const coordinatesAlertQuerySchema = z.object({
  lat: coordinateSchema(-90, 90),
  lon: coordinateSchema(-180, 180),
  cgeDate: cgeDateSchema.optional(),
  simulate: simulationModeSchema.optional(),
})

const severityLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
const severityLabelSchema = z.enum(['NORMAL', 'ATENCAO', 'ALERTA', 'CRITICO'])

const currentWeatherSchema = z.object({
  observedAt: z.string(),
  temperatureC: z.number().nullable(),
  humidityPercent: z.number().nullable(),
  precipitationMm: z.number(),
  rainMm: z.number(),
  weatherCode: z.number(),
  isDay: z.boolean(),
  isRaining: z.boolean(),
})

const hourlyRainPointSchema = z.object({
  time: z.string(),
  precipitationProbabilityPercent: z.number(),
  precipitationMm: z.number(),
  weatherCode: z.number(),
})

const regionForecastSchema = z.object({
  provider: z.string(),
  gridLatitude: z.number(),
  gridLongitude: z.number(),
  timezone: z.string(),
  current: currentWeatherSchema.nullable(),
  maxRainProbabilityNext2hPercent: z.number(),
  expectedRainNext2hMm: z.number(),
  peakRainIntensityNext2hMmPerHour: z.number(),
  maxRainProbabilityNext6hPercent: z.number(),
  expectedRainNext6hMm: z.number(),
  hourly: z.array(hourlyRainPointSchema),
})

const officialWeatherAlertSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  severity: z.string(),
  severityRank: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  colorHex: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  risks: z.array(z.string()),
  instructions: z.array(z.string()),
  matchedBy: z.array(z.enum(['ibge', 'polygon'])),
})

const floodingPointSchema = z.object({
  zone: z.string(),
  neighborhood: z.string(),
  street: z.string(),
  direction: z.string().nullable(),
  reference: z.string().nullable(),
  timeWindow: z.string().nullable(),
  status: z.enum([
    'ativo-transitavel',
    'ativo-intransitavel',
    'inativo-transitavel',
    'inativo-intransitavel',
  ]),
  active: z.boolean(),
  passable: z.boolean(),
})

const stationRainfallSchema = z.object({
  stationId: z.string(),
  stationName: z.string().nullable(),
  currentPeriodMm: z.number().nullable(),
  previousPeriodMm: z.number().nullable(),
  resetTime: z.string().nullable(),
  temperatureC: z.number().nullable(),
  humidityPercent: z.number().nullable(),
})

const sourceExecutionStatusSchema = z.object({
  provider: z.string(),
  status: z.enum(['ok', 'stale', 'error', 'skipped']),
  cached: z.boolean(),
  stale: z.boolean(),
  fetchedAt: z.string().nullable(),
  error: z.string().nullable(),
})

export const oohAlertDecisionSchema = z.object({
  evaluatedAt: z.string(),
  location: z.object({
    id: z.string(),
    name: z.string(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    ibgeCode: z.string().nullable(),
    zone: z.string().nullable(),
    latitude: z.number(),
    longitude: z.number(),
    cgeStationId: z.string().nullable(),
    cgeStationName: z.string().nullable(),
    historicalRiskWeight: z.number(),
  }),
  triggerOverride: z.boolean(),
  severityLevel: severityLevelSchema,
  severityLabel: severityLabelSchema,
  riskScore: z.number(),
  simulated: z.boolean(),
  reasons: z.array(z.string()),
  display: z.object({
    headline: z.string(),
    message: z.string(),
    subtext: z.string(),
  }),
  forecast: regionForecastSchema.nullable(),
  officialAlerts: z.array(officialWeatherAlertSchema),
  flooding: z.object({
    cgeDate: z.string().nullable(),
    activeInZoneCount: z.number().int(),
    impassableInZoneCount: z.number().int(),
    passableInZoneCount: z.number().int(),
    pointsInZone: z.array(floodingPointSchema),
    stationRainfall: stationRainfallSchema.nullable(),
  }),
  sources: z.object({
    forecast: sourceExecutionStatusSchema,
    officialAlerts: sourceExecutionStatusSchema,
    floodingMonitor: sourceExecutionStatusSchema,
  }),
})

export const singleAlertResponseSchema = successResponseSchema(oohAlertDecisionSchema)

export const cityOverviewResponseSchema = successResponseSchema(
  z.object({
    generatedAt: z.string(),
    summary: z.object({
      totalRegions: z.number().int(),
      overrideActiveCount: z.number().int(),
      highestSeverityLevel: severityLevelSchema,
      highestSeverityLabel: severityLabelSchema,
      countsBySeverity: z.object({
        NORMAL: z.number().int(),
        ATENCAO: z.number().int(),
        ALERTA: z.number().int(),
        CRITICO: z.number().int(),
      }),
    }),
    regions: z.array(oohAlertDecisionSchema),
  }),
)
