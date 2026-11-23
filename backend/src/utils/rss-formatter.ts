import type { OohAlertDecision } from '../services/alerts/alert-types.js'

export const OOH_XML_NAMESPACE = 'https://ooh-alerta-alagamentos.local/ns/1.0'

export interface RssFeedInput {
  title: string
  link: string
  description: string
  decisions: readonly OohAlertDecision[]
  generatedAt?: Date
}

export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function renderItem(decision: OohAlertDecision, baseLink: string): string {
  const pubDate = new Date(decision.evaluatedAt).toUTCString()
  const guid = `${decision.location.id}-${decision.severityLabel}-${decision.evaluatedAt}`
  const rainProb =
    decision.forecast !== null ? String(decision.forecast.maxRainProbabilityNext2hPercent) : ''

  return [
    '    <item>',
    `      <title>${escapeXml(decision.display.headline)}</title>`,
    `      <link>${escapeXml(baseLink)}</link>`,
    `      <description>${escapeXml(decision.display.message)}</description>`,
    `      <guid isPermaLink="false">${escapeXml(guid)}</guid>`,
    `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
    `      <category>${escapeXml(decision.severityLabel)}</category>`,
    `      <ooh:regionId>${escapeXml(decision.location.id)}</ooh:regionId>`,
    `      <ooh:locationName>${escapeXml(decision.location.name)}</ooh:locationName>`,
    `      <ooh:zone>${escapeXml(decision.location.zone ?? '')}</ooh:zone>`,
    `      <ooh:ibgeCode>${escapeXml(decision.location.ibgeCode ?? '')}</ooh:ibgeCode>`,
    `      <ooh:latitude>${String(decision.location.latitude)}</ooh:latitude>`,
    `      <ooh:longitude>${String(decision.location.longitude)}</ooh:longitude>`,
    `      <ooh:triggerOverride>${String(decision.triggerOverride)}</ooh:triggerOverride>`,
    `      <ooh:severityLevel>${String(decision.severityLevel)}</ooh:severityLevel>`,
    `      <ooh:severityLabel>${escapeXml(decision.severityLabel)}</ooh:severityLabel>`,
    `      <ooh:riskScore>${String(decision.riskScore)}</ooh:riskScore>`,
    `      <ooh:simulated>${String(decision.simulated)}</ooh:simulated>`,
    `      <ooh:rainProbabilityNext2hPercent>${rainProb}</ooh:rainProbabilityNext2hPercent>`,
    `      <ooh:activeFloodingsInZone>${String(decision.flooding.activeInZoneCount)}</ooh:activeFloodingsInZone>`,
    `      <ooh:headline>${escapeXml(decision.display.headline)}</ooh:headline>`,
    `      <ooh:message>${escapeXml(decision.display.message)}</ooh:message>`,
    `      <ooh:subtext>${escapeXml(decision.display.subtext)}</ooh:subtext>`,
    '    </item>',
  ].join('\n')
}

export function formatAlertsAsRss(input: RssFeedInput): string {
  const buildDate = (input.generatedAt ?? new Date()).toUTCString()
  const itemsXml = input.decisions.map((decision) => renderItem(decision, input.link)).join('\n')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<rss version="2.0" xmlns:ooh="${OOH_XML_NAMESPACE}">`,
    '  <channel>',
    `    <title>${escapeXml(input.title)}</title>`,
    `    <link>${escapeXml(input.link)}</link>`,
    `    <description>${escapeXml(input.description)}</description>`,
    '    <language>pt-BR</language>',
    `    <lastBuildDate>${escapeXml(buildDate)}</lastBuildDate>`,
    itemsXml,
    '  </channel>',
    '</rss>',
  ]
    .filter((line) => line.length > 0)
    .join('\n')
}
