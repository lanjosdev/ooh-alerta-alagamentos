import { z } from 'zod'
import { successResponseSchema } from './common.js'

export const monitoringRegionSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  state: z.string(),
  ibgeCode: z.string(),
  zone: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  cgeStationId: z.string().nullable(),
  historicalRiskWeight: z.number(),
})

export const listRegionsQuerySchema = z.object({
  zone: z.string().trim().min(1).optional(),
  ibgeCode: z.string().trim().min(1).optional(),
})

export const listRegionsResponseSchema = successResponseSchema(
  z.object({
    total: z.number().int(),
    regions: z.array(monitoringRegionSchema),
  }),
)
