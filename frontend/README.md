# OOH Alerta Alagamentos — Frontend (Painel Unificado & Player DOOH)

Aplicação web SPA (React 19 + Vite 8 + TypeScript Strict + Tailwind CSS v4 + TanStack Query v5 + `MapLibre GL JS` + `deck.gl`) com estrutura enxuta em **2 rotas** para monitoramento operacional em São Paulo, simulação e replay histórico por data/hora, e geração vetorial animada da peça criativa DOOH (`9:16` e `16:9`).

---

## Rotas e Funcionalidades Implementadas

### 1. Painel Principal Unificado (`/`)
- **Cabeçalho Compacto de 1 Faixa (`TopControlBar`):**
  - **Seletor Temporal 3-em-1:**
    - `Tempo Real`: leitura ao vivo de Open-Meteo, INMET, CGE-SP e GeoSampa.
    - `Histórico`: popover com Data (`YYYY-MM-DD`) + Hora opcional (`HH:MM` ou *Pico automático*) e atalhos reais validados no CGE-SP (**`24/01/2025 • 20:30`** e **`16/01/2026 • 18:15`**).
    - `Simular`: menu (`Normal`, `Atenção`, `Alerta`, `Crítico`) habilitado automaticamente conforme `GET /v1/health` (`capabilities.simulation`).
  - **Saúde Consolidada das Fontes:** pill com popover detalhado (`Open-Meteo`, `Open-Meteo Histórico`, `INMET`, `CGE-SP`, `Overpass OSM`, `GeoSampa WFS`, `Nominatim`) exibindo status, latência, chaves em cache e `lastErrorMessage` quando degradado.
- **Mapa Explorador (`ExplorerMapPanel` — esquerda ~60–65%):**
  - `MapLibre GL JS` (`^5`) com estilo `OpenFreeMap positron`, controles de zoom (`NavigationControl` `+`/`-`) e botão `Centralizar SP`.
  - **Toggle discreto flutuante:** alterna entre **`Pontos OOH (7)`** (corredores curados com geometria OSM embarcada e ancorados nas pistas reais) e **`Regiões SP (12)`**.
  - **Interação de marcadores:** tooltip instantâneo no hover (`Popup` com nome, bairro/zona, severidade e score) + **micro-pill fixa** acima do pin selecionado + barra de rodapé (`CardFooter`) com **legenda de severidade com contagens dinâmicas**, símbolo de `Clique livre` e aviso `Limpar filtros` quando nenhum item corresponder aos filtros.
  - **Busca Nominatim no submit:** consulta `GET /v1/player/geocode?q=` apenas ao pressionar Enter ou clicar em `Buscar` (nunca em `onChange`).
  - **Clique livre no mapa** (via Overpass API + GeoSampa WFS) com captura instantânea do nome da via nos tiles vetoriais (`queryRenderedFeatures`) e filtros rápidos por `Zona` e `Em Alerta`.
- **Palco do Player DOOH (`PointInspectorStage` — direita ~35–40%, aberto por padrão):**
  - **Aba `Preview OOH`:** renderiza `PlayerCanvas` + `FloodGenerativeMap` (`MapLibre GL JS` P&B em **vias vazadas por traço arquitetônico** `casing + fill branco` com pontes separadas e rótulos viários acima do `@deck.gl/mapbox` `interleaved: true` via `beforeId: 'road-name-minor'`) + **pin contextual discreto** (`VOCÊ ESTÁ AQUI` nos 7 ativos OOH / `PONTO ALVO` no clique livre). Mantém o preview anterior visível durante trocas de ponto (`keepPreviousData` + pill `Atualizando cena da via...`), com piso de timeout de `22000 ms` em `/player/scene` e retry inteligente. Suporta:
    - **`9:16` Vertical** (inline) e **`16:9` Split Horizontal** (`38%` editorial / `62%` mapa generativo) em palco expandido modal (desmontando o inline para economizar contextos WebGL).
    - **Personalização White-label PT-BR:** nome da marca (`<= 40` chars), subtítulo/tag (`<= 30` chars) e cor de destaque `--player-accent` (`^[0-9a-fA-F]{6}$`).
    - Botões **`Copiar URL`** e **`Player Limpo`** apontando para a rota canônica.
  - **Aba `Clima & Risco`:** telemetria atual (CGE-SP / grade), previsão 2h/6h, alagamentos na zona e avisos INMET.
  - **Aba `Técnico`:** justificativas do motor, telemetria das **5 fontes** da cena e inspetor para **`REST JSON`**, **`XML / RSS 2.0`** (protegido em tempo real) e **`GeoJSON (Cena DOOH)`** (`/v1/player/scene`).

### 2. Modo Player Limpo (`/?mode=player&...` canônica | `/player?...` alias)
- Renderização em tela cheia (`9:16` ou `16:9`) sem cabeçalho, barra de filtros ou painel lateral, mantendo atribuição ODbL visível (`© OpenStreetMap • OpenFreeMap`).
- Dirigida 100% por parâmetros de URL:
  - Alvo: `asset=<id>` (ex.: `av-roberto-marinho`) ou `lat=<num>&lon=<num>`
  - Formato: `format=portrait|landscape`
  - Temporal/Simulação: `date=YYYY-MM-DD`, `time=HH:MM`, `cgeDate=DD/MM/AAAA`, `simulate=normal|attention|alert|critical`
  - White-label: `brand=<texto>`, `tag=<texto>`, `accent=<RRGGBB>`

---

## Rewrite SPA para o Alias `/player`

A rota **`/?mode=player&...` é a URL canônica** e funciona nativamente em qualquer servidor ou CDN estático sem configuração adicional. Para utilizar também o alias **`/player?...`** em produção, configure o rewrite SPA devolvendo `index.html`:

- **Vite (`npm run dev` / `npm run preview`):** suporta `/player` nativamente (SPA fallback padrão).
- **Nginx:**
  ```nginx
  location / {
    try_files $uri $uri/ /index.html;
  }
  ```
- **Vercel (`vercel.json`):**
  ```json
  {
    "rewrites": [{ "source": "/player", "destination": "/index.html" }]
  }
  ```
- **Netlify (`public/_redirects`):**
  ```text
  /player  /index.html  200
  ```

---

## Pré-requisitos e Variáveis de Ambiente

- **Node.js** `>= 22`
- **npm** `>= 10`
- Backend da API em execução (por padrão em `http://localhost:3333/v1`).

```bash
cd frontend
cp .env.example .env
```

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:3333/v1` | URL base da API (`/v1`) validada via Zod na inicialização |
| `VITE_API_TIMEOUT_MS` | `15000` | Timeout HTTP em milissegundos (`1000` a `120000`) |

> **Replay histórico vs Simulação:** o modo **Histórico** (`date`/`time`) funciona sempre em endpoints JSON. Para habilitar o menu **Simular** (`simulate=`), configure `ENABLE_SIMULATION_PARAMS=true` em `backend/.env` (refletido automaticamente via `GET /v1/health`).

---

## Executando Backend + Frontend em Desenvolvimento

Terminal 1 (`backend/`):
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Terminal 2 (`frontend/`):
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## Comandos de Qualidade (4 Gates Obrigatórios)

Execute todos os comandos dentro de `frontend/`:

```bash
cd frontend
npm run typecheck   # Verificação estrita TypeScript (tsc -b --noEmit)
npm run lint        # ESLint (no-explicit-any, react-hooks v7, sem fetch/axios fora de lib/services)
npm run test        # Suíte unitária e de integração (Vitest + Testing Library + mocks MapLibre/deck.gl)
npm run build       # Build de produção em frontend/dist/ (chunks separados para maplibre e deckgl)
npm run format      # Formatação com Prettier + prettier-plugin-tailwindcss
```

---

## Documentação Relacionada

- [Escopo da PoC — Player Criativo DOOH (`docs/03-escopo-poc-player-dooh.md`)](../docs/03-escopo-poc-player-dooh.md)
- [Diretrizes do Frontend (`frontend/AGENTS.md`)](./AGENTS.md)
- [Diretrizes Globais do Monorepo (`AGENTS.md`)](../AGENTS.md)
- [Contrato da API (`backend/API.md`)](../backend/API.md)
