import { describe, expect, it } from 'vitest'
import { InMemoryRegionRepository, SAO_PAULO_INITIAL_REGIONS } from './in-memory-region-repository.js'

describe('InMemoryRegionRepository', () => {
  it('carrega todas as 12 regiões iniciais da Capital de São Paulo', async () => {
    const repository = new InMemoryRegionRepository()
    const regions = await repository.listAll()

    expect(SAO_PAULO_INITIAL_REGIONS).toHaveLength(12)
    expect(regions).toHaveLength(12)
    expect(new Set(regions.map((r) => r.id)).size).toBe(12)
    expect(regions.every((r) => r.ibgeCode === '3550308' && r.city === 'São Paulo' && r.state === 'SP')).toBe(true)
  })

  it('filtra por zona de forma insensível a maiúsculas e acentos e por ibgeCode exato', async () => {
    const repository = new InMemoryRegionRepository()

    const westZone = await repository.listAll({ zone: '  zona oeste ' })
    expect(westZone.map((r) => r.id)).toEqual([
      'zona-oeste-pinheiros',
      'zona-oeste-butanta',
      'zona-oeste-lapa',
    ])

    const southeastZone = await repository.listAll({ zone: 'ZONA SUDESTE' })
    expect(southeastZone.map((r) => r.id)).toEqual([
      'zona-leste-vila-prudente',
      'zona-sul-ipiranga',
    ])

    expect(await repository.listAll({ ibgeCode: '3550308' })).toHaveLength(12)
    expect(await repository.listAll({ ibgeCode: '3509502' })).toEqual([])
  })

  it('busca região por ID retornando null quando inexistente', async () => {
    const repository = new InMemoryRegionRepository()

    const butanta = await repository.findById('zona-oeste-butanta')
    expect(butanta).toMatchObject({
      id: 'zona-oeste-butanta',
      name: 'Butantã',
      cgeStationId: '1000842',
    })

    expect(await repository.findById('inexistente')).toBeNull()
  })

  it('encontra a região mais próxima dentro do raio e retorna null fora dele', async () => {
    const repository = new InMemoryRegionRepository()

    // Vila Leopoldina (-23.5317, -46.7294) está a ~3 km da Lapa
    const nearVilaLeopoldina = await repository.findNearest(-23.5317, -46.7294, 5_000)
    expect(nearVilaLeopoldina?.id).toBe('zona-oeste-lapa')

    // Campinas (-22.9099, -47.0626) está fora do raio de 12 km
    const campinas = await repository.findNearest(-22.9099, -47.0626, 12_000)
    expect(campinas).toBeNull()
  })
})
