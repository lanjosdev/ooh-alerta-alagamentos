import {
  Check,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileCode2,
  Info,
  ListChecks,
  Map as MapIcon,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useRssFeed } from '@/features/monitoring/hooks/useRssFeed'
import { formatDateTimeBr } from '@/features/monitoring/utils/formatters'
import { getProviderStatusMeta } from '@/features/monitoring/utils/severity'
import { cn } from '@/lib/utils'
import { alertsService } from '@/services/alertsService'
import { playerService } from '@/services/playerService'
import type {
  AlertTarget,
  OohAlertDecision,
  ScenarioQueryParams,
  SourceExecutionStatus,
} from '@/types/alerts'
import type { PlayerSceneData, PlayerTarget } from '@/types/player'

export interface TechnicalInspectorTabProps {
  decision: OohAlertDecision
  target: AlertTarget
  scenario: ScenarioQueryParams
  scene?: PlayerSceneData | null
  playerTarget?: PlayerTarget | null
}

type PayloadFormat = 'json' | 'xml' | 'geojson'

async function copyTextToClipboard(text: string, label: string): Promise<boolean> {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    toast.error(`Área de transferência indisponível para copiar ${label}.`)
    return false
  }

  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copiado para a área de transferência!`)
    return true
  } catch {
    toast.error(`Não foi possível copiar ${label}.`)
    return false
  }
}

export function TechnicalInspectorTab({
  decision,
  target,
  scenario,
  scene = null,
  playerTarget = null,
}: TechnicalInspectorTabProps) {
  const [format, setFormat] = useState<PayloadFormat>('json')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const rssQuery = useRssFeed(target, scenario, format === 'xml')
  const resolvedPlayerTarget: PlayerTarget =
    playerTarget ??
    (scene?.assetId
      ? { kind: 'asset', assetId: scene.assetId }
      : {
          kind: 'coordinates',
          lat: decision.location.latitude,
          lon: decision.location.longitude,
        })

  const endpointUrl =
    format === 'geojson'
      ? playerService.buildSceneEndpointUrl(resolvedPlayerTarget, scenario)
      : alertsService.buildAlertEndpointUrl(target, format, scenario)

  const formattedJson = JSON.stringify(decision, null, 2)
  const formattedGeoJson = scene ? JSON.stringify(scene, null, 2) : ''

  const sourceEntries: Array<{ label: string; info: SourceExecutionStatus }> = scene
    ? [
        { label: 'Previsão Horária', info: scene.sources.forecast },
        { label: 'Avisos Oficiais', info: scene.sources.officialAlerts },
        { label: 'Monitor de Alagamentos', info: scene.sources.floodingMonitor },
        { label: 'Geometria Viária', info: scene.sources.roadGeometry },
        { label: 'Suscetibilidade GeoSampa', info: scene.sources.floodSusceptibility },
      ]
    : [
        { label: 'Previsão Horária', info: decision.sources.forecast },
        { label: 'Avisos Oficiais', info: decision.sources.officialAlerts },
        { label: 'Monitor de Alagamentos', info: decision.sources.floodingMonitor },
      ]

  const handleCopy = async (key: string, text: string, label: string) => {
    const ok = await copyTextToClipboard(text, label)
    if (ok) {
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Justificativas do Motor de Risco</span>
          </CardTitle>
          <CardDescription>
            Regras determinísticas avaliadas para definir severidade e gatilho OOH
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decision.reasons.length === 0 ? (
            <EmptyState
              title="Nenhuma justificativa informada"
              description="O motor de risco não listou motivos específicos para esta avaliação."
            />
          ) : (
            <ul className="space-y-1.5 text-xs">
              {decision.reasons.map((reason) => (
                <li
                  key={reason}
                  className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-foreground"
                >
                  <span
                    className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <Database className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Telemetria das Fontes na Execução</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sourceEntries.map(({ label, info }) => {
            const statusMeta = getProviderStatusMeta(info.status)
            return (
              <div
                key={label}
                className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-foreground">{label}</span>{' '}
                    <span className="font-mono text-[11px] text-muted-foreground">
                      ({info.provider})
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {info.cached ? <Badge variant="outline">Cache</Badge> : null}
                    {info.stale ? <Badge variant="outline">Stale</Badge> : null}
                    <Badge className={statusMeta.badgeClassName}>
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', statusMeta.dotClassName)}
                        aria-hidden="true"
                      />
                      <span>{statusMeta.label}</span>
                    </Badge>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Coleta: {formatDateTimeBr(info.fetchedAt)}
                </div>
                {info.error ? (
                  <p className="text-[11px] text-severity-critical-fg">Erro: {info.error}</p>
                ) : null}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-1.5">
            <Code2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Inspetor de Payload (JSON / RSS 2.0 / GeoJSON)</span>
          </CardTitle>
          <CardDescription>
            Endpoints diretos e respostas brutas entregues aos players DOOH
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs
            value={format}
            onValueChange={(nextValue) => setFormat(nextValue as PayloadFormat)}
          >
            <TabsList aria-label="Formato do payload técnico">
              <TabsTrigger value="json">
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>REST JSON</span>
              </TabsTrigger>
              <TabsTrigger value="xml">
                <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>XML / RSS 2.0</span>
              </TabsTrigger>
              <TabsTrigger value="geojson">
                <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>GeoJSON (Cena DOOH)</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  Endpoint{' '}
                  {format === 'json'
                    ? 'JSON'
                    : format === 'xml'
                      ? 'RSS 2.0'
                      : 'Cena DOOH (/v1/player/scene)'}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopy('url', endpointUrl, 'URL do endpoint')}
                  >
                    {copiedKey === 'url' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Copiar URL</span>
                  </Button>
                  <a
                    href={endpointUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Abrir em nova aba</span>
                  </a>
                </div>
              </div>
              <code className="block overflow-x-auto rounded bg-card px-2 py-1.5 font-mono text-[11px] text-foreground">
                {endpointUrl}
              </code>
            </div>

            <TabsContent value="json">
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleCopy('json', formattedJson, 'Payload JSON')}
                  >
                    {copiedKey === 'json' ? (
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Copiar payload</span>
                  </Button>
                </div>
                <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                  <code>{formattedJson}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="xml">
              {scenario.date ? (
                <Alert variant="info" className="mb-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <AlertTitle className="text-xs">Feed RSS protegido em tempo real</AlertTitle>
                    <AlertDescription>
                      Os endpoints <code>/feed.xml</code> rejeitam <code>date</code>/<code>time</code>{' '}
                      históricos para evitar exibição de replay em telas DOOH. Abaixo é exibido o feed ao vivo.
                    </AlertDescription>
                  </div>
                </Alert>
              ) : null}

              {rssQuery.isPending ? (
                <div className="space-y-2" aria-label="Carregando feed XML RSS">
                  <Skeleton className="h-8 w-36" />
                  <Skeleton className="h-56 w-full" />
                </div>
              ) : rssQuery.isError ? (
                <QueryErrorAlert
                  error={rssQuery.error}
                  title="Não foi possível carregar o feed XML / RSS 2.0"
                  onRetry={() => void rssQuery.refetch()}
                />
              ) : !rssQuery.data ? (
                <EmptyState
                  title="Feed XML / RSS 2.0 vazio"
                  description="A API não retornou conteúdo XML para este alvo."
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void handleCopy('xml', rssQuery.data, 'Feed XML / RSS 2.0')
                      }
                    >
                      {copiedKey === 'xml' ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>Copiar payload</span>
                    </Button>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    <code>{rssQuery.data}</code>
                  </pre>
                </div>
              )}
            </TabsContent>

            <TabsContent value="geojson">
              {!scene ? (
                <EmptyState
                  title="Cena DOOH não carregada"
                  description="Selecione um ponto no mapa para inspecionar o GeoJSON viário e a câmera da cena."
                />
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline">
                        Trechos viários: {scene.roads.features.length}
                      </Badge>
                      <Badge variant="outline">
                        Manchas GeoSampa: {scene.geoSampaZonesCount}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void handleCopy('geojson', formattedGeoJson, 'GeoJSON da Cena DOOH')
                      }
                    >
                      {copiedKey === 'geojson' ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      <span>Copiar payload</span>
                    </Button>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    <code>{formattedGeoJson}</code>
                  </pre>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
