# OOH Alerta Alagamentos

Plataforma tecnológica para transformar telas digitais de mídia OOH (como relógios urbanos) em pontos dinâmicos de informação e alerta sobre chuvas intensas e riscos de alagamento.

- **Foco inicial da PoC:** Capital de São Paulo (`IBGE 3550308`) com catálogo inicial de 12 regiões estratégicas e mapeamento das 28 estações físicas do CGE-SP.
- **Multi-município nativo:** consultas por coordenada (`lat/lon`) funcionam em todo o Estado de São Paulo cruzando previsão horária (**Open-Meteo**) e avisos oficiais (**INMET** via IBGE e *point-in-polygon* GeoJSON), acionando o **CGE-SP** automaticamente quando o ponto está na Capital SP.
- **Provedores plugáveis:** contratos tipados em `backend/src/providers/` permitindo substituir o Open-Meteo por APIs comerciais (**Tomorrow.io**, **Google Weather API**) via `FORECAST_PROVIDER`.
- **Formatos de entrega:** API REST (`JSON` no padrão `ApiResponse<T>`) e Feeds `XML / RSS 2.0` com namespace `<ooh:*>` para consumo direto pelos players DOOH.

---

## Estrutura do Repositório

```text
ooh-alerta-alagamentos/
├── AGENTS.md                  # Diretrizes globais de governança e código
├── README.md                  # Visão geral do repositório
├── docs/                      # Documentação de produto, viabilidade, pesquisa e escopo DOOH
├── backend/                   # API Fastify v5 + TypeScript + Zod + Swagger + Vitest
│   ├── AGENTS.md              # Diretrizes arquiteturais do backend
│   ├── API.md                 # Contrato dos endpoints REST e RSS 2.0
│   ├── docs/architecture.md   # Blueprint técnico, fluxos e roadmap de provedores
│   ├── scripts/smoke-live.ts  # Verificação integrada ao vivo (Open-Meteo, INMET, CGE-SP)
│   └── src/                   # Código-fonte da aplicação
└── frontend/                  # SPA React 19 + Vite + Tailwind v4 + TanStack Query + Leaflet
    ├── AGENTS.md              # Diretrizes arquiteturais e gates do frontend
    ├── README.md              # Guia de execução e testes do frontend
    └── src/                   # Páginas, componentes, hooks, services e utilitários
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

> Consulte [`frontend/README.md`](./frontend/README.md) para detalhes das variáveis `VITE_API_BASE_URL` / `VITE_API_TIMEOUT_MS`, cenários de demonstração (`ENABLE_SIMULATION_PARAMS=true` no backend) e gates de qualidade do frontend.

### Variáveis de Ambiente (`backend/.env`)

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Ambiente (`development`, `test`, `production`) |
| `PORT` | `3333` | Porta HTTP do servidor |
| `HOST` | `0.0.0.0` | Endereço de escuta |
| `CORS_ORIGIN` | `*` | Origens permitidas no CORS (`*` ou lista separada por vírgula) |
| `RATE_LIMIT_MAX` | `120` | Limite de requisições por minuto |
| `ENABLE_SIMULATION_PARAMS` | `false` | Habilita `?cgeDate=` e `?simulate=` para demonstrações |
| `FORECAST_PROVIDER` | `open-meteo` | Provedor de previsão (`open-meteo`, `tomorrow-io`, `google-weather`) |
| `HTTP_TIMEOUT_MS` | `8000` | Timeout explícito das chamadas externas (ms) |
| `CACHE_TTL_FORECAST_SECONDS` | `900` | TTL do cache da previsão horária (s) |
| `CACHE_TTL_INMET_SECONDS` | `600` | TTL do cache dos avisos oficiais INMET (s) |
| `CACHE_TTL_CGE_SECONDS` | `300` | TTL do cache de alagamentos e estações CGE-SP (s) |

### Endpoints Principais (com `npm run dev`)

- Swagger UI: `http://localhost:3333/docs`
- Healthcheck: `GET http://localhost:3333/v1/health`
- Saúde das fontes externas: `GET http://localhost:3333/v1/sources/status`
- Catálogo de regiões: `GET http://localhost:3333/v1/regions`
- Panorama consolidado (JSON): `GET http://localhost:3333/v1/alerts/regions`
- Alerta por região (JSON): `GET http://localhost:3333/v1/alerts/regions/zona-oeste-butanta`
- Alerta por coordenada (JSON): `GET "http://localhost:3333/v1/alerts/by-coordinates?lat=-23.5317&lon=-46.7294"`
- Feed consolidado (RSS 2.0): `GET http://localhost:3333/v1/alerts/feed.xml`
- Feed por região (RSS 2.0): `GET http://localhost:3333/v1/alerts/regions/zona-oeste-butanta/feed.xml`
- Feed por coordenada (RSS 2.0): `GET "http://localhost:3333/v1/alerts/by-coordinates/feed.xml?lat=-22.9099&lon=-47.0626"`

---

## Comandos de Qualidade e Smoke Test Ao Vivo

```bash
cd backend
npm run typecheck   # Verificação estrita TypeScript (tsc --noEmit)
npm run test        # Suíte offline e determinística (Vitest)
npm run build       # Compilação de produção para backend/build/
npm run smoke:live       # Smoke test ao vivo contra Open-Meteo, INMET e CGE-SP
npm run validate:routes  # Validação E2E HTTP real de todos os 8 blocos do roteiro (aceita BASE_URL opcional)
```

---

## Documentação Adicional

- [Índice de Produto, Pesquisa e Escopo (`docs/README.md`)](./docs/README.md)
  - [Análise do Briefing e Viabilidade Técnica (`docs/01-analise-briefing-e-viabilidade.md`)](./docs/01-analise-briefing-e-viabilidade.md)
  - [Pesquisa de Stack e Fontes de Dados (`docs/02-pesquisa-stack-e-fontes-dados.md`)](./docs/02-pesquisa-stack-e-fontes-dados.md)
  - [Escopo da PoC — Player Criativo DOOH (`docs/03-escopo-poc-player-dooh.md`)](./docs/03-escopo-poc-player-dooh.md)
- [Diretrizes do Backend (`backend/AGENTS.md`)](./backend/AGENTS.md)
- [Diretrizes do Frontend (`frontend/AGENTS.md`)](./frontend/AGENTS.md)
- [Guia do Frontend (`frontend/README.md`)](./frontend/README.md)
- [Contrato da API (`backend/API.md`)](./backend/API.md)
- [Arquitetura da Plataforma (`backend/docs/architecture.md`)](./backend/docs/architecture.md)

---

## Fluxo de Trabalho Git

- A branch `main` mantém a base estável e validada pelos gates.
- Novas funcionalidades são desenvolvidas em feature branches (como `feat/poc-flood-alerts-api`) com commits atômicos no padrão Conventional Commits e revisão via Pull Request.
