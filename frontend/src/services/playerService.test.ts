import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { getValidatedEnv } from '@/env'
import { apiClient } from '@/lib/api'
import {
  mockGeocodeResponse,
  mockPlayerAssetsData,
  mockPlayerSceneCritical,
  mockPlayerSceneHistorical,
} from '@/test/fixtures/player'
import { playerService } from './playerService'

const coordPairSchema = z.tuple([z.number(), z.number()])

const playerCameraSchema = z.object({
  center: coordPairSchema,
  zoom: z.number(),
  bearing: z.number(),
  bounds: z.tuple([coordPairSchema, coordPairSchema]),
})

const severityLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
const severityLabelSchema = z.enum(['NORMAL', 'ATENCAO', 'ALERTA', 'CRITICO'])

const playerAssetSummarySchema = z.object({
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

const sourceExecutionStatusSchema = z.object({
  provider: z.string(),
  status: z.enum(['ok', 'stale', 'error', 'skipped']),
  cached: z.boolean(),
  stale: z.boolean(),
  fetchedAt: z.string().nullable(),
  error: z.string().nullable(),
})

const playerSceneSchema = z.object({
  evaluatedAt: z.string(),
  assetId: z.string().nullable(),
  targetKind: z.enum(['asset', 'coordinates']),
  decision: z.object({
    evaluatedAt: z.string(),
    temporal: z.object({
      mode: z.enum(['realtime', 'historical', 'simulated']),
      date: z.string().nullable(),
      time: z.string().nullable(),
      resolvedTime: z.string().nullable(),
      referenceAt: z.string(),
    }),
    severityLevel: severityLevelSchema,
    severityLabel: severityLabelSchema,
    riskScore: z.number(),
    triggerOverride: z.boolean(),
  }),
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
    features: z.array(
      z.object({
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
      }),
    ),
  }),
  geoSampaZonesCount: z.number().int(),
  sources: z.object({
    forecast: sourceExecutionStatusSchema,
    officialAlerts: sourceExecutionStatusSchema,
    floodingMonitor: sourceExecutionStatusSchema,
    roadGeometry: sourceExecutionStatusSchema,
    floodSusceptibility: sourceExecutionStatusSchema,
  }),
})

describe('playerService', () => {
  it('fetches curated OOH assets with optional historical scenario params', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      status: 200,
      data: { success: true, message: null, data: mockPlayerAssetsData },
    })

    const result = await playerService.getAssets({ date: '2025-01-24', time: '20:30' })

    expect(getSpy).toHaveBeenCalledWith('/player/assets', {
      params: { date: '2025-01-24', time: '20:30' },
    })
    expect(result.assets.every((asset) => playerAssetSummarySchema.safeParse(asset).success)).toBe(
      true,
    )
  })

  it('geocodes address queries trimming whitespace', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      status: 200,
      data: { success: true, message: null, data: mockGeocodeResponse },
    })

    const result = await playerService.geocodeAddress('  Avenida Paulista  ')

    expect(getSpy).toHaveBeenCalledWith('/player/geocode', {
      params: { q: 'Avenida Paulista' },
    })
    expect(result).toEqual(mockGeocodeResponse)
  })

  it('fetches scene sending exclusively assetId OR lat+lon and validates backend contract', async () => {
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, message: null, data: mockPlayerSceneCritical },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, message: null, data: mockPlayerSceneHistorical },
      })

    const assetScene = await playerService.getScene({
      kind: 'asset',
      assetId: 'av-roberto-marinho',
    })

    expect(getSpy).toHaveBeenNthCalledWith(1, '/player/scene', {
      params: { assetId: 'av-roberto-marinho' },
      timeout: 22000,
    })
    expect(playerSceneSchema.safeParse(assetScene).success).toBe(true)

    const coordsScene = await playerService.getScene(
      { kind: 'coordinates', lat: -23.5614, lon: -46.6559 },
      { date: '2025-01-24', time: '20:30' },
    )

    expect(getSpy).toHaveBeenNthCalledWith(2, '/player/scene', {
      params: { lat: -23.5614, lon: -46.6559, date: '2025-01-24', time: '20:30' },
      timeout: 22000,
    })
    expect(playerSceneSchema.safeParse(coordsScene).success).toBe(true)
  })

  it('builds copyable /v1/player/scene endpoint URLs', () => {
    const baseUrl = getValidatedEnv().VITE_API_BASE_URL

    expect(
      playerService.buildSceneEndpointUrl(
        { kind: 'asset', assetId: 'av-roberto-marinho' },
        { date: '2025-01-24', time: '20:30' },
      ),
    ).toBe(`${baseUrl}/player/scene?assetId=av-roberto-marinho&date=2025-01-24&time=20%3A30`)

    expect(
      playerService.buildSceneEndpointUrl({
        kind: 'coordinates',
        lat: -23.5614,
        lon: -46.6559,
      }),
    ).toBe(`${baseUrl}/player/scene?lat=-23.5614&lon=-46.6559`)
  })
})
