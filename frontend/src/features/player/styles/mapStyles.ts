import type { StyleSpecification } from 'maplibre-gl'
import type { CSSProperties } from 'react'
import { sanitizeAccentHex } from '@/features/player/utils/playerUrlState'
import type { SeverityLevel } from '@/types/alerts'

export const EXPLORER_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

export type RgbaColor = [number, number, number, number]

export const FLOOD_COLOR_OUTER_GLOW: RgbaColor = [14, 116, 244, 72]
export const FLOOD_COLOR_MID_BODY: RgbaColor = [37, 99, 235, 168]
export const FLOOD_COLOR_CORE_CYAN: RgbaColor = [125, 232, 255, 238]

export interface SeverityVisualProfile {
  widthMultiplier: number
  glowOpacity: number
  flowSpeed: number
  pulseStrength: number
}

export const SEVERITY_VISUAL_PROFILES: Readonly<Record<SeverityLevel, SeverityVisualProfile>> = {
  0: {
    widthMultiplier: 0,
    glowOpacity: 0,
    flowSpeed: 0,
    pulseStrength: 0,
  },
  1: {
    widthMultiplier: 0.78,
    glowOpacity: 0.68,
    flowSpeed: 1.15,
    pulseStrength: 0.22,
  },
  2: {
    widthMultiplier: 1.05,
    glowOpacity: 0.86,
    flowSpeed: 1.85,
    pulseStrength: 0.34,
  },
  3: {
    widthMultiplier: 1.38,
    glowOpacity: 1.0,
    flowSpeed: 2.6,
    pulseStrength: 0.45,
  },
}

export function buildPlayerAccentCssVars(accentHex: string): CSSProperties {
  const safeHex = sanitizeAccentHex(accentHex)
  return {
    '--player-accent': `#${safeHex}`,
    '--player-accent-soft': `color-mix(in oklch, #${safeHex} 14%, transparent)`,
  } as CSSProperties
}

export function createPlayerBwStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'OOH Editorial P&B Minimalista',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      },
    },
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#FFFFFF',
        },
      },
      {
        id: 'park',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'park',
        paint: {
          'fill-color': '#F5F6F8',
          'fill-opacity': 0.8,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: {
          'fill-color': '#E5E7EB',
        },
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: {
          'line-color': '#D1D5DB',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 2.2],
        },
      },
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: [
          'all',
          ['==', '$type', 'LineString'],
          ['in', 'class', 'minor', 'service', 'track', 'path'],
        ],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#D4D4D8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 16, 2.5],
        },
      },
      {
        id: 'road-tertiary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['==', '$type', 'LineString'], ['==', 'class', 'tertiary']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#A1A1AA',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 16, 3.6],
        },
      },
      {
        id: 'road-secondary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'secondary', 'primary']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#52525B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 16, 5.2],
        },
      },
      {
        id: 'road-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'trunk', 'motorway']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#18181B',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 16, 6.8],
        },
      },
      {
        id: 'water-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'water_name',
        minzoom: 12,
        layout: {
          'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: {
          'text-color': '#6B7280',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.5,
        },
      },
      {
        id: 'road-name',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 13,
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:pt'], ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 10, 16, 12.5],
          'text-max-angle': 30,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.8,
        },
      },
    ],
  }
}
