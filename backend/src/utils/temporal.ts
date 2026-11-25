const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo'

function getSaoPauloParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

/** Retorna a data atual no fuso America/Sao_Paulo no formato YYYY-MM-DD. */
export function getSaoPauloTodayIso(now: Date = new Date()): string {
  const parts = getSaoPauloParts(now)
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Retorna os minutos decorridos desde 00:00 no fuso America/Sao_Paulo. */
export function getSaoPauloNowMinutes(now: Date = new Date()): number {
  const parts = getSaoPauloParts(now)
  const hour = Number.parseInt(parts.hour === '24' ? '00' : (parts.hour ?? '00'), 10)
  const minute = Number.parseInt(parts.minute ?? '00', 10)
  return hour * 60 + minute
}

/** Valida se uma string YYYY-MM-DD representa uma data real de calendário. */
export function isValidCalendarDate(dateIso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!match) {
    return false
  }

  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10)
  const day = Number.parseInt(match[3], 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day))
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  )
}

/** Converte YYYY-MM-DD para DD/MM/AAAA (formato esperado pelo CGE-SP). */
export function isoDateToCgeDate(dateIso: string): string {
  const [year, month, day] = dateIso.split('-')
  return `${day}/${month}/${year}`
}

/** Converte DD/MM/AAAA para YYYY-MM-DD. */
export function cgeDateToIsoDate(cgeDate: string): string {
  const [day, month, year] = cgeDate.split('/')
  return `${year}-${month}-${day}`
}

/** Resolve o offset real do fuso America/Sao_Paulo (ex.: -03:00) via Intl para uma data/hora. */
export function resolveSaoPauloOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SAO_PAULO_TIME_ZONE,
    timeZoneName: 'longOffset',
  }).formatToParts(date)

  const tzName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT-03:00'
  const match = /^GMT([+-]\d{2}:\d{2})$/.exec(tzName)
  if (match) {
    return match[1]
  }
  return tzName === 'GMT' ? '+00:00' : '-03:00'
}

/** Formata data YYYY-MM-DD e hora HH:MM como ISO-8601 com offset real de America/Sao_Paulo. */
export function formatSaoPauloIsoTimestamp(dateIso: string, timeHm: string): string {
  const probeUtc = new Date(`${dateIso}T${timeHm}:00Z`)
  const offset = resolveSaoPauloOffset(Number.isNaN(probeUtc.getTime()) ? new Date() : probeUtc)
  return `${dateIso}T${timeHm}:00${offset}`
}

/** Formata um instante `Date` em ISO-8601 com offset real de America/Sao_Paulo. */
export function formatNowInSaoPauloIso(now: Date = new Date()): string {
  const parts = getSaoPauloParts(now)
  const hour = parts.hour === '24' ? '00' : (parts.hour ?? '00')
  const offset = resolveSaoPauloOffset(now)
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}${offset}`
}
