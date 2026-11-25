import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Maximize2,
  MonitorPlay,
  Palette,
  Thermometer,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { SeverityBadge } from '@/components/patterns/SeverityBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ClimateRiskTab } from '@/features/monitoring/components/ClimateRiskTab'
import { TechnicalInspectorTab } from '@/features/monitoring/components/TechnicalInspectorTab'
import { PlayerCanvas } from '@/features/player/components/PlayerCanvas'
import {
  buildPlayerAccentCssVars,
  PLAYER_ACCENT_PRESETS,
} from '@/features/player/styles/mapStyles'
import {
  buildCleanPlayerUrl,
  sanitizeBrandConfig,
} from '@/features/player/utils/playerUrlState'
import { cn } from '@/lib/utils'
import type { AlertTarget, ScenarioQueryParams } from '@/types/alerts'
import type {
  PlayerBrandConfig,
  PlayerFormat,
  PlayerSceneData,
  PlayerTarget,
} from '@/types/player'

export type PointStageTabId = 'preview' | 'climate' | 'technical'

export interface PointInspectorStageProps {
  playerTarget: PlayerTarget | null
  alertTarget: AlertTarget | null
  scenario: ScenarioQueryParams
  scene: PlayerSceneData | null
  isSceneLoading: boolean
  sceneError: unknown
  onRetryScene: () => void
  brandConfig: PlayerBrandConfig
  onChangeBrandConfig: (next: PlayerBrandConfig) => void
  activeTab: PointStageTabId
  onTabChange: (tab: PointStageTabId) => void
}

async function copyUrlToClipboard(url: string): Promise<boolean> {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    toast.error('Área de transferência indisponível para copiar URL.')
    return false
  }

  try {
    await navigator.clipboard.writeText(url)
    toast.success('URL do Player Limpo copiada!')
    return true
  } catch {
    toast.error('Não foi possível copiar a URL do Player Limpo.')
    return false
  }
}

export function PointInspectorStage({
  playerTarget,
  alertTarget,
  scenario,
  scene,
  isSceneLoading,
  sceneError,
  onRetryScene,
  brandConfig,
  onChangeBrandConfig,
  activeTab,
  onTabChange,
}: PointInspectorStageProps) {
  const [format, setFormat] = useState<PlayerFormat>('portrait')
  const [isLandscapeModalOpen, setIsLandscapeModalOpen] = useState(false)
  const [isBrandPopoverOpen, setIsBrandPopoverOpen] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [accentInput, setAccentInput] = useState(brandConfig.accent)

  useEffect(() => {
    if (!isLandscapeModalOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLandscapeModalOpen(false)
        setFormat('portrait')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLandscapeModalOpen])

  const effectiveOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const cleanPlayerUrl = playerTarget
    ? buildCleanPlayerUrl(
        {
          target: playerTarget,
          format,
          scenario,
          brandConfig,
        },
        effectiveOrigin || undefined,
      )
    : ''

  const handleSelectFormat = (nextFormat: PlayerFormat) => {
    setFormat(nextFormat)
    setIsLandscapeModalOpen(nextFormat === 'landscape')
  }

  const handleCloseLandscapeModal = () => {
    setIsLandscapeModalOpen(false)
    setFormat('portrait')
  }

  const handleCopyCleanUrl = async () => {
    if (!cleanPlayerUrl) {
      return
    }
    const ok = await copyUrlToClipboard(cleanPlayerUrl)
    if (ok) {
      setCopiedUrl(true)
      window.setTimeout(() => setCopiedUrl(false), 1500)
    }
  }

  const decision = scene?.decision ?? null

  return (
    <Card className="flex flex-col">
      <CardHeader className="border-b border-border pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-base">
              {scene?.editorial.corridorName ?? decision?.location.name ?? 'Palco do Player DOOH'}
            </CardTitle>
            <CardDescription className="truncate">
              {decision
                ? `${decision.location.zone ?? 'Multi-município'} • Score ${Math.round(decision.riskScore)}/100`
                : 'Selecione um ponto OOH ou clique em qualquer via no mapa'}
            </CardDescription>
          </div>
          {decision ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <SeverityBadge level={decision.severityLevel} />
              {decision.simulated ? <Badge variant="outline">Simulado</Badge> : null}
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <Tabs
          value={activeTab}
          onValueChange={(nextValue) => onTabChange(nextValue as PointStageTabId)}
        >
          <TabsList aria-label="Abas de inspeção do ponto" className="grid w-full grid-cols-3">
            <TabsTrigger value="preview">
              <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Preview OOH</span>
            </TabsTrigger>
            <TabsTrigger value="climate">
              <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clima &amp; Risco</span>
            </TabsTrigger>
            <TabsTrigger value="technical">
              <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Técnico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-3">
            <div className="relative flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2">
              <div
                role="group"
                aria-label="Formato da peça DOOH"
                className="inline-flex items-center rounded-md border border-border bg-card p-0.5"
              >
                <button
                  type="button"
                  aria-pressed={format === 'portrait' && !isLandscapeModalOpen}
                  onClick={() => handleSelectFormat('portrait')}
                  className={cn(
                    'rounded px-2 py-1 text-xs font-semibold transition-colors',
                    format === 'portrait' && !isLandscapeModalOpen
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  9:16
                </button>
                <button
                  type="button"
                  aria-pressed={format === 'landscape' || isLandscapeModalOpen}
                  onClick={() => handleSelectFormat('landscape')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold transition-colors',
                    format === 'landscape' || isLandscapeModalOpen
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Maximize2 className="h-3 w-3" aria-hidden="true" />
                  <span>16:9</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-expanded={isBrandPopoverOpen}
                  onClick={() => {
                    setAccentInput(brandConfig.accent)
                    setIsBrandPopoverOpen((open) => !open)
                  }}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  <Palette className="h-3 w-3" aria-hidden="true" />
                  <span>Marca</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!cleanPlayerUrl}
                  onClick={() => void handleCopyCleanUrl()}
                  className="h-7 gap-1 px-2 text-xs"
                >
                  {copiedUrl ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )}
                  <span>Copiar URL</span>
                </Button>

                {cleanPlayerUrl ? (
                  <a
                    href={cleanPlayerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span>Player Limpo</span>
                  </a>
                ) : null}
              </div>

              {isBrandPopoverOpen ? (
                <div
                  role="dialog"
                  aria-label="Personalização white-label do player"
                  className="absolute top-full right-0 left-0 z-20 mt-1.5 space-y-2.5 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Personalização White-label (PT-BR)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsBrandPopoverOpen(false)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Fechar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="space-y-1 text-[11px] font-medium">
                      <span>Nome da marca (até 40)</span>
                      <input
                        type="text"
                        maxLength={40}
                        value={brandConfig.brand}
                        onChange={(event) =>
                          onChangeBrandConfig({
                            ...brandConfig,
                            brand: event.target.value.slice(0, 40),
                          })
                        }
                        onBlur={() => onChangeBrandConfig(sanitizeBrandConfig(brandConfig))}
                        className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      />
                    </label>
                    <label className="space-y-1 text-[11px] font-medium">
                      <span>Subtítulo / Tag (até 30)</span>
                      <input
                        type="text"
                        maxLength={30}
                        value={brandConfig.tag}
                        onChange={(event) =>
                          onChangeBrandConfig({
                            ...brandConfig,
                            tag: event.target.value.slice(0, 30),
                          })
                        }
                        onBlur={() => onChangeBrandConfig(sanitizeBrandConfig(brandConfig))}
                        className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      />
                    </label>
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-[11px] font-medium">Cor de destaque (hex)</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {PLAYER_ACCENT_PRESETS.map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          title={preset.label}
                          aria-label={`Cor ${preset.label}`}
                          style={buildPlayerAccentCssVars(preset.hex)}
                          onClick={() => {
                            setAccentInput(preset.hex)
                            onChangeBrandConfig({ ...brandConfig, accent: preset.hex })
                          }}
                          className={cn(
                            'h-6 w-6 rounded-full border-2 border-card shadow-xs transition-transform hover:scale-110',
                            brandConfig.accent === preset.hex ? 'ring-2 ring-ring' : undefined,
                          )}
                        >
                          <span
                            className="block h-full w-full rounded-full"
                            style={{ backgroundColor: 'var(--player-accent)' }}
                          />
                        </button>
                      ))}
                      <input
                        type="text"
                        aria-label="Código hexadecimal da cor"
                        maxLength={7}
                        value={accentInput}
                        onChange={(event) => {
                          const raw = event.target.value
                          setAccentInput(raw)
                          const normalized = raw.trim().replace(/^#/, '')
                          if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
                            onChangeBrandConfig({
                              ...brandConfig,
                              accent: normalized.toUpperCase(),
                            })
                          }
                        }}
                        className="h-7 w-24 rounded-md border border-input bg-card px-2 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {isSceneLoading ? (
              <div className="space-y-3" aria-label="Carregando cena do player DOOH">
                <Skeleton className="aspect-[9/16] w-full rounded-xl" />
              </div>
            ) : sceneError ? (
              <QueryErrorAlert
                error={sceneError}
                title="Não foi possível carregar a cena do Player DOOH"
                onRetry={onRetryScene}
              />
            ) : !scene ? (
              <EmptyState
                title="Nenhuma cena selecionada"
                description="Clique em um ponto OOH ou em qualquer via no mapa para gerar o preview DOOH."
              />
            ) : isLandscapeModalOpen ? (
              <div className="flex aspect-[9/16] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center">
                <Maximize2 className="h-6 w-6 text-primary" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Palco expandido 16:9 ativo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Preview inline pausado temporariamente para economizar contexto WebGL.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={handleCloseLandscapeModal}>
                  Voltar ao preview 9:16
                </Button>
              </div>
            ) : (
              <div className="mx-auto max-w-[390px]">
                <PlayerCanvas scene={scene} format="portrait" brandConfig={brandConfig} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="climate">
            {isSceneLoading ? (
              <div className="space-y-3" aria-label="Carregando clima e risco">
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-44 w-full" />
              </div>
            ) : sceneError ? (
              <QueryErrorAlert
                error={sceneError}
                title="Não foi possível carregar os dados climáticos"
                onRetry={onRetryScene}
              />
            ) : !decision ? (
              <EmptyState
                title="Nenhum dado climático disponível"
                description="Selecione um ponto no mapa para inspecionar clima e risco."
              />
            ) : (
              <ClimateRiskTab decision={decision} />
            )}
          </TabsContent>

          <TabsContent value="technical">
            {isSceneLoading ? (
              <div className="space-y-3" aria-label="Carregando dados técnicos">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-56 w-full" />
              </div>
            ) : sceneError ? (
              <QueryErrorAlert
                error={sceneError}
                title="Não foi possível carregar os dados técnicos"
                onRetry={onRetryScene}
              />
            ) : !decision || !alertTarget ? (
              <EmptyState
                title="Nenhum payload selecionado"
                description="Selecione um ponto no mapa para inspecionar JSON, XML RSS 2.0 e GeoJSON."
              />
            ) : (
              <TechnicalInspectorTab
                decision={decision}
                target={alertTarget}
                scenario={scenario}
                scene={scene}
                playerTarget={playerTarget}
              />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {isLandscapeModalOpen && scene ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Palco expandido 16:9 — ${scene.editorial.corridorName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-player-stage-bg/85 p-4 backdrop-blur-xs sm:p-8"
        >
          <div className="w-full max-w-6xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-md">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Formato 16:9 Split Horizontal</Badge>
                <span className="text-sm font-semibold text-foreground">
                  {scene.editorial.corridorName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cleanPlayerUrl ? (
                  <a
                    href={cleanPlayerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Abrir Player Limpo 16:9</span>
                  </a>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleCloseLandscapeModal}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Fechar</span>
                </Button>
              </div>
            </div>

            <PlayerCanvas scene={scene} format="landscape" brandConfig={brandConfig} />
          </div>
        </div>
      ) : null}
    </Card>
  )
}
