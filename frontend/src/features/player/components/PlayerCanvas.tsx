import { AlertTriangle, MapPin, Radio } from 'lucide-react'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import { FloodGenerativeMap } from '@/features/player/components/FloodGenerativeMap'
import { buildPlayerAccentCssVars } from '@/features/player/styles/mapStyles'
import { sanitizeBrandConfig } from '@/features/player/utils/playerUrlState'
import { cn } from '@/lib/utils'
import type { PlayerBrandConfig, PlayerFormat, PlayerSceneData } from '@/types/player'

export interface PlayerCanvasProps {
  scene: PlayerSceneData
  format: PlayerFormat
  brandConfig: PlayerBrandConfig
  fullscreen?: boolean
  className?: string
}

function TelemetryBadgeCard({ scene, compact }: { scene: PlayerSceneData; compact?: boolean }) {
  const { editorial, decision } = scene
  const isHistorical = decision.temporal.mode === 'historical'
  const isSimulated = decision.temporal.mode === 'simulated'

  const pillClassName = isSimulated
    ? 'bg-severity-alert-bg text-severity-alert-fg border-severity-alert-border'
    : isHistorical
      ? 'bg-secondary text-secondary-foreground border-border'
      : 'bg-status-ok-bg text-status-ok-fg border-transparent'

  return (
    <div
      className={cn(
        'pointer-events-none absolute right-2 bottom-2 z-10 rounded-lg border border-player-rule bg-player-telemetry-bg shadow-sm backdrop-blur-xs',
        compact ? 'max-w-[210px] px-2.5 py-1.5' : 'max-w-[260px] px-3 py-2',
      )}
    >
      <p className="truncate text-[10px] font-medium text-player-ink-muted">
        {editorial.sourcesLabel}
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-mono text-[10px] font-semibold tracking-tight text-player-ink">
          - {editorial.telemetryModeLabel} -
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase',
            pillClassName,
          )}
        >
          <Radio className="h-2.5 w-2.5" aria-hidden="true" />
          <span>{editorial.telemetryStatusPill}</span>
        </span>
      </div>
    </div>
  )
}

function BrandEmblem({ brandConfig, compact }: { brandConfig: PlayerBrandConfig; compact?: boolean }) {
  const initials = brandConfig.brand
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="text-right">
        <span
          className="block text-[9px] font-bold tracking-widest uppercase"
          style={{ color: 'var(--player-accent)' }}
        >
          AVISO
        </span>
        <span className="block max-w-[110px] truncate text-[10px] font-semibold text-player-ink-muted">
          {brandConfig.brand}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center justify-center rounded-lg font-bold text-primary-foreground shadow-xs',
          compact ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm',
        )}
        style={{ backgroundColor: 'var(--player-accent)' }}
        aria-hidden="true"
      >
        {initials || 'AO'}
      </div>
    </div>
  )
}

export function PlayerCanvas({
  scene,
  format,
  brandConfig,
  fullscreen = false,
  className,
}: PlayerCanvasProps) {
  const safeBrand = sanitizeBrandConfig(brandConfig)
  const accentVars = buildPlayerAccentCssVars(safeBrand.accent)
  const severityMeta = getSeverityMeta(scene.decision.severityLevel)
  const isNormal = scene.decision.severityLevel === 0
  const targetPin = {
    coordinates: scene.camera.center,
    label: scene.targetKind === 'asset' ? 'VOCÊ ESTÁ AQUI' : 'PONTO ALVO',
  }

  if (format === 'landscape') {
    return (
      <article
        aria-label={`Peça DOOH 16:9 — ${scene.editorial.corridorName}`}
        data-player-format="landscape"
        style={accentVars}
        className={cn(
          'grid w-full grid-cols-[38%_62%] overflow-hidden rounded-xl border border-player-rule bg-player-paper text-player-ink shadow-lg',
          fullscreen ? 'aspect-video max-h-full max-w-full' : 'aspect-video',
          className,
        )}
      >
        <div className="flex min-w-0 flex-col justify-between border-r border-player-rule bg-player-paper p-4 sm:p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-player-rule pb-2 text-[10px] font-semibold tracking-wider text-player-ink-muted uppercase">
              <span className="truncate">{safeBrand.brand}</span>
              <span className="truncate">{safeBrand.tag}</span>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase',
                    severityMeta.badgeClassName,
                  )}
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  <span>{severityMeta.label}</span>
                </span>
                <h2 className="text-lg leading-tight font-extrabold tracking-tight text-player-ink sm:text-xl">
                  {scene.editorial.headline}
                </h2>
              </div>
              <BrandEmblem brandConfig={safeBrand} compact />
            </div>
          </div>

          <div className="space-y-2.5 border-y border-player-rule py-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-player-ink sm:text-sm">
              <MapPin
                className="h-4 w-4 shrink-0"
                style={{ color: 'var(--player-accent)' }}
                aria-hidden="true"
              />
              <span className="truncate">{scene.editorial.corridorName}</span>
            </div>
            <div>
              <span
                className={cn(
                  'inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold',
                  severityMeta.badgeClassName,
                )}
              >
                {scene.editorial.riskWindowLabel}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs leading-snug font-medium text-player-ink-muted">
              {scene.editorial.statusNote}
            </p>
            {isNormal ? (
              <p className="text-[10px] text-player-ink-muted">
                Em produção, este ponto exibirá a campanha normal.
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative h-full min-h-0 w-full">
          <FloodGenerativeMap
            camera={scene.camera}
            roads={scene.roads}
            severityLevel={scene.decision.severityLevel}
            format="landscape"
            targetPin={targetPin}
          />
          <TelemetryBadgeCard scene={scene} />
        </div>
      </article>
    )
  }

  return (
    <article
      aria-label={`Peça DOOH 9:16 — ${scene.editorial.corridorName}`}
      data-player-format="portrait"
      style={accentVars}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-player-rule bg-player-paper text-player-ink shadow-lg',
        fullscreen ? 'aspect-[9/16] h-full max-h-full max-w-full' : 'aspect-[9/16] w-full',
        className,
      )}
    >
      <header className="space-y-2.5 border-b border-player-rule bg-player-paper px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-2 border-b border-player-rule pb-1.5 text-[10px] font-semibold tracking-wider text-player-ink-muted uppercase">
          <span className="truncate">{safeBrand.brand}</span>
          <span className="truncate">{safeBrand.tag}</span>
        </div>

        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 text-base leading-tight font-extrabold tracking-tight text-player-ink sm:text-lg">
            {scene.editorial.headline}
          </h2>
          <BrandEmblem brandConfig={safeBrand} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-player-ink">
            <MapPin
              className="h-3.5 w-3.5 shrink-0"
              style={{ color: 'var(--player-accent)' }}
              aria-hidden="true"
            />
            <span className="truncate">{scene.editorial.corridorName}</span>
          </div>
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              severityMeta.badgeClassName,
            )}
          >
            {scene.editorial.riskWindowLabel}
          </span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <FloodGenerativeMap
          camera={scene.camera}
          roads={scene.roads}
          severityLevel={scene.decision.severityLevel}
          format="portrait"
          targetPin={targetPin}
        />
        <TelemetryBadgeCard scene={scene} compact />
      </div>

      <footer className="border-t border-player-rule bg-player-paper px-4 py-2.5">
        <p className="text-[11px] leading-snug font-medium text-player-ink-muted">
          {scene.editorial.statusNote}
        </p>
        {isNormal ? (
          <p className="mt-0.5 text-[10px] text-player-ink-muted">
            Em produção, este ponto exibirá a campanha normal.
          </p>
        ) : null}
      </footer>
    </article>
  )
}
