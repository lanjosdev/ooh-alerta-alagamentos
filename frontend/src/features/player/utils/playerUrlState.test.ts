import { describe, expect, it } from 'vitest'
import {
  buildCleanPlayerUrl,
  DEFAULT_PLAYER_ASSET_ID,
  DEFAULT_PLAYER_BRAND,
  parsePlayerUrlParams,
  resolveAppRoute,
  sanitizeAccentHex,
  sanitizeBrand,
  sanitizeTag,
} from './playerUrlState'

describe('playerUrlState', () => {
  it('resolves canonical /?mode=player and /player alias routes', () => {
    expect(resolveAppRoute({ pathname: '/', search: '' })).toBe('monitoring')
    expect(resolveAppRoute({ pathname: '/', search: '?mode=player&asset=marginal-pinheiros' })).toBe(
      'player',
    )
    expect(resolveAppRoute({ pathname: '/player', search: '?asset=av-do-estado' })).toBe('player')
    expect(resolveAppRoute({ pathname: '/player/', search: '' })).toBe('player')
  })

  it('sanitizes brand (<= 40), tag (<= 30) and accent hex strictly', () => {
    expect(sanitizeBrand('   ')).toBe(DEFAULT_PLAYER_BRAND.brand)
    expect(sanitizeBrand('A'.repeat(55))).toHaveLength(40)

    expect(sanitizeTag('')).toBe(DEFAULT_PLAYER_BRAND.tag)
    expect(sanitizeTag('B'.repeat(40))).toHaveLength(30)

    expect(sanitizeAccentHex('#0ea5e9')).toBe('0EA5E9')
    expect(sanitizeAccentHex('ff5500')).toBe('FF5500')
    expect(sanitizeAccentHex('javascript:alert(1)')).toBe(DEFAULT_PLAYER_BRAND.accent)
    expect(sanitizeAccentHex('12345')).toBe(DEFAULT_PLAYER_BRAND.accent)
  })

  it('parses player URL params with safe defaults and historical/coordinate handling', () => {
    expect(parsePlayerUrlParams('')).toEqual({
      target: { kind: 'asset', assetId: DEFAULT_PLAYER_ASSET_ID },
      format: 'portrait',
      scenario: {},
      brandConfig: DEFAULT_PLAYER_BRAND,
    })

    expect(
      parsePlayerUrlParams(
        '?mode=player&lat=-23.5614&lon=-46.6559&format=landscape&date=2025-01-24&time=20:30&simulate=critical&brand=Cidade+Digital&tag=Tempo+Real&accent=00aaff',
      ),
    ).toEqual({
      target: { kind: 'coordinates', lat: -23.5614, lon: -46.6559 },
      format: 'landscape',
      scenario: {
        date: '2025-01-24',
        time: '20:30',
        simulate: 'critical',
      },
      brandConfig: {
        brand: 'Cidade Digital',
        tag: 'Tempo Real',
        accent: '00AAFF',
      },
    })

    // Ignores time when date is missing and falls back invalid accent
    expect(parsePlayerUrlParams('?time=20:30&accent=badhex')).toEqual({
      target: { kind: 'asset', assetId: DEFAULT_PLAYER_ASSET_ID },
      format: 'portrait',
      scenario: {},
      brandConfig: DEFAULT_PLAYER_BRAND,
    })
  })

  it('builds canonical /?mode=player URLs omitting default brand values', () => {
    expect(
      buildCleanPlayerUrl(
        {
          target: { kind: 'asset', assetId: 'av-radial-leste' },
          format: 'portrait',
          scenario: { date: '2026-01-16', time: '18:15' },
          brandConfig: DEFAULT_PLAYER_BRAND,
        },
        'https://ooh.example.com/',
      ),
    ).toBe(
      'https://ooh.example.com/?mode=player&asset=av-radial-leste&format=portrait&date=2026-01-16&time=18%3A15',
    )

    expect(
      buildCleanPlayerUrl({
        target: { kind: 'coordinates', lat: -23.5614, lon: -46.6559 },
        format: 'landscape',
        brandConfig: { brand: 'Minha Rede', tag: 'Corredor SP', accent: '#112233' },
      }),
    ).toBe(
      '/?mode=player&lat=-23.56140&lon=-46.65590&format=landscape&brand=Minha+Rede&tag=Corredor+SP&accent=112233',
    )
  })
})
