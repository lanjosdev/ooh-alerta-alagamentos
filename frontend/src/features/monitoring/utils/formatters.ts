import { format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const FALLBACK_TEXT = '—'

function parseSafeDate(isoString: string | null | undefined): Date | null {
  if (typeof isoString !== 'string' || isoString.trim().length === 0) {
    return null
  }

  const parsed = parseISO(isoString)
  return isValid(parsed) ? parsed : null
}

export function formatDateTimeBr(isoString: string | null | undefined): string {
  const date = parseSafeDate(isoString)
  if (!date) {
    return FALLBACK_TEXT
  }

  return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR })
}

export function formatIsoDateBr(dateIso: string | null | undefined): string {
  const date = parseSafeDate(dateIso)
  if (!date) {
    return FALLBACK_TEXT
  }

  return format(date, 'dd/MM/yyyy', { locale: ptBR })
}

export function getTodayIsoDate(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatHourBr(isoString: string | null | undefined): string {
  const date = parseSafeDate(isoString)
  if (!date) {
    return FALLBACK_TEXT
  }

  return format(date, 'HH:mm', { locale: ptBR })
}

export function formatRainMm(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return FALLBACK_TEXT
  }

  return `${value.toFixed(1).replace('.', ',')} mm`
}

export function formatRainRateMmPerHour(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return FALLBACK_TEXT
  }

  return `${value.toFixed(1).replace('.', ',')} mm/h`
}

export function formatTemperatureC(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return FALLBACK_TEXT
  }

  return `${value.toFixed(1).replace('.', ',')} °C`
}

export function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return FALLBACK_TEXT
  }

  return `${Math.round(value)}%`
}

export function formatCoordinates(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return FALLBACK_TEXT
  }

  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

export function formatLatencyMs(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) {
    return FALLBACK_TEXT
  }

  return `${Math.round(ms)} ms`
}
