import type {
  SeverityLabel,
  SeverityLevel,
  SourceExecutionStatus,
  SourceHealthSnapshot,
} from '@/types/alerts'

export interface SeverityMeta {
  level: SeverityLevel
  apiLabel: SeverityLabel
  label: string
  shortLabel: string
  description: string
  badgeClassName: string
  surfaceClassName: string
  dotClassName: string
  markerClassName: string
}

const SEVERITY_META_BY_LEVEL: Readonly<Record<SeverityLevel, SeverityMeta>> = {
  0: {
    level: 0,
    apiLabel: 'NORMAL',
    label: 'Normal',
    shortLabel: 'NOR',
    description: 'Sem gatilhos críticos ativos para operação OOH.',
    badgeClassName: 'bg-severity-normal-bg text-severity-normal-fg border-severity-normal-border',
    surfaceClassName:
      'bg-severity-normal-bg/70 text-severity-normal-fg border-severity-normal-border',
    dotClassName: 'bg-severity-normal',
    markerClassName: 'ooh-map-marker--0',
  },
  1: {
    level: 1,
    apiLabel: 'ATENCAO',
    label: 'Atenção',
    shortLabel: 'ATE',
    description: 'Chuva prevista ou aviso potencial exigindo atenção preventiva.',
    badgeClassName:
      'bg-severity-attention-bg text-severity-attention-fg border-severity-attention-border',
    surfaceClassName:
      'bg-severity-attention-bg/75 text-severity-attention-fg border-severity-attention-border',
    dotClassName: 'bg-severity-attention',
    markerClassName: 'ooh-map-marker--1',
  },
  2: {
    level: 2,
    apiLabel: 'ALERTA',
    label: 'Alerta',
    shortLabel: 'ALE',
    description: 'Chuva forte, aviso severo ou alagamento transitável na zona.',
    badgeClassName: 'bg-severity-alert-bg text-severity-alert-fg border-severity-alert-border',
    surfaceClassName:
      'bg-severity-alert-bg/75 text-severity-alert-fg border-severity-alert-border',
    dotClassName: 'bg-severity-alert',
    markerClassName: 'ooh-map-marker--2',
  },
  3: {
    level: 3,
    apiLabel: 'CRITICO',
    label: 'Crítico',
    shortLabel: 'CRI',
    description: 'Alagamento intransitável ou chuva extrema; override OOH recomendado.',
    badgeClassName:
      'bg-severity-critical-bg text-severity-critical-fg border-severity-critical-border',
    surfaceClassName:
      'bg-severity-critical-bg/80 text-severity-critical-fg border-severity-critical-border',
    dotClassName: 'bg-severity-critical',
    markerClassName: 'ooh-map-marker--3',
  },
}

const SEVERITY_LEVEL_BY_LABEL: Readonly<Record<SeverityLabel, SeverityLevel>> = {
  NORMAL: 0,
  ATENCAO: 1,
  ALERTA: 2,
  CRITICO: 3,
}

export function getSeverityMeta(level: SeverityLevel): SeverityMeta {
  return SEVERITY_META_BY_LEVEL[level]
}

export function getSeverityMetaByLabel(label: SeverityLabel): SeverityMeta {
  return SEVERITY_META_BY_LEVEL[SEVERITY_LEVEL_BY_LABEL[label]]
}

export function severityRankToLevel(rank: 1 | 2 | 3): SeverityLevel {
  return rank
}

export type ProviderStatusCode =
  | SourceExecutionStatus['status']
  | SourceHealthSnapshot['status']

export interface ProviderStatusMeta {
  label: string
  badgeClassName: string
  dotClassName: string
}

const PROVIDER_STATUS_META: Readonly<Record<ProviderStatusCode, ProviderStatusMeta>> = {
  ok: {
    label: 'OK',
    badgeClassName: 'bg-status-ok-bg text-status-ok-fg border-transparent',
    dotClassName: 'bg-status-ok',
  },
  stale: {
    label: 'Stale (Cache)',
    badgeClassName: 'bg-status-stale-bg text-status-stale-fg border-transparent',
    dotClassName: 'bg-status-stale',
  },
  degraded: {
    label: 'Degradado',
    badgeClassName: 'bg-status-stale-bg text-status-stale-fg border-transparent',
    dotClassName: 'bg-status-stale',
  },
  error: {
    label: 'Erro',
    badgeClassName: 'bg-status-error-bg text-status-error-fg border-transparent',
    dotClassName: 'bg-status-error',
  },
  skipped: {
    label: 'Não aplicável',
    badgeClassName: 'bg-status-skipped-bg text-status-skipped-fg border-transparent',
    dotClassName: 'bg-status-skipped',
  },
  unknown: {
    label: 'Sem leitura',
    badgeClassName: 'bg-status-skipped-bg text-status-skipped-fg border-transparent',
    dotClassName: 'bg-status-skipped',
  },
}

export function getProviderStatusMeta(status: ProviderStatusCode): ProviderStatusMeta {
  return PROVIDER_STATUS_META[status]
}
