import { describe, expect, it } from 'vitest'
import { CGE_SP_STATIONS, findCgeStationById, findNearestCgeStation } from './cge-sp-stations.js'

describe('cge-sp-stations', () => {
  it('mantém o catálogo completo de 28 estações físicas com IDs únicos', () => {
    expect(CGE_SP_STATIONS).toHaveLength(28)
    expect(new Set(CGE_SP_STATIONS.map((s) => s.id)).size).toBe(28)
    expect(findCgeStationById('1000842')?.name).toBe('Butantã')
    expect(findCgeStationById('999999')).toBeNull()
  })

  it('resolve bairros fora das 12 regiões demo para a estação CGE mais próxima', () => {
    // Vila Leopoldina (-23.5317, -46.7294) -> Lapa (1000848 / Zona Oeste)
    const vilaLeopoldina = findNearestCgeStation(-23.5317, -46.7294)
    expect(vilaLeopoldina).toMatchObject({
      id: '1000848',
      name: 'Lapa',
      zone: 'Zona Oeste',
    })
    expect(vilaLeopoldina?.distanceMeters).toBeLessThan(5_000)

    // Jabaquara (-23.6431, -46.6436) -> Jabaquara (634 / Zona Sul)
    const jabaquara = findNearestCgeStation(-23.6431, -46.6436)
    expect(jabaquara).toMatchObject({
      id: '634',
      name: 'Jabaquara',
      zone: 'Zona Sul',
      distanceMeters: 0,
    })
  })

  it('retorna null para municípios fora do raio da Capital SP (ex.: Campinas)', () => {
    const campinas = findNearestCgeStation(-22.9099, -47.0626)
    expect(campinas).toBeNull()
  })
})
