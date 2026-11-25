# Contrato da API — OOH Alerta Alagamentos

Documentação de referência dos endpoints HTTP expostos pelo `backend/`. A especificação OpenAPI 3.0 é gerada automaticamente a partir dos schemas Zod e fica disponível em **`GET /docs`** (Swagger UI) e **`GET /docs/json`**.

---

## Convenções Gerais

- **Prefixo da API:** `/v1`
- **Envelope Padrão JSON (`ApiResponse<T>`):**
  - **Sucesso (`200 OK`):**
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
- **Feeds XML / RSS 2.0:** rotas terminadas em `/feed.xml` entregam XML puro (`Content-Type: application/rss+xml; charset=utf-8`) com tags RSS 2.0 padrão e extensões no namespace `xmlns:ooh="https://ooh-alerta-alagamentos.local/ns/1.0"`.

---

## Motor de Classificação de Risco

| Nível | `severityLabel` | `triggerOverride` | Critérios Determinísticos |
| :---: | :--- | :---: | :--- |
| **3** | `CRITICO` | `true` | ≥ 1 alagamento ativo e intransitável do CGE-SP na zona **ou** chuva atual na estação CGE ≥ `40 mm` com pico previsto ≥ `10 mm/h` nas próximas 2h |
| **2** | `ALERTA` | `true` | ≥ 1 alagamento ativo e transitável na zona **ou** chuva na estação CGE ≥ `20 mm` **ou** (chance próximas 2h ≥ `65%` e pico ≥ `15 mm/h`) **ou** aviso INMET `severityRank >= 2` |
| **1** | `ATENCAO` | `true` | (chance próximas 2h ≥ `60%` e pico ≥ `5 mm/h`) **ou** aviso INMET `severityRank === 1` |
| **0** | `NORMAL` | `false` | Nenhum dos critérios acima |

---

## Endpoints Ativos (`/v1`)

### Infra e Diagnóstico

#### `GET /v1/health`
Verifica a saúde, o tempo de atividade do servidor (`uptime`, `timestamp`) e as capacidades ativas (`capabilities.simulation` refletindo `ENABLE_SIMULATION_PARAMS`).

```json
{
  "success": true,
  "message": null,
  "data": {
    "status": "ok",
    "uptime": 12.34,
    "timestamp": "2026-11-25T18:00:00.000Z",
    "capabilities": {
      "simulation": false
    }
  }
}
```

#### `GET /v1/sources/status`
Retorna a saúde em tempo real, número de chaves em cache, última latência e último erro (se houver) de cada provedor registrado (`open-meteo`, `inmet`, `cge-sp`).

---

### Regiões Monitoradas

#### `GET /v1/regions`
Lista o catálogo inicial de 12 regiões monitoradas na Capital de São Paulo (`IBGE 3550308`).

- **Query params opcionais:**
  - `zone`: filtra por zona CGE (comparação sem acentos/case, ex.: `Zona Oeste`, `Centro`).
  - `ibgeCode`: filtra por código IBGE exato (ex.: `3550308`).

---

### Alertas (JSON `ApiResponse`)

#### Query Params Temporais, Replay Histórico e Simulação
- **Replay histórico real (sempre habilitado nos endpoints JSON):**
  - `date`: consulta replay histórico completo em `YYYY-MM-DD` (rejeita datas futuras no fuso `America/Sao_Paulo` com `400`). Reconstrói os pontos ativos do CGE-SP pela janela horária (`De HH:MM a HH:MM` / `Desde HH:MM`) e busca série horária histórica via `historical-forecast-api.open-meteo.com` (fallback `archive-api`). No modo histórico, `officialAlerts` retorna `status: "skipped"` e `flooding.stationRainfall` retorna `null`.
  - `time`: horário opcional em `HH:MM` (`00:00` a `23:59`; exige `date` junto, senão retorna `400`). Quando omitido, o backend seleciona automaticamente o minuto de pico de alagamentos no CGE-SP (ou o pico de precipitação horária do Open-Meteo / `12:00` se o dia estiver vazio/seco).
  - `cgeDate`: formato legado `DD/MM/AAAA` para consulta histórica do CGE-SP (mutuamente exclusivo com `date` — informar ambos retorna `400`).
- **Simulação artificial (`ENABLE_SIMULATION_PARAMS=true`):**
  - `simulate`: força nível de resposta (`normal` | `attention` | `alert` | `critical`) marcando `simulated: true`. Quando `ENABLE_SIMULATION_PARAMS=false`, apenas `simulate` retorna `400 Bad Request`.

#### `GET /v1/alerts/regions`
Retorna o panorama consolidado de todas as regiões monitoradas, ordenado por `severityLevel` descendente, `riskScore` descendente e `location.id` ascendente.

- **Query params opcionais:** `zone`, `ibgeCode`, `date`, `time`, `cgeDate`, `simulate`.

#### `GET /v1/alerts/regions/:regionId`
Retorna a decisão detalhada de risco para uma região específica (ex.: `zona-oeste-butanta`, `zona-leste-itaquera`). Retorna `404` se a região não existir.

- **Query params opcionais:** `date`, `time`, `cgeDate`, `simulate`.
- **Exemplo de Resposta `200 OK`:**
  ```json
  {
    "success": true,
    "message": null,
    "data": {
      "evaluatedAt": "2026-11-23T19:00:00.000Z",
      "temporal": {
        "mode": "realtime",
        "date": null,
        "time": null,
        "resolvedTime": null,
        "referenceAt": "2026-11-23T16:00:00-03:00"
      },
      "location": {
        "id": "zona-oeste-butanta",
        "name": "Butantã",
        "city": "São Paulo",
        "state": "SP",
        "ibgeCode": "3550308",
        "zone": "Zona Oeste",
        "latitude": -23.5672,
        "longitude": -46.729,
        "cgeStationId": "1000842",
        "cgeStationName": "Butantã",
        "historicalRiskWeight": 0.75
      },
      "triggerOverride": true,
      "severityLevel": 1,
      "severityLabel": "ATENCAO",
      "riskScore": 46,
      "simulated": false,
      "reasons": ["Aviso oficial INMET ativo em grau Perigo Potencial"],
      "display": {
        "headline": "ATENÇÃO PARA CHUVA FORTE — Butantã",
        "message": "Chuva prevista para Butantã (40% de chance nas próximas 2h). Atenção em pontos críticos.",
        "subtext": "Butantã (Zona Oeste) • Nível ATENCAO (46/100)"
      },
      "forecast": {
        "provider": "open-meteo",
        "gridLatitude": -23.585238,
        "gridLongitude": -46.754486,
        "timezone": "America/Sao_Paulo",
        "current": {
          "observedAt": "2026-11-23T19:00",
          "temperatureC": 23.4,
          "humidityPercent": 82,
          "precipitationMm": 0.4,
          "rainMm": 0.4,
          "weatherCode": 61,
          "isDay": false,
          "isRaining": true
        },
        "maxRainProbabilityNext2hPercent": 40,
        "expectedRainNext2hMm": 0.8,
        "peakRainIntensityNext2hMmPerHour": 0.5,
        "maxRainProbabilityNext6hPercent": 55,
        "expectedRainNext6hMm": 2.4,
        "hourly": []
      },
      "officialAlerts": [],
      "flooding": {
        "cgeDate": null,
        "activeInZoneCount": 0,
        "impassableInZoneCount": 0,
        "passableInZoneCount": 0,
        "pointsInZone": [],
        "stationRainfall": {
          "stationId": "1000842",
          "stationName": "Butantã",
          "currentPeriodMm": 0.4,
          "previousPeriodMm": 25.2,
          "recentDeltaMm": 0.2,
          "resetTime": "10:00:00",
          "temperatureC": 25.6,
          "humidityPercent": 75.1
        }
      },
      "sources": {
        "forecast": { "provider": "open-meteo", "status": "ok", "cached": false, "stale": false, "fetchedAt": "2026-11-23T19:00:00.000Z", "error": null },
        "officialAlerts": { "provider": "inmet", "status": "ok", "cached": false, "stale": false, "fetchedAt": "2026-11-23T19:00:00.000Z", "error": null },
        "floodingMonitor": { "provider": "cge-sp", "status": "ok", "cached": false, "stale": false, "fetchedAt": "2026-11-23T19:00:00.000Z", "error": null }
      }
    }
  }
  ```

#### `GET /v1/alerts/by-coordinates?lat=&lon=`
Decisão hiperlocal para qualquer coordenada (`lat` entre `-90` e `90`, `lon` entre `-180` e `180`):
- **Dentro da Capital SP** (raio de 12 km de uma das 28 estações do CGE-SP, ex.: Vila Leopoldina `-23.5317, -46.7294`): resolve automaticamente para a estação física e zona mais próximas (`Lapa 1000848` / `Zona Oeste`) e consulta o CGE-SP.
- **Demais municípios** (ex.: Campinas `-22.9099, -47.0626`): opera em modo multi-município combinando Open-Meteo e INMET (interseção *point-in-polygon* GeoJSON), marcando `sources.floodingMonitor.status = "skipped"`.

---

### Feeds DOOH (`XML / RSS 2.0`)

> **Proteção para Players DOOH:** os endpoints `/feed.xml` rejeitam `date` e `time` com **`400 Bad Request`** para evitar que replays históricos sejam exibidos em telas de rua como alertas em tempo real.

#### `GET /v1/alerts/feed.xml`
Feed RSS 2.0 consolidado de todas as regiões monitoradas (aceita `zone`, `ibgeCode`, `cgeDate`, `simulate`).

#### `GET /v1/alerts/regions/:regionId/feed.xml`
Feed RSS 2.0 individual para consumo direto por um player DOOH associado à região (aceita `cgeDate`, `simulate`).

#### `GET /v1/alerts/by-coordinates/feed.xml?lat=&lon=`
Feed RSS 2.0 individual por coordenada geográfica (aceita `lat`, `lon`, `cgeDate`, `simulate`).

- **Exemplo de Saída `XML / RSS 2.0`:**
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0" xmlns:ooh="https://ooh-alerta-alagamentos.local/ns/1.0">
    <channel>
      <title>OOH Alerta Alagamentos — Butantã</title>
      <link>http://localhost:3333/v1/alerts/regions/zona-oeste-butanta/feed.xml</link>
      <description>Feed RSS 2.0 individual para player DOOH da região Butantã</description>
      <language>pt-BR</language>
      <lastBuildDate>Mon, 23 Nov 2026 19:00:00 GMT</lastBuildDate>
      <item>
        <title>ATENÇÃO PARA CHUVA FORTE — Butantã</title>
        <link>http://localhost:3333/v1/alerts/regions/zona-oeste-butanta/feed.xml</link>
        <description>Chuva prevista para Butantã (40% de chance nas próximas 2h). Atenção em pontos críticos.</description>
        <guid isPermaLink="false">zona-oeste-butanta-ATENCAO-2026-11-23T19:00:00.000Z</guid>
        <pubDate>Mon, 23 Nov 2026 19:00:00 GMT</pubDate>
        <category>ATENCAO</category>
        <ooh:regionId>zona-oeste-butanta</ooh:regionId>
        <ooh:locationName>Butantã</ooh:locationName>
        <ooh:zone>Zona Oeste</ooh:zone>
        <ooh:ibgeCode>3550308</ooh:ibgeCode>
        <ooh:latitude>-23.5672</ooh:latitude>
        <ooh:longitude>-46.729</ooh:longitude>
        <ooh:triggerOverride>true</ooh:triggerOverride>
        <ooh:severityLevel>1</ooh:severityLevel>
        <ooh:severityLabel>ATENCAO</ooh:severityLabel>
        <ooh:riskScore>46</ooh:riskScore>
        <ooh:simulated>false</ooh:simulated>
        <ooh:rainProbabilityNext2hPercent>40</ooh:rainProbabilityNext2hPercent>
        <ooh:isRainingNow>true</ooh:isRainingNow>
        <ooh:activeFloodingsInZone>0</ooh:activeFloodingsInZone>
        <ooh:headline>ATENÇÃO PARA CHUVA FORTE — Butantã</ooh:headline>
        <ooh:message>Chuva prevista para Butantã (40% de chance nas próximas 2h). Atenção em pontos críticos.</ooh:message>
        <ooh:subtext>Butantã (Zona Oeste) • Nível ATENCAO (46/100)</ooh:subtext>
      </item>
    </channel>
  </rss>
  ```

---

## Documentação Interativa e Validação Ao Vivo

- **Swagger UI:** `GET /docs`
- **OpenAPI JSON:** `GET /docs/json`
- **Smoke test integrado com fontes reais (Open-Meteo, INMET e CGE-SP):**
  ```bash
  cd backend
  npm run smoke:live
  ```
- **Validação E2E completa de todas as rotas (8 blocos do roteiro HTTP real):**
  ```bash
  cd backend
  npm run validate:routes
  # Opcional: apontar contra uma instância já rodando (ex.: npm run dev)
  # BASE_URL=http://localhost:3333 npm run validate:routes
  ```
  > Em ambientes Windows com cadeia corporativa/certificados no repositório do SO, os scripts `dev`, `start`, `smoke:live` e `validate:routes` utilizam `--use-system-ca` para validação TLS nativa com `fetch`.
