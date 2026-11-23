# Contrato da API — OOH Alerta Alagamentos

Documentação de referência dos endpoints HTTP expostos pelo `backend/`. A especificação OpenAPI 3.0 é gerada automaticamente a partir dos schemas Zod e fica disponível em tempo real em **`GET /docs`** (Swagger UI) e **`GET /docs/json`**.

---

## Convenções Gerais

- **Prefixo da API:** `/v1`
- **Envelope Padrão JSON (`ApiResponse<T>`):**
  - **Sucesso:**
    ```json
    {
      "success": true,
      "message": null,
      "data": {}
    }
    ```
  - **Erro (`4xx` / `5xx`):**
    ```json
    {
      "success": false,
      "message": "Descrição legível do erro",
      "data": null
    }
    ```
- **Feeds XML / RSS 2.0 (planejados):** rotas terminadas em `/feed.xml` respondem `Content-Type: application/rss+xml; charset=utf-8` com XML RSS 2.0 puro para compatibilidade direta com players DOOH.

---

## Endpoints Ativos (Bootstrap `main`)

### `GET /v1/health`
Verifica a saúde e o tempo de atividade do servidor.

- **Tag:** `Infra`
- **Resposta `200 OK`:**
  ```json
  {
    "success": true,
    "message": null,
    "data": {
      "status": "ok",
      "uptime": 12.345,
      "timestamp": "2026-11-23T15:00:00.000Z"
    }
  }
  ```

### `GET /docs` e `GET /docs/json`
Documentação interativa **Swagger UI** e JSON OpenAPI 3.0 gerados automaticamente pelo `@fastify/swagger`.

---

## Roadmap de Endpoints (Branch `feat/poc-flood-alerts-api`)

Os endpoints abaixo compõem a PoC de coleta e distribuição de alertas (a ser implementada na branch de feature a partir desta base):

| Método | Rota | Formato | Descrição |
| :---: | :--- | :---: | :--- |
| `GET` | `/v1/sources/status` | JSON | Saúde, latência e estado do cache de cada provedor (`open-meteo`, `inmet`, `cge-sp`) |
| `GET` | `/v1/regions` | JSON | Catálogo inicial de regiões monitoradas na Capital SP (com zona, `lat/lon`, código IBGE e posto CGE) |
| `GET` | `/v1/alerts/regions` | JSON | Panorama consolidado de risco de todas as regiões monitoradas |
| `GET` | `/v1/alerts/regions/:regionId` | JSON | Decisão dinâmica de alerta para um ponto/região (`triggerOverride`, `severityLevel`, `%` chuva, alagamentos, mensagem OOH) |
| `GET` | `/v1/alerts/by-coordinates?lat=&lon=` | JSON | Decisão hiperlocal por qualquer coordenada (SP Capital com CGE-SP + demais municípios de SP via previsão e INMET) |
| `GET` | `/v1/alerts/feed.xml` | XML / RSS 2.0 | Feed RSS consolidado com tags padrão + namespace `<ooh:*>` |
| `GET` | `/v1/alerts/regions/:regionId/feed.xml` | XML / RSS 2.0 | Feed RSS individual para consumo por player DOOH da região |
| `GET` | `/v1/alerts/by-coordinates/feed.xml?lat=&lon=` | XML / RSS 2.0 | Feed RSS individual por coordenada exata |
