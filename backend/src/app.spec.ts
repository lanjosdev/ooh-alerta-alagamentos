import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

let app: Awaited<ReturnType<typeof buildApp>>

describe('HTTP', () => {
  beforeAll(async () => {
    app = await buildApp()
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /v1/health retorna 200 no padrão ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      success: true,
      message: null,
      data: {
        status: 'ok',
      },
    })
    expect(typeof response.json().data.uptime).toBe('number')
    expect(typeof response.json().data.timestamp).toBe('string')
  })

  it('rotas sem o prefixo /v1 retornam 404 em ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      success: false,
      message: 'Rota GET /health não encontrada',
      data: null,
    })
  })

  it('rota inexistente retorna 404 no padrão ApiResponse', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/nao-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      success: false,
      message: 'Rota GET /v1/nao-existe não encontrada',
      data: null,
    })
  })

  it('gera a documentação OpenAPI em /docs/json', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' })

    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json().paths)).toContain('/v1/health')
  })

  it('CORS responde corretamente ao preflight OPTIONS', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/health',
      headers: {
        origin: 'http://ooh-player.test',
        'access-control-request-method': 'GET',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://ooh-player.test')
    expect(response.headers['access-control-allow-methods']).toContain('GET')
  })
})
