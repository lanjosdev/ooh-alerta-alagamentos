import type { ScenarioQueryParams, SimulationMode } from '@/types/alerts'
import type { PlayerBrandConfig, PlayerFormat, PlayerTarget } from '@/types/player'

export const DEFAULT_PLAYER_ASSET_ID = 'av-roberto-marinho'

export const DEFAULT_PLAYER_BRAND: PlayerBrandConfig = Object.freeze({
  brand: 'Alerta OOH',
  tag: 'Monitoramento Urbano',
  accent: '0057FF',
})

const MAX_BRAND_LENGTH = 40
const MAX_TAG_LENGTH = 30
const HEX_SIX_REGEX = /^[0-9a-fA-F]{6}$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const TIME_HM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const CGE_DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/
const VALID_SIMULATIONS: ReadonlySet<SimulationMode> = new Set([
  'normal',
  'attention',
  'alert',
  'critical',
])

export type AppRoute = 'monitoring' | 'player'

export function resolveAppRoute(location: Pick<Location, 'pathname' | 'search'>): AppRoute {
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/'
  if (normalizedPath === '/player') {
    return 'player'
  }

  const params = new URLSearchParams(location.search)
  if (params.get('mode') === 'player') {
    return 'player'
  }

  return 'monitoring'
}

export function sanitizeBrand(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return DEFAULT_PLAYER_BRAND.brand
  }

  const trimmed = value.trim().slice(0, MAX_BRAND_LENGTH)
  return trimmed.length > 0 ? trimmed : DEFAULT_PLAYER_BRAND.brand
}

export function sanitizeTag(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return DEFAULT_PLAYER_BRAND.tag
  }

  const trimmed = value.trim().slice(0, MAX_TAG_LENGTH)
  return trimmed.length > 0 ? trimmed : DEFAULT_PLAYER_BRAND.tag
}

export function sanitizeAccentHex(value: string | null | undefined): string {
  if (typeof value !== 'string') {
    return DEFAULT_PLAYER_BRAND.accent
  }

  const normalized = value.trim().replace(/^#/, '')
  if (!HEX_SIX_REGEX.test(normalized)) {
    return DEFAULT_PLAYER_BRAND.accent
  }

  return normalized.toUpperCase()
}

export function sanitizeBrandConfig(input?: Partial<PlayerBrandConfig>): PlayerBrandConfig {
  return {
    brand: sanitizeBrand(input?.brand),
    tag: sanitizeTag(input?.tag),
    accent: sanitizeAccentHex(input?.accent),
  }
}

export interface ParsedPlayerUrlState {
  target: PlayerTarget
  format: PlayerFormat
  scenario: ScenarioQueryParams
  brandConfig: PlayerBrandConfig
}

function parseFiniteCoord(raw: string | null, min: number, max: number): number | null {
  if (!raw || raw.trim().length === 0) {
    return null
  }

  const num = Number(raw)
  if (!Number.isFinite(num) || num < min || num > max) {
    return null
  }

  return num
}

export function parsePlayerUrlParams(search: string): ParsedPlayerUrlState {
  const params = new URLSearchParams(search)

  const assetParam = params.get('asset')?.trim()
  const lat = parseFiniteCoord(params.get('lat'), -90, 90)
  const lon = parseFiniteCoord(params.get('lon'), -180, 180)

  let target: PlayerTarget
  if (assetParam && assetParam.length > 0) {
    target = { kind: 'asset', assetId: assetParam }
  } else if (lat !== null && lon !== null) {
    target = { kind: 'coordinates', lat, lon }
  } else {
    target = { kind: 'asset', assetId: DEFAULT_PLAYER_ASSET_ID }
  }

  const rawFormat = params.get('format')
  const format: PlayerFormat = rawFormat === 'landscape' ? 'landscape' : 'portrait'

  const scenario: ScenarioQueryParams = {}
  const dateParam = params.get('date')?.trim()
  const timeParam = params.get('time')?.trim()
  const cgeDateParam = params.get('cgeDate')?.trim()
  const simulateParam = params.get('simulate')?.trim() as SimulationMode | undefined

  if (dateParam && ISO_DATE_REGEX.test(dateParam)) {
    scenario.date = dateParam
    if (timeParam && TIME_HM_REGEX.test(timeParam)) {
      scenario.time = timeParam
    }
  } else if (cgeDateParam && CGE_DATE_REGEX.test(cgeDateParam)) {
    scenario.cgeDate = cgeDateParam
  }

  if (simulateParam && VALID_SIMULATIONS.has(simulateParam)) {
    scenario.simulate = simulateParam
  }

  const brandConfig = sanitizeBrandConfig({
    brand: params.get('brand') ?? undefined,
    tag: params.get('tag') ?? undefined,
    accent: params.get('accent') ?? undefined,
  })

  return {
    target,
    format,
    scenario,
    brandConfig,
  }
}

export interface BuildCleanPlayerUrlInput {
  target: PlayerTarget
  format: PlayerFormat
  scenario?: ScenarioQueryParams
  brandConfig?: Partial<PlayerBrandConfig>
}

export function buildCleanPlayerUrl(input: BuildCleanPlayerUrlInput, origin?: string): string {
  const params = new URLSearchParams()
  params.set('mode', 'player')

  if (input.target.kind === 'asset') {
    params.set('asset', input.target.assetId)
  } else {
    params.set('lat', input.target.lat.toFixed(5))
    params.set('lon', input.target.lon.toFixed(5))
  }

  params.set('format', input.format)

  if (input.scenario?.date) {
    params.set('date', input.scenario.date)
    if (input.scenario.time) {
      params.set('time', input.scenario.time)
    }
  } else if (input.scenario?.cgeDate) {
    params.set('cgeDate', input.scenario.cgeDate)
  }

  if (input.scenario?.simulate) {
    params.set('simulate', input.scenario.simulate)
  }

  const sanitizedBrand = sanitizeBrandConfig(input.brandConfig)
  if (sanitizedBrand.brand !== DEFAULT_PLAYER_BRAND.brand) {
    params.set('brand', sanitizedBrand.brand)
  }
  if (sanitizedBrand.tag !== DEFAULT_PLAYER_BRAND.tag) {
    params.set('tag', sanitizedBrand.tag)
  }
  if (sanitizedBrand.accent !== DEFAULT_PLAYER_BRAND.accent) {
    params.set('accent', sanitizedBrand.accent)
  }

  const relativeUrl = `/?${params.toString()}`
  if (!origin) {
    return relativeUrl
  }

  return `${origin.replace(/\/+$/, '')}${relativeUrl}`
}
