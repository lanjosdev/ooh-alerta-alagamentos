# Diretrizes do Frontend — OOH Alerta Alagamentos

Este arquivo rege a arquitetura, governança e convenções para o código sob `frontend/`. Complementa as diretrizes globais da raiz ([`../AGENTS.md`](../AGENTS.md)), consome o contrato REST/RSS/GeoJSON documentado em [`../backend/API.md`](../backend/API.md) e segue, para o Painel Principal Unificado e o Player Criativo DOOH, o escopo em [`../docs/03-escopo-poc-player-dooh.md`](../docs/03-escopo-poc-player-dooh.md).

---

## 1. Stack Tecnológica Core

- **Framework e Build:** React 19, Vite 8, TypeScript Strict (`strict: true`), path alias `@/*` → `./src/*`.
- **Estilização e Tokens:** Tailwind CSS v4 (`@tailwindcss/vite`) com tokens semânticos OKLCH em `src/index.css`, `@fontsource-variable/inter`, `clsx`, `tailwind-merge` (`cn()`) e `class-variance-authority` (`cva`).
- **Dados e Rede:** TanStack Query v5 (`@tanstack/react-query`) + Axios + Zod (`src/env.ts` com `<EnvErrorView />`).
- **Mapas, WebGL, Feedback e Datas:** `maplibre-gl` (`^5`) + `OpenFreeMap` (`positron` no Mapa Explorador; Style JSON editorial P&B em `planet` + glyphs no Player DOOH), `deck.gl` (`@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox` `interleaved: true`, `@deck.gl/extensions`), `lucide-react`, `sonner` e `date-fns` (`ptBR`).
- **Qualidade e Testes:** ESLint (`eslint-plugin-react-hooks` v7), Prettier (`prettier-plugin-tailwindcss`), Vitest (`jsdom`) e Testing Library (mocks MapLibre/deck.gl em `src/test/mocks/maplibre.ts`).

---

## 2. Arquitetura em 3 Camadas Obrigatória

1. **Services (`src/services/` + `src/lib/api.ts`)**
   - Objetos congelados (`Object.freeze`) que encapsulam todas as chamadas HTTP usando a instância Axios configurada em `src/lib/api.ts` e `unwrapApiResponse<T>()`.
   - Erros HTTP são normalizados via `toApiError()` (`src/lib/api-error.ts`).
2. **Hooks (`src/features/[feature]/hooks/`)**
   - Encapsulam `useQuery` com **Query Key Factories** tipadas (ex.: `monitoringKeys`, `playerKeys`).
   - Consultas em modo histórico (`date` ou `cgeDate`) usam `staleTime: Infinity` e `refetchInterval: false`.
3. **Components & Pages (`src/components/`, `src/features/[feature]/components/`, `src/pages/`)**
   - **É proibido** importar `axios` ou invocar `fetch()` diretamente fora de `src/lib/` e `src/services/` (regra aplicada pelo ESLint).
   - **Roteamento enxuto:** sem router externo; `resolveAppRoute(window.location)` despacha entre `/` (Painel Principal Unificado) e `/?mode=player` (rota canônica) / `/player` (alias SPA via `React.lazy`).

---

## 3. Regras de UI, Tokens, WebGL e Datas

- **Tokens Antes de Valor Literal:** é proibido usar cores hexadecimais inline (`#...`) ou paletas cruas do Tailwind (`bg-red-500`, `text-slate-700`) em arquivos JSX/TSX. Utilize exclusivamente os tokens semânticos definidos em `src/index.css` (`bg-background`, `text-foreground`, `bg-severity-critical-bg`, `bg-player-paper`, etc.).
  - **Exceção restrita:** constantes RGBA numéricas para camadas `deck.gl`, o Style JSON editorial P&B do MapLibre e os presets/helper de `--player-accent` (`^[0-9a-fA-F]{6}$`) podem residir exclusivamente em `src/features/player/styles/*.ts`.
- **Ciclo WebGL e `eslint-plugin-react-hooks` v7:**
  - Instâncias de `Map` / `Marker` (`maplibre-gl`), `MapboxOverlay`, `ResizeObserver` e identificadores `requestAnimationFrame` devem residir exclusivamente em `useRef` dentro de `useEffect`, com cleanup rigoroso no `return` (`cancelAnimationFrame`, `removeControl`, `overlay.finalize()`, `map.remove()`).
  - Nunca leia ou escreva `ref.current` durante o render e nunca chame `setState` dentro do loop `rAF` ou sincronamente dentro de `useEffect`.
  - Ao abrir o palco expandido `16:9`, desmonte o `<PlayerCanvas format="portrait" />` inline para preservar contextos WebGL.
- **Atribuição ODbL:** mantenha `© OpenStreetMap • OpenFreeMap` visível tanto no Mapa Explorador quanto no Modo Player Limpo.
- **Early Returns Obrigatórios:** todo bloco consumidor de dados assíncronos trata explicitamente Loading (`<Skeleton />`), Error (`<QueryErrorAlert />` com *retry*) e Empty (`<EmptyState />`) antes do render principal.
- **Datas com `date-fns` (`pt-BR`):** é proibido usar `new Date().toLocaleDateString()`, `toLocaleTimeString()` ou `toLocaleString()`. Utilize os helpers de `src/features/monitoring/utils/formatters.ts`.

---

## 4. Diretrizes TypeScript e Qualidade

- **`strict: true` + Tolerância Zero a `any`:** `@typescript-eslint/no-explicit-any: error`. Utilize `unknown` com type guards ou tipos estritos em `src/types/`.
- **Validação de Ambiente:** variáveis `VITE_*` devem ser validadas via Zod em `src/env.ts` sem lançar exceção no import do módulo, permitindo renderizar `<EnvErrorView />`.

---

## 5. Gated Workflow Obrigatório (4 Gates)

Antes de concluir ou commitar qualquer entrega em `frontend/`, execute dentro de `frontend/` e garanta código de saída `0` para os 4 comandos:

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
