import { Layer, LayerExtension } from '@deck.gl/core'
import { PathLayer } from '@deck.gl/layers'
import { MapboxOverlay } from '@deck.gl/mapbox'
import { Map as MapLibreMap } from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'
import {
  createPlayerBwStyle,
  FLOOD_COLOR_CORE_CYAN,
  FLOOD_COLOR_MID_BODY,
  FLOOD_COLOR_OUTER_GLOW,
  SEVERITY_VISUAL_PROFILES,
  type RgbaColor,
} from '@/features/player/styles/mapStyles'
import { cn } from '@/lib/utils'
import type { SeverityLevel } from '@/types/alerts'
import type {
  PlayerCamera,
  PlayerFormat,
  RoadFloodFeature,
  RoadFloodFeatureCollection,
} from '@/types/player'

interface FloodFlowLayerProps {
  floodTime?: number
  floodFlowSpeed?: number
  floodPulseStrength?: number
}

const FLOOD_FLOW_SHADER_MODULE = {
  name: 'floodFlow',
  uniformTypes: {
    uTime: 'f32',
    uFlowSpeed: 'f32',
    uPulseStrength: 'f32',
  },
  inject: {
    'fs:#decl': `
      layout(std140) uniform floodFlowUniforms {
        float uTime;
        float uFlowSpeed;
        float uPulseStrength;
      } floodFlow;
    `,
    'fs:DECKGL_FILTER_COLOR': `
      float flowWave = 0.5 + 0.5 * sin(geometry.uv.y * 0.14 - floodFlow.uTime * floodFlow.uFlowSpeed);
      float centerGlow = 1.0 - smoothstep(0.0, 1.0, abs(geometry.uv.x));
      float pulse = 1.0 + floodFlow.uPulseStrength * (0.65 * flowWave + 0.35 * sin(floodFlow.uTime * 2.4));
      color.rgb = mix(color.rgb, vec3(0.55, 0.92, 1.0), centerGlow * flowWave * 0.35);
      color.a *= clamp(0.72 + 0.28 * flowWave, 0.0, 1.0) * min(pulse, 1.35);
    `,
  },
} as const

class FloodFlowExtension extends LayerExtension {
  static extensionName = 'FloodFlowExtension'

  static defaultProps = {
    floodTime: 0,
    floodFlowSpeed: 1.5,
    floodPulseStrength: 0.3,
  }

  getShaders() {
    return {
      modules: [FLOOD_FLOW_SHADER_MODULE],
    }
  }

  updateState(this: Layer<FloodFlowLayerProps>): void {
    this.setShaderModuleProps({
      floodFlow: {
        uTime: this.props.floodTime ?? 0,
        uFlowSpeed: this.props.floodFlowSpeed ?? 1.5,
        uPulseStrength: this.props.floodPulseStrength ?? 0.3,
      },
    })
  }
}

const SHARED_FLOOD_FLOW_EXTENSION = new FloodFlowExtension()

function scaleColorAlpha(color: RgbaColor, alphaMultiplier: number): RgbaColor {
  return [
    color[0],
    color[1],
    color[2],
    Math.max(0, Math.min(255, Math.round(color[3] * alphaMultiplier))),
  ]
}

function buildFloodLayers(
  features: RoadFloodFeature[],
  severityLevel: SeverityLevel,
  elapsedSeconds: number,
  reducedMotion: boolean,
): PathLayer<RoadFloodFeature, FloodFlowLayerProps>[] {
  if (severityLevel === 0 || features.length === 0) {
    return []
  }

  const profile = SEVERITY_VISUAL_PROFILES[severityLevel]
  const pulseFactor = reducedMotion
    ? 1
    : 1 + 0.08 * Math.sin(elapsedSeconds * profile.flowSpeed * 1.4)

  const outerColor = scaleColorAlpha(FLOOD_COLOR_OUTER_GLOW, profile.glowOpacity)
  const midColor = scaleColorAlpha(FLOOD_COLOR_MID_BODY, profile.glowOpacity)
  const coreColor = scaleColorAlpha(FLOOD_COLOR_CORE_CYAN, profile.glowOpacity)

  const sharedProps = {
    data: features,
    getPath: (feature: RoadFloodFeature) => feature.geometry.coordinates,
    widthUnits: 'meters' as const,
    jointRounded: true,
    capRounded: true,
    antialiasing: true,
    pickable: false,
    updateTriggers: {
      getWidth: [severityLevel],
      getColor: [severityLevel],
    },
  }

  return [
    new PathLayer<RoadFloodFeature, FloodFlowLayerProps>({
      ...sharedProps,
      id: 'flood-outer-glow',
      widthScale: profile.widthMultiplier * pulseFactor,
      widthMinPixels: 8,
      widthMaxPixels: 68,
      getWidth: (feature) => 22 + feature.properties.riskIntensity * 34,
      getColor: (feature) =>
        scaleColorAlpha(outerColor, 0.55 + feature.properties.riskIntensity * 0.45),
      extensions: [SHARED_FLOOD_FLOW_EXTENSION],
      floodTime: elapsedSeconds,
      floodFlowSpeed: profile.flowSpeed * 0.75,
      floodPulseStrength: profile.pulseStrength * 0.8,
    }),
    new PathLayer<RoadFloodFeature, FloodFlowLayerProps>({
      ...sharedProps,
      id: 'flood-mid-body',
      widthScale: profile.widthMultiplier * pulseFactor,
      widthMinPixels: 5,
      widthMaxPixels: 42,
      getWidth: (feature) => 12 + feature.properties.riskIntensity * 20,
      getColor: (feature) =>
        scaleColorAlpha(midColor, 0.65 + feature.properties.riskIntensity * 0.35),
      extensions: [SHARED_FLOOD_FLOW_EXTENSION],
      floodTime: elapsedSeconds,
      floodFlowSpeed: profile.flowSpeed,
      floodPulseStrength: profile.pulseStrength,
    }),
    new PathLayer<RoadFloodFeature, FloodFlowLayerProps>({
      ...sharedProps,
      id: 'flood-flow-core',
      widthScale: profile.widthMultiplier,
      widthMinPixels: 2.5,
      widthMaxPixels: 20,
      getWidth: (feature) => 5 + feature.properties.riskIntensity * 9,
      getColor: (feature) =>
        scaleColorAlpha(coreColor, 0.7 + feature.properties.riskIntensity * 0.3),
      extensions: [SHARED_FLOOD_FLOW_EXTENSION],
      floodTime: elapsedSeconds,
      floodFlowSpeed: profile.flowSpeed * 1.35,
      floodPulseStrength: profile.pulseStrength * 1.1,
    }),
  ]
}

export interface FloodGenerativeMapProps {
  camera: PlayerCamera
  roads: RoadFloodFeatureCollection
  severityLevel: SeverityLevel
  format: PlayerFormat
  className?: string
}

export function FloodGenerativeMap({
  camera,
  roads,
  severityLevel,
  format,
  className,
}: FloodGenerativeMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const rafIdRef = useRef<number | null>(null)

  const activeFloodFeatures = useMemo(
    () => roads.features.filter((feature) => feature.properties.riskIntensity > 0),
    [roads.features],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const map = new MapLibreMap({
      container,
      style: createPlayerBwStyle(),
      center: camera.center,
      zoom: camera.zoom,
      bearing: camera.bearing,
      interactive: false,
      attributionControl: false,
    })

    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    })

    map.addControl(overlay)
    mapRef.current = map
    overlayRef.current = overlay

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(container)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      resizeObserver.disconnect()
      try {
        map.removeControl(overlay)
      } catch {
        // Ignora erro caso o controle ainda não tenha sido anexado ao estilo
      }
      overlay.finalize()
      map.remove()
      overlayRef.current = null
      mapRef.current = null
    }
    // Inicialização única do contexto WebGL; câmera e camadas são atualizadas nos efeitos abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) {
      return
    }

    const padding =
      format === 'portrait'
        ? { top: 28, bottom: 72, left: 24, right: 24 }
        : { top: 28, bottom: 64, left: 28, right: 32 }

    map.fitBounds(camera.bounds, {
      padding,
      bearing: camera.bearing,
      maxZoom: Math.max(camera.zoom, 16),
      duration: 450,
    })
  }, [camera, format])

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) {
      return
    }

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    if (severityLevel === 0 || activeFloodFeatures.length === 0) {
      overlay.setProps({ layers: [] })
      return
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      overlay.setProps({
        layers: buildFloodLayers(activeFloodFeatures, severityLevel, 0, true),
      })
      return
    }

    let startMs: number | null = null
    let isDisposed = false

    const renderFrame = (timestampMs: number) => {
      if (isDisposed || document.hidden) {
        rafIdRef.current = null
        return
      }

      if (startMs === null) {
        startMs = timestampMs
      }

      const elapsedSeconds = (timestampMs - startMs) / 1000
      overlay.setProps({
        layers: buildFloodLayers(activeFloodFeatures, severityLevel, elapsedSeconds, false),
      })
      rafIdRef.current = requestAnimationFrame(renderFrame)
    }

    const handleVisibilityChange = () => {
      if (isDisposed) {
        return
      }

      if (document.hidden) {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        return
      }

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(renderFrame)
      }
    }

    overlay.setProps({
      layers: buildFloodLayers(activeFloodFeatures, severityLevel, 0, false),
    })

    if (!document.hidden) {
      rafIdRef.current = requestAnimationFrame(renderFrame)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isDisposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [activeFloodFeatures, severityLevel])

  return (
    <div
      className={cn('relative h-full w-full overflow-hidden bg-player-paper', className)}
      data-severity-level={severityLevel}
    >
      <div
        ref={containerRef}
        className="h-full w-full"
        data-testid="flood-generative-map-canvas"
      />
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 rounded bg-player-telemetry-bg px-1.5 py-0.5 text-[10px] font-medium text-player-ink-muted shadow-xs">
        © OpenStreetMap • OpenFreeMap
      </div>
    </div>
  )
}
