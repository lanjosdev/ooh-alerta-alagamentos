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
Retorna a saúde em tempo real, número de chaves em cache, última latência e último erro (se houver) de cada provedor registrado (`open-meteo`, `inmet`, `cge-sp`, `overpass`, `geosampa-wfs`, `nominatim`), além de provedores sob demanda como `open-meteo-historical`.

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

### Player Criativo DOOH (`/v1/player/*`)

> **Nota de fase PoC (Custo Zero):** as integrações públicas gratuitas de Open-Meteo (`historical-forecast-api` / `archive-api`), Overpass API e Nominatim são restritas à fase de PoC e protegidas por cache TTL de 24h (`86400s`) e fila serial no backend. Dados cartográficos e viários: `© OpenStreetMap contributors (ODbL)`.

#### `GET /v1/player/assets`
Lista o catálogo curado dos **7 corredores OOH icônicos de São Paulo** com geometrias reais OSM em snapshot local, câmera sugerida (`center`, `zoom`, `bearing`, `bounds`) e resumo atual ou histórico de risco.

- **Query params opcionais:** `date`, `time`, `cgeDate`, `simulate`.

#### `GET /v1/player/geocode?q=`
Executa busca textual de endereços e avenidas restrita ao Estado de São Paulo (`BR-SP`, *viewbox* RMSP) via `NominatimGeocodingProvider`, respeitando fila serial (`>= 1100 ms` entre chamadas) e cache TTL.

- **Query params obrigatórios:**
  - `q`: texto de busca entre `3` e `120` caracteres (`400` fora desse intervalo).

#### `GET /v1/player/scene`
Orquestra a cena completa pronta para o Player Criativo DOOH (`PlayerSceneData`): decisão de risco (`decision`, contendo `decision.temporal` como fonte única), textos editoriais PT-BR (`editorial`), câmera com `bounds`, `FeatureCollection` GeoJSON dos trechos viários com `riskIntensity` (`0..1`) e status detalhado das 5 fontes.

- **Query params:**
  - **Alvo (XOR obrigatório):** informe `assetId` (ex.: `av-roberto-marinho`) **ou** o par completo `lat` + `lon`. Informar ambos ou omitir ambos retorna **`400 Bad Request`**. Se `assetId` não existir no catálogo, retorna **`404 Not Found`**.
  - **Temporais / Simulação (opcionais):** `date` (`YYYY-MM-DD`), `time` (`HH:MM`), `cgeDate` (`DD/MM/AAAA`), `simulate`.
- **Degradação graciosa:** em consultas por coordenadas (`lat`/`lon`), caso todos os mirrors do Overpass ou o GeoSampa WFS falhem, o endpoint ainda responde **`200 OK`** com `roads.features: []` (ou `geoSampaZonesCount: 0`) e `sources.roadGeometry.status = "error"` (`sources.floodSusceptibility.status = "error"`). Fora da Capital SP (`ibgeCode !== "3550308"`), `sources.floodSusceptibility.status` é `"skipped"`.
- **Exemplo resumido de Resposta `200 OK`:**
  ```json
  {
    "success": true,
    "message": null,
    "data": {
      "evaluatedAt": "2025-01-24T20:30:00.000Z",
      "assetId": "av-roberto-marinho",
      "targetKind": "asset",
      "decision": {
        "temporal": {
          "mode": "historical",
          "date": "2025-01-24",
          "time": "20:30",
          "resolvedTime": "20:30",
          "referenceAt": "2025-01-24T20:30:00-03:00"
        },
        "severityLevel": 3,
        "severityLabel": "CRITICO",
        "riskScore": 95,
        "triggerOverride": true
      },
      "editorial": {
        "headline": "ALAGAMENTO INTRANSITÁVEL NA VIA",
        "corridorName": "Av. Jornalista Roberto Marinho",
        "riskWindowLabel": "Via com bloqueio por alagamento",
        "statusNote": "1 ocorrência(s) ativa(s) na região. Evite trechos baixos e busque rotas alternativas.",
        "sourcesLabel": "Dados CGE-SP / Open-Meteo Histórico / GeoSampa",
        "telemetryModeLabel": "REPLAY • 24/01/2025 20:30",
        "telemetryStatusPill": "REPLAY HISTÓRICO"
      },
      "camera": {
        "center": [-46.6869, -23.6217],
        "zoom": 15.2,
        "bearing": 12,
        "bounds": [[-46.6942, -23.6284], [-46.6795, -23.6149]]
      },
      "roads": {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "geometry": {
              "type": "LineString",
              "coordinates": [[-46.69, -23.621], [-46.685, -23.622]]
            },
            "properties": {
              "osmId": "123456",
              "streetName": "Avenida Jornalista Roberto Marinho",
              "highway": "primary",
              "isPrimaryCorridor": true,
              "matchedCge": true,
              "matchedCgeImpassable": true,
              "inGeoSampaZone": true,
              "riskIntensity": 1
            }
          }
        ]
      },
      "geoSampaZonesCount": 2,
      "sources": {
        "forecast": { "provider": "open-meteo-historical", "status": "ok", "cached": false, "stale": false, "fetchedAt": "2025-01-24T20:30:00.000Z", "error": null },
        "officialAlerts": { "provider": "inmet", "status": "skipped", "cached": false, "stale": false, "fetchedAt": null, "error": null },
        "floodingMonitor": { "provider": "cge-sp", "status": "ok", "cached": false, "stale": false, "fetchedAt": "2025-01-24T20:30:00.000Z", "error": null },
        "roadGeometry": { "provider": "osm-curated-snapshot", "status": "ok", "cached": true, "stale": false, "fetchedAt": null, "error": null },
        "floodSusceptibility": { "provider": "geosampa-wfs", "status": "ok", "cached": false, "stale": false, "fetchedAt": "2025-01-24T20:30:00.000Z", "error": null }
      }
    }
  }
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
