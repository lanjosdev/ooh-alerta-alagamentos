# OOH Alerta Alagamentos

Plataforma tecnológica para transformar telas digitais de mídia OOH (como relógios urbanos e painéis `9:16` / `16:9`) em pontos dinâmicos de informação e alerta sobre chuvas intensas e riscos de alagamento.

- **Foco inicial da PoC:** Capital de São Paulo (`IBGE 3550308`) com catálogo de **7 corredores OOH icônicos curados** (geometrias reais OSM embarcadas), catálogo de **12 regiões estratégicas** e mapeamento das **28 estações físicas do CGE-SP**.
- **Player Criativo DOOH (WebGL):** mapa vetorial editorial P&B (`MapLibre GL JS` + `OpenFreeMap`) combinado à mancha azul luminosa animada em GPU (`deck.gl` `@deck.gl/mapbox` sobre a geometria real das vias), com personalização white-label PT-BR e Modo Player Limpo dirigido por URL (`/?mode=player` / `/player`).
- **Replay Histórico Real + Multi-município:** consultas por data e hora passadas (`date=YYYY-MM-DD` e `time=HH:MM`) reconstroem alagamentos ativos do **CGE-SP** e precipitação horária real (**Open-Meteo Historical Forecast**); fora da Capital SP, opera cruzando **Open-Meteo**, **INMET** e **Overpass OSM**.
- **Formatos de entrega:** API REST (`JSON` no padrão `ApiResponse<T>` + `GeoJSON` `/v1/player/scene`) e Feeds `XML / RSS 2.0` com namespace `<ooh:*>` (protegidos para tempo real).

> **Nota da fase PoC (Custo Zero):** as integrações públicas gratuitas de **Open-Meteo** (`historical-forecast-api` / `archive-api`), **Overpass API** e **Nominatim** são restritas à fase de PoC e protegidas por cache TTL de 24h e fila serial no backend. Dados cartográficos e viários: `© OpenStreetMap contributors (ODbL) • OpenFreeMap`.

---

## Estrutura do Repositório

```text
ooh-alerta-alagamentos/
├── AGENTS.md                  # Diretrizes globais de governança e código
├── README.md                  # Visão geral do repositório
├── docs/                      # Documentação de produto, viabilidade, pesquisa e escopo DOOH
├── backend/                   # API Fastify v5 + TypeScript + Zod + Turf.js + Swagger + Vitest
│   ├── AGENTS.md              # Diretrizes arquiteturais do backend
│   ├── API.md                 # Contrato dos endpoints REST, Player DOOH e RSS 2.0
│   ├── docs/architecture.md   # Blueprint técnico, fluxos e roadmap de provedores
│   ├── scripts/smoke-live.ts  # Verificação integrada ao vivo (Open-Meteo, INMET, CGE-SP)
│   └── src/                   # Código-fonte da aplicação
└── frontend/                  # SPA React 19 + Vite + Tailwind v4 + TanStack Query + MapLibre GL JS + deck.gl
    ├── AGENTS.md              # Diretrizes arquiteturais e gates do frontend
    ├── README.md              # Guia de execução, rewrite SPA (/player) e testes do frontend
    └── src/                   # Páginas (/ e ?mode=player), componentes, hooks, services e utilitários
```

---

## Pré-requisitos

- **Node.js** `>= 22` (validado em `v24.22.3`)
- **npm** `>= 10`

---

## Configuração e Execução (Backend + Frontend)

Execute os comandos de cada aplicação dentro de seu respectivo diretório (`backend/` ou `frontend/`).

### 1. Backend (`backend/`)

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 2. Frontend (`frontend/`)

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

> Consulte [`frontend/README.md`](./frontend/README.md) para detalhes das variáveis `VITE_API_BASE_URL` / `VITE_API_TIMEOUT_MS`, rewrite SPA para `/player`, personalização white-label e gates de qualidade do frontend.

### Variáveis de Ambiente (`backend/.env`)

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Ambiente (`development`, `test`, `production`) |
| `PORT` | `3333` | Porta HTTP do servidor |
| `HOST` | `0.0.0.0` | Endereço de escuta |
| `CORS_ORIGIN` | `*` | Origens permitidas no CORS (`*` ou lista separada por vírgula) |
| `RATE_LIMIT_MAX` | `120` | Limite de requisições por minuto |
| `ENABLE_SIMULATION_PARAMS` | `false` | Restringe apenas `?simulate=` artificial; replay histórico (`?date=` / `?time=`) fica sempre habilitado em JSON |
| `FORECAST_PROVIDER` | `open-meteo` | Provedor de previsão (`open-meteo`, `tomorrow-io`, `google-weather`) |
| `HTTP_TIMEOUT_MS` | `8000` | Timeout explícito das chamadas externas (ms) |
| `CACHE_TTL_FORECAST_SECONDS` | `900` | TTL do cache da previsão horária (s) |
| `CACHE_TTL_INMET_SECONDS` | `600` | TTL do cache dos avisos oficiais INMET (s) |
| `CACHE_TTL_CGE_SECONDS` | `300` | TTL do cache de alagamentos e estações CGE-SP (s) |
| `CACHE_TTL_HISTORICAL_SECONDS` | `86400` | TTL do cache para datas históricas passadas (s) |
| `CACHE_TTL_OVERPASS_SECONDS` | `86400` | TTL do cache de geometrias viárias Overpass (s) |
| `CACHE_TTL_GEOSAMPA_SECONDS` | `86400` | TTL do cache de manchas GeoSampa WFS (s) |
| `CACHE_TTL_GEOCODE_SECONDS` | `86400` | TTL do cache de geocodificação Nominatim (s) |
| `OVERPASS_URLS` | `maps.mail.ru,overpass-api.de,overpass.private.coffee` | Lista de mirrors Overpass API separados por vírgula |
| `NOMINATIM_USER_AGENT` | `ooh-alerta-alagamentos/0.2 (...)` | Header `User-Agent` enviado ao Nominatim e Overpass |

### Endpoints Principais (com `npm run dev`)

- Swagger UI: `http://localhost:3333/docs`
- Healthcheck + capacidades: `GET http://localhost:3333/v1/health`
- Saúde das fontes externas: `GET http://localhost:3333/v1/sources/status`
- Catálogo de regiões (12): `GET http://localhost:3333/v1/regions`
- Panorama consolidado (JSON): `GET http://localhost:3333/v1/alerts/regions`
- Alerta por região (JSON): `GET http://localhost:3333/v1/alerts/regions/zona-oeste-butanta`
- Alerta por coordenada (JSON): `GET "http://localhost:3333/v1/alerts/by-coordinates?lat=-23.5317&lon=-46.7294"`
- Catálogo de pontos OOH curados (7): `GET http://localhost:3333/v1/player/assets`
- Busca textual de endereço (Nominatim BR-SP): `GET "http://localhost:3333/v1/player/geocode?q=Avenida+Paulista"`
- Cena completa do Player DOOH (`GeoJSON` + câmera + editorial): `GET "http://localhost:3333/v1/player/scene?assetId=av-roberto-marinho"`
- Feed consolidado (RSS 2.0): `GET http://localhost:3333/v1/alerts/feed.xml`
- Feed por região (RSS 2.0): `GET http://localhost:3333/v1/alerts/regions/zona-oeste-butanta/feed.xml`
- Feed por coordenada (RSS 2.0): `GET "http://localhost:3333/v1/alerts/by-coordinates/feed.xml?lat=-22.9099&lon=-47.0626"`

---

## Comandos de Qualidade e Smoke Test Ao Vivo

### Backend (`cd backend`)
```bash
cd backend
npm run typecheck        # Verificação estrita TypeScript (tsc --noEmit)
npm run test             # Suíte offline e determinística (Vitest)
npm run build            # Compilação de produção para backend/build/
npm run smoke:live       # Smoke test ao vivo contra Open-Meteo, INMET e CGE-SP
npm run validate:routes  # Validação E2E HTTP real de todos os 8 blocos do roteiro (aceita BASE_URL opcional)
```

### Frontend (`cd frontend`)
```bash
cd frontend
npm run typecheck        # Verificação estrita TypeScript (tsc -b --noEmit)
npm run lint             # ESLint
npm run test             # Suíte Vitest + Testing Library
npm run build            # Build de produção em frontend/dist/
```

---

## Documentação Adicional

- [Índice de Produto, Pesquisa e Escopo (`docs/README.md`)](./docs/README.md)
  - [Análise do Briefing e Viabilidade Técnica (`docs/01-analise-briefing-e-viabilidade.md`)](./docs/01-analise-briefing-e-viabilidade.md)
  - [Pesquisa de Stack e Fontes de Dados (`docs/02-pesquisa-stack-e-fontes-dados.md`)](./docs/02-pesquisa-stack-e-fontes-dados.md)
  - [Escopo da PoC — Player Criativo DOOH (`docs/03-escopo-poc-player-dooh.md`)](./docs/03-escopo-poc-player-dooh.md)
  - [Escopo — Alertas de Vias Vizinhas no Player DOOH (`docs/04-escopo-alertas-vias-vizinhas.md`)](./docs/04-escopo-alertas-vias-vizinhas.md)
  - [Avaliação — Detecção de Ocorrências em Tempo Real e Fontes Complementares (`docs/05-avaliacao-fontes-tempo-real.md`)](./docs/05-avaliacao-fontes-tempo-real.md)
  - [Decisão — Horizonte de Risco em Horas e Critérios Antialarmismo (`docs/06-criterios-horizonte-e-antialarmismo.md`)](./docs/06-criterios-horizonte-e-antialarmismo.md)
  - [Avaliação — Papel do GeoSampa na Inteligência de Risco (`docs/07-avaliacao-geosampa-suscetibilidade.md`)](./docs/07-avaliacao-geosampa-suscetibilidade.md)
  - [Escopo — Base Histórica de Alagamentos e Camada no Mapa Explorador (`docs/08-escopo-base-historica-alagamentos.md`)](./docs/08-escopo-base-historica-alagamentos.md)
  - [Escopo — Cadastro e Importação dos Pontos OOH da Campanha (`docs/09-escopo-cadastro-pontos-ooh.md`)](./docs/09-escopo-cadastro-pontos-ooh.md)
  - [Roadmap e Backlog Consolidado (`docs/10-roadmap-e-backlog.md`)](./docs/10-roadmap-e-backlog.md)
- [Diretrizes do Backend (`backend/AGENTS.md`)](./backend/AGENTS.md)
- [Diretrizes do Frontend (`frontend/AGENTS.md`)](./frontend/AGENTS.md)
- [Guia do Frontend (`frontend/README.md`)](./frontend/README.md)
- [Contrato da API (`backend/API.md`)](./backend/API.md)
- [Arquitetura da Plataforma (`backend/docs/architecture.md`)](./backend/docs/architecture.md)

---

## Fluxo de Trabalho Git

- A branch `main` mantém a base estável e validada pelos gates.
- Novas funcionalidades são desenvolvidas em feature branches (como `feat/poc-player-dooh`) com commits atômicos no padrão Conventional Commits e revisão via Pull Request.
