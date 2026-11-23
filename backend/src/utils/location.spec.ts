import { describe, expect, it } from 'vitest'
import { getDistanceInMeters, isLocationWithinRadius } from './location.js'

describe('location utils', () => {
  const pracaDaSe = { lat: -23.55052, lon: -46.63331 }
  const avenidaPaulista = { lat: -23.56141, lon: -46.65588 }

  it('retorna 0 metros para coordenadas idênticas', () => {
    expect(getDistanceInMeters(pracaDaSe.lat, pracaDaSe.lon, pracaDaSe.lat, pracaDaSe.lon)).toBe(0)
  })

  it('calcula distância aproximada entre Praça da Sé e Avenida Paulista (~2.6 km)', () => {
    const distance = getDistanceInMeters(
      pracaDaSe.lat,
      pracaDaSe.lon,
      avenidaPaulista.lat,
      avenidaPaulista.lon,
    )

    expect(distance).toBeGreaterThan(2400)
    expect(distance).toBeLessThan(2800)
  })

  it('valida corretamente se um ponto está dentro ou fora do raio informado', () => {
    expect(
      isLocationWithinRadius(
        pracaDaSe.lat,
        pracaDaSe.lon,
        avenidaPaulista.lat,
        avenidaPaulista.lon,
        3000,
      ),
    ).toBe(true)

    expect(
      isLocationWithinRadius(
        pracaDaSe.lat,
        pracaDaSe.lon,
        avenidaPaulista.lat,
        avenidaPaulista.lon,
        2000,
      ),
    ).toBe(false)
  })
})
