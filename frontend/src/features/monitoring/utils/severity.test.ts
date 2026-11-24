import { describe, expect, it } from 'vitest'
import {
  getProviderStatusMeta,
  getSeverityMeta,
  getSeverityMetaByLabel,
  severityRankToLevel,
} from './severity'

describe('severity utilities', () => {
  it('returns semantic metadata for all four severity levels', () => {
    expect(getSeverityMeta(0).label).toBe('Normal')
    expect(getSeverityMeta(0).badgeClassName).toContain('bg-severity-normal-bg')

    expect(getSeverityMeta(1).label).toBe('Atenção')
    expect(getSeverityMeta(1).markerClassName).toBe('ooh-map-marker--1')

    expect(getSeverityMeta(2).label).toBe('Alerta')
    expect(getSeverityMeta(2).badgeClassName).toContain('bg-severity-alert-bg')

    expect(getSeverityMeta(3).label).toBe('Crítico')
    expect(getSeverityMeta(3).badgeClassName).toContain('bg-severity-critical-bg')
  })

  it('resolves metadata from API severity labels and official alert rank', () => {
    expect(getSeverityMetaByLabel('ATENCAO').level).toBe(1)
    expect(getSeverityMetaByLabel('CRITICO').level).toBe(3)
    expect(severityRankToLevel(2)).toBe(2)
  })

  it('maps provider execution and health statuses to semantic status tokens', () => {
    expect(getProviderStatusMeta('ok')).toMatchObject({
      label: 'OK',
      dotClassName: 'bg-status-ok',
    })
    expect(getProviderStatusMeta('stale').dotClassName).toBe('bg-status-stale')
    expect(getProviderStatusMeta('degraded').dotClassName).toBe('bg-status-stale')
    expect(getProviderStatusMeta('error').dotClassName).toBe('bg-status-error')
    expect(getProviderStatusMeta('skipped').dotClassName).toBe('bg-status-skipped')
  })
})
