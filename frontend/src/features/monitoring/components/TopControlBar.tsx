import {
  Activity,
  CalendarClock,
  ChevronDown,
  Clock,
  FlaskConical,
  Radio,
  RefreshCw,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatIsoDateBr, formatLatencyMs, getTodayIsoDate } from '@/features/monitoring/utils/formatters'
import {
  HISTORICAL_SHORTCUTS,
  type TemporalSelection,
} from '@/features/monitoring/utils/scenarios'
import { getProviderStatusMeta } from '@/features/monitoring/utils/severity'
import { cn } from '@/lib/utils'
import type { SimulationMode, SourcesStatusData } from '@/types/alerts'

export interface TopControlBarProps {
  selection: TemporalSelection
  onChangeSelection: (selection: TemporalSelection) => void
  simulationEnabled: boolean
  sourcesStatus: SourcesStatusData | undefined
  isSourcesLoading: boolean
  isSourcesError: boolean
  isRefreshing: boolean
  onRefresh: () => void
}

const SIMULATION_OPTIONS: ReadonlyArray<{ value: SimulationMode; label: string }> = [
  { value: 'normal', label: 'Normal (0)' },
  { value: 'attention', label: 'Atenção (1)' },
  { value: 'alert', label: 'Alerta (2)' },
  { value: 'critical', label: 'Crítico (3)' },
]

const PROVIDER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'open-meteo': 'Open-Meteo',
  'open-meteo-historical': 'Open-Meteo Histórico',
  inmet: 'INMET',
  'cge-sp': 'CGE-SP',
  overpass: 'Overpass OSM',
  'geosampa-wfs': 'GeoSampa WFS',
  nominatim: 'Nominatim',
}

type OpenPopover = 'historical' | 'simulate' | 'sources' | null

function resolveSourcesSummary(
  sourcesStatus: SourcesStatusData | undefined,
  isLoading: boolean,
  isError: boolean,
): { label: string; badgeClassName: string; dotClassName: string } {
  if (isLoading && !sourcesStatus) {
    return {
      label: 'Fontes: verificando...',
      badgeClassName: 'bg-secondary text-secondary-foreground border-border',
      dotClassName: 'bg-muted-foreground',
    }
  }

  if (isError || !sourcesStatus) {
    return {
      label: 'Fontes: indisponível',
      badgeClassName: 'bg-status-error-bg text-status-error-fg border-transparent',
      dotClassName: 'bg-status-error',
    }
  }

  const hasDegraded = sourcesStatus.providers.some((provider) => provider.status === 'degraded')
  if (hasDegraded) {
    return {
      label: 'Fontes: atenção',
      badgeClassName: 'bg-status-stale-bg text-status-stale-fg border-transparent',
      dotClassName: 'bg-status-stale',
    }
  }

  return {
    label: 'Fontes: OK',
    badgeClassName: 'bg-status-ok-bg text-status-ok-fg border-transparent',
    dotClassName: 'bg-status-ok',
  }
}

export function TopControlBar({
  selection,
  onChangeSelection,
  simulationEnabled,
  sourcesStatus,
  isSourcesLoading,
  isSourcesError,
  isRefreshing,
  onRefresh,
}: TopControlBarProps) {
  const barRef = useRef<HTMLElement | null>(null)
  const [openPopover, setOpenPopover] = useState<OpenPopover>(null)
  const [draftDate, setDraftDate] = useState<string>(
    selection.mode === 'historical' ? selection.date : '2025-01-24',
  )
  const [draftTime, setDraftTime] = useState<string>(
    selection.mode === 'historical' ? (selection.time ?? '') : '20:30',
  )

  useEffect(() => {
    if (!openPopover) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(event.target as Node)) {
        setOpenPopover(null)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPopover(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openPopover])

  const sourcesSummary = resolveSourcesSummary(sourcesStatus, isSourcesLoading, isSourcesError)
  const todayIso = getTodayIsoDate()

  const handleApplyHistorical = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draftDate) {
      return
    }
    const trimmedTime = draftTime.trim()
    onChangeSelection({
      mode: 'historical',
      date: draftDate,
      time: trimmedTime.length > 0 ? trimmedTime : undefined,
    })
    setOpenPopover(null)
  }

  const handleSelectShortcut = (date: string, time: string) => {
    setDraftDate(date)
    setDraftTime(time)
    onChangeSelection({
      mode: 'historical',
      date,
      time,
    })
    setOpenPopover(null)
  }

  const handleSelectSimulation = (simulate: SimulationMode) => {
    onChangeSelection({ mode: 'simulated', simulate })
    setOpenPopover(null)
  }

  return (
    <header
      ref={barRef}
      className="relative z-30 rounded-xl border border-border bg-card px-4 py-2.5 shadow-xs"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground sm:text-base">
              OOH Alerta Alagamentos
            </h1>
            <p className="text-[11px] text-muted-foreground">
              São Paulo • Painel Operacional e Player Criativo DOOH
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Seletor de modo temporal"
            className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5"
          >
            <Button
              type="button"
              size="sm"
              variant={selection.mode === 'realtime' ? 'default' : 'ghost'}
              onClick={() => {
                setOpenPopover(null)
                onChangeSelection({ mode: 'realtime' })
              }}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tempo Real</span>
            </Button>

            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant={selection.mode === 'historical' ? 'default' : 'ghost'}
                aria-expanded={openPopover === 'historical'}
                onClick={() =>
                  setOpenPopover((current) => (current === 'historical' ? null : 'historical'))
                }
                className="h-7 gap-1.5 px-2.5 text-xs"
              >
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {selection.mode === 'historical'
                    ? `Histórico • ${formatIsoDateBr(selection.date)}${selection.time ? ` ${selection.time}` : ''}`
                    : 'Histórico'}
                </span>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </Button>

              {openPopover === 'historical' ? (
                <div
                  role="dialog"
                  aria-label="Consultar replay histórico"
                  className="absolute right-0 mt-2 w-80 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg"
                >
                  <form onSubmit={handleApplyHistorical} className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        Replay Histórico (CGE-SP + Open-Meteo)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Selecione uma data passada e horário opcional (vazio = pico automático).
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-[11px] font-medium text-foreground">
                        <span>Data</span>
                        <input
                          type="date"
                          aria-label="Data do replay histórico"
                          max={todayIso}
                          value={draftDate}
                          onChange={(event) => setDraftDate(event.target.value)}
                          required
                          className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-[11px] font-medium text-foreground">
                        <span>Hora (opcional)</span>
                        <input
                          type="time"
                          aria-label="Hora do replay histórico"
                          value={draftTime}
                          onChange={(event) => setDraftTime(event.target.value)}
                          className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        />
                      </label>
                    </div>

                    <div className="space-y-1.5 border-t border-border pt-2">
                      <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                        Atalhos validados no CGE-SP
                      </p>
                      <div className="space-y-1">
                        {HISTORICAL_SHORTCUTS.map((shortcut) => (
                          <button
                            key={shortcut.id}
                            type="button"
                            onClick={() => handleSelectShortcut(shortcut.date, shortcut.time)}
                            className="flex w-full flex-col rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <span className="text-xs font-semibold text-foreground">
                              {shortcut.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {shortcut.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setDraftTime('')}
                      >
                        Pico automático
                      </Button>
                      <Button type="submit" size="sm">
                        Aplicar Replay
                      </Button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant={selection.mode === 'simulated' ? 'default' : 'ghost'}
                disabled={!simulationEnabled}
                aria-expanded={openPopover === 'simulate'}
                title={
                  simulationEnabled
                    ? 'Simular nível de severidade'
                    : 'Simulação desabilitada no backend (ENABLE_SIMULATION_PARAMS=false)'
                }
                onClick={() =>
                  setOpenPopover((current) => (current === 'simulate' ? null : 'simulate'))
                }
                className="h-7 gap-1.5 px-2.5 text-xs"
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {selection.mode === 'simulated'
                    ? `Simular: ${
                        SIMULATION_OPTIONS.find((opt) => opt.value === selection.simulate)?.label ??
                        selection.simulate
                      }`
                    : 'Simular'}
                </span>
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </Button>

              {openPopover === 'simulate' && simulationEnabled ? (
                <div
                  role="menu"
                  aria-label="Opções de simulação"
                  className="absolute right-0 mt-2 w-48 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
                >
                  {SIMULATION_OPTIONS.map((option) => {
                    const isActive =
                      selection.mode === 'simulated' && selection.simulate === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => handleSelectSimulation(option.value)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          isActive ? 'bg-accent text-accent-foreground font-semibold' : undefined,
                        )}
                      >
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={openPopover === 'sources'}
              onClick={() =>
                setOpenPopover((current) => (current === 'sources' ? null : 'sources'))
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <Badge className={cn('px-2 py-0 text-[11px]', sourcesSummary.badgeClassName)}>
                <span
                  className={cn('h-1.5 w-1.5 rounded-full', sourcesSummary.dotClassName)}
                  aria-hidden="true"
                />
                <span>{sourcesSummary.label}</span>
              </Badge>
            </button>

            {openPopover === 'sources' ? (
              <div
                role="dialog"
                aria-label="Saúde das fontes de dados"
                className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
              >
                <p className="text-xs font-semibold text-foreground">Provedores Integrados</p>
                <div className="mt-2 space-y-1.5">
                  {sourcesStatus?.providers.length ? (
                    sourcesStatus.providers.map((provider) => {
                      const meta = getProviderStatusMeta(provider.status)
                      return (
                        <div
                          key={provider.provider}
                          className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {PROVIDER_DISPLAY_NAMES[provider.provider] ?? provider.provider}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Latência: {formatLatencyMs(provider.lastLatencyMs)} • Cache:{' '}
                              {provider.cachedKeys}
                            </p>
                            {provider.status === 'degraded' && provider.lastErrorMessage ? (
                              <p
                                className="mt-0.5 line-clamp-2 text-[10px] text-status-error-fg"
                                title={provider.lastErrorMessage}
                              >
                                {provider.lastErrorMessage}
                              </p>
                            ) : null}
                          </div>
                          <Badge className={cn('text-[10px]', meta.badgeClassName)}>
                            {meta.label}
                          </Badge>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      Sem leitura detalhada dos provedores.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', isRefreshing ? 'animate-spin' : undefined)}
              aria-hidden="true"
            />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
