# OOH Alerta Alagamentos — Frontend de Monitoramento

Aplicação web SPA (React 19 + Vite + TypeScript Strict + Tailwind CSS v4 + TanStack Query v5 + Leaflet) para visualização operacional das 12 regiões monitoradas na Capital de São Paulo, consulta hiperlocal por clique livre em qualquer coordenada geográfica e inspeção técnica em tempo real dos payloads `REST JSON` e `XML / RSS 2.0` consumidos por players DOOH.

---

## Funcionalidades Implementadas

- **Mapa Interativo de São Paulo (`Leaflet` + OpenStreetMap):**
  - Exibe marcadores das 12 regiões monitoradas coloridos por severidade (`Normal`, `Atenção`, `Alerta`, `Crítico`).
  - **Popup interativo ancorado ao pin:** ao clicar em um marcador, em um card de acesso rápido ou em qualquer ponto do mapa, exibe resumo imediato com severidade, score de risco (`X/100`), status do gatilho OOH (`ATIVO` vs `Campanha Padrão`), status de chuva atual (`Chovendo agora` / `Sem chuva no momento`), previsão 2h/6h, contagem CGE-SP/INMET e ação para focar o painel completo (atualiza em segundo plano no auto-refresh sem fechar ou mover a câmera).
  - **Clique livre no mapa:** consulta `GET /v1/alerts/by-coordinates?lat=&lon=` ao vivo, vinculando automaticamente à estação física do CGE-SP na Capital SP ou operando em modo multi-município (Open-Meteo + INMET) fora da Capital.
  - Botão flutuante **Centralizar em SP**, filtros por Zona e Severidade, e lista acessível de seleção rápida.
- **Barra de Cenários de Demonstração e Saúde das Fontes:**
  - Alterna entre `Tempo Real (Hoje)`, `Dia Chuvoso Real (CGE 15/01/2026)` e simulações (`Normal`, `Atenção`, `Alerta`, `Crítico`).
  - Exibe resumo de severidade, contagem de gatilhos OOH ativos e saúde das 3 fontes (`Open-Meteo`, `INMET`, `CGE-SP`) via `GET /v1/sources/status`.
- **Painel de Detalhes (`Clima & Risco` e `Técnico JSON / XML`):**
  - **Clima & Risco:** indicador em tempo quase real (`forecast.current`, 15 min) de chuva no momento, temperatura, umidade e precipitação tanto na Capital SP (combinado à estação CGE-SP) quanto em outros municípios (ex.: Campinas), além da previsão 2h/6h com linha do tempo horária, alagamentos na zona e avisos oficiais do INMET.
  - **Técnico (JSON / XML):** justificativas do motor de risco (`reasons[]`), telemetria de cache/status das fontes, visualizador de `REST JSON` e `XML / RSS 2.0` (`/feed.xml`) com URL copiável, abertura em nova aba e cópia do payload.

---

## Pré-requisitos e Variáveis de Ambiente

- **Node.js** `>= 22`
- **npm** `>= 10`
- Backend da API em execução (por padrão em `http://localhost:3333/v1`).

Copie o arquivo de exemplo antes de rodar em desenvolvimento:

```bash
cd frontend
cp .env.example .env
```

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:3333/v1` | URL base da API (`/v1`) validada via Zod na inicialização |
| `VITE_API_TIMEOUT_MS` | `15000` | Timeout HTTP em milissegundos (`1000` a `120000`) |

> **Dica para demonstrações com simulação:** para utilizar os botões `CGE 15/01/2026` e `Simular Normal/Atenção/Alerta/Crítico` contra o backend local, habilite `ENABLE_SIMULATION_PARAMS=true` em `backend/.env`.

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
npm run lint        # ESLint (inclui proibição de any e de fetch/axios fora de lib/services)
npm run test        # Suíte de testes unitários e de integração (Vitest + Testing Library)
npm run build       # Build de produção em frontend/dist/
npm run format      # Formatação com Prettier + prettier-plugin-tailwindcss
```

---

## Documentação Relacionada

- [Diretrizes do Frontend (`frontend/AGENTS.md`)](./AGENTS.md)
- [Diretrizes Globais do Monorepo (`AGENTS.md`)](../AGENTS.md)
- [Contrato da API (`backend/API.md`)](../backend/API.md)
