import { z } from 'zod'
import {
  cgeDateSchema,
  isoDateSchema,
  oohAlertDecisionSchema,
  severityLabelSchema,
  severityLevelSchema,
  simulationModeSchema,
  sourceExecutionStatusSchema,
  timeHmSchema,
} from './alerts.js'
import { successResponseSchema } from './common.js'

function optionalCoordinateSchema(min: number, max: number) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.coerce.number().finite().min(min).max(max).optional(),
  )
}

export const playerAssetsQuerySchema = z.object({
  date: isoDateSchema.optional(),
  time: timeHmSchema.optional(),
  cgeDate: cgeDateSchema.optional(),
  simulate: simulationModeSchema.optional(),
})

export const playerGeocodeQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(3, 'A busca deve ter no mínimo 3 caracteres')
    .max(120, 'A busca deve ter no máximo 120 caracteres'),
})

export const playerSceneQuerySchema = z
  .object({
    assetId: z.string().trim().min(1).optional(),
    lat: optionalCoordinateSchema(-90, 90),
    lon: optionalCoordinateSchema(-180, 180),
    date: isoDateSchema.optional(),
    time: timeHmSchema.optional(),
    cgeDate: cgeDateSchema.optional(),
    simulate: simulationModeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const hasAssetId = value.assetId !== undefined
    const hasLat = value.lat !== undefined
    const hasLon = value.lon !== undefined
    const hasAnyCoord = hasLat || hasLon
    const hasBothCoords = hasLat && hasLon

    if (hasAssetId && hasAnyCoord) {
      ctx.addIssue({
        code: 'custom',
        path: ['assetId'],
        message: 'Informe assetId OU (lat e lon), nunca ambos simultaneamente.',
      })
      return
    }

    if (!hasAssetId && !hasBothCoords) {
      ctx.addIssue({
        code: 'custom',
        path: [hasLat ? 'lon' : 'lat'],
        message: 'Informe assetId ou o par completo de coordenadas lat e lon.',
      })
    }
  })

const coordPairSchema = z.tuple([z.number(), z.number()])

export const playerCameraSchema = z.object({
  center: coordPairSchema,
  zoom: z.number(),
  bearing: z.number(),
  bounds: z.tuple([coordPairSchema, coordPairSchema]),
})

export const playerAssetSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  corridorName: z.string(),
  neighborhood: z.string(),
  zone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  camera: playerCameraSchema,
  severityLevel: severityLevelSchema,
  severityLabel: severityLabelSchema,
  riskScore: z.number(),
  triggerOverride: z.boolean(),
  activeInZoneCount: z.number().int(),
})

export const playerAssetsResponseSchema = successResponseSchema(
  z.object({
    total: z.number().int(),
    assets: z.array(playerAssetSummarySchema),
  }),
)

export const geocodingCandidateSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  primaryName: z.string(),
  neighborhood: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
})

export const playerGeocodeResponseSchema = successResponseSchema(
  z.object({
    query: z.string(),
    total: z.number().int(),
    candidates: z.array(geocodingCandidateSchema),
  }),
)

const roadFloodFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(coordPairSchema),
  }),
  properties: z.object({
    osmId: z.string(),
    streetName: z.string(),
    highway: z.string(),
    isPrimaryCorridor: z.boolean(),
    matchedCge: z.boolean(),
    matchedCgeImpassable: z.boolean(),
    inGeoSampaZone: z.boolean(),
    riskIntensity: z.number().min(0).max(1),
  }),
})

export const playerSceneResponseSchema = successResponseSchema(
  z.object({
    evaluatedAt: z.string(),
    assetId: z.string().nullable(),
    targetKind: z.enum(['asset', 'coordinates']),
    decision: oohAlertDecisionSchema,
    editorial: z.object({
      headline: z.string(),
      corridorName: z.string(),
      riskWindowLabel: z.string(),
      statusNote: z.string(),
      sourcesLabel: z.string(),
      telemetryModeLabel: z.string(),
      telemetryStatusPill: z.string(),
    }),
    camera: playerCameraSchema,
    roads: z.object({
      type: z.literal('FeatureCollection'),
      features: z.array(roadFloodFeatureSchema),
    }),
    geoSampaZonesCount: z.number().int(),
    sources: z.object({
      forecast: sourceExecutionStatusSchema,
      officialAlerts: sourceExecutionStatusSchema,
      floodingMonitor: sourceExecutionStatusSchema,
      roadGeometry: sourceExecutionStatusSchema,
      floodSusceptibility: sourceExecutionStatusSchema,
    }),
  }),
)
