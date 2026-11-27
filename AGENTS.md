# Diretrizes Gerais do Monorepo — OOH Alerta Alagamentos

Este arquivo é a **Fonte Única da Verdade Global** com as diretrizes de governança, organização e padrões de desenvolvimento deste repositório. Todo agente de IA ou desenvolvedor deve aderir estritamente a estas regras.

---

## 1. Estrutura do Workspace e Escopo de Regras

O repositório é organizado em subaplicações com regras contextuais hierárquicas e documentação transversal:
- **`docs/`**: documentação transversal de produto, análise de viabilidade, pesquisa tecnológica/fontes e especificações de escopo (índice em [`docs/README.md`](./docs/README.md); escopo vigente do Player Criativo DOOH em [`docs/03-escopo-poc-player-dooh.md`](./docs/03-escopo-poc-player-dooh.md); roadmap, backlog consolidado, decisões pendentes e investigações em [`docs/10-roadmap-e-backlog.md`](./docs/10-roadmap-e-backlog.md)).
- **`backend/`**: API Fastify v5 + TypeScript Strict + Zod para coleta, normalização, cruzamento de risco e distribuição de alertas de alagamento (JSON e XML/RSS 2.0) para mídia DOOH. Possui regras próprias em [`backend/AGENTS.md`](./backend/AGENTS.md).
- **`frontend/`**: SPA React 19 + Vite + TypeScript Strict + Tailwind CSS v4 + TanStack Query v5 + `MapLibre GL JS` + `deck.gl` (`@deck.gl/mapbox`) para Painel Principal Unificado (`/`), Player Criativo DOOH (`/?mode=player` / `/player`) e inspeção técnica `JSON / XML RSS 2.0 / GeoJSON`. Possui regras próprias em [`frontend/AGENTS.md`](./frontend/AGENTS.md).

> As regras de diretório são cumulativas. Ao trabalhar em `backend/` ou `frontend/`, as regras do respectivo `AGENTS.md` complementam estas diretrizes globais e têm precedência em caso de especificidade da stack. Antes de planejar ou implementar funcionalidades da frente Player Criativo DOOH ou alterações de escopo/fontes de dados, consulte [`docs/10-roadmap-e-backlog.md`](./docs/10-roadmap-e-backlog.md) (ponto de entrada: status, dependências, decisões e investigações de cada item), os documentos de origem que ele referencia (`docs/03` a `docs/09`) e [`docs/README.md`](./docs/README.md). Ao concluir um item, decisão ou investigação, atualize o `docs/10` e o documento de origem.

---

## 2. Governança de Ações e Permissões do Agente

### Modo Consultivo (Perguntas, Dúvidas, Diagnósticos e Análises)
- **Gatilho:** Sempre que a solicitação for uma dúvida conceitual, pedido de explicação, diagnóstico de erro ou análise arquitetural sem um comando imperativo de implementação.
- **Proibições Estritas:**
  - Não criar, editar ou excluir arquivos da codebase (`backend/`, documentações, configs) sem solicitação explícita.
  - Não executar comandos que causem alterações persistentes no sistema operacional do usuário.
- **Ações Permitidas:** Leitura, busca de arquivos e execução de comandos estritamente de inspeção/leitura.

### Modo Executivo (Implementações, Refatorações e Correções)
- **Gatilho:** O agente só deve alterar arquivos ou executar comandos de modificação após receber instrução explícita do usuário.

---

## 3. Diretrizes Globais de Código

- **TypeScript Strict:** `strict: true` ativado em todas as aplicações.
  - **Tolerância Zero a `any`:** É proibido o uso de `any` ou asserções como `as any`. Utilize `unknown` com type guards ou tipos inferidos via Zod (`z.infer<typeof schema>`).
- **Nomenclatura Padrão:**
  - Classes, Types e Interfaces: `PascalCase`
  - Funções, Utilitários, Services, Controllers e Rotas: `camelCase`
  - Constantes Globais e Variáveis de Ambiente: `SCREAMING_SNAKE_CASE`
  - Arquivos e diretórios: `kebab-case.ts`
- **Execução de Comandos:**
  - Nunca execute comandos de build, typecheck ou teste na raiz do monorepo sem especificar o diretório de trabalho. Execute comandos Node/npm sempre dentro de `backend/` ou `frontend/`.
- **Workflow Git e Commits:**
  - Trabalhe em branches de feature (ex.: `feat/poc-flood-alerts-api`, `feat/monitoring-map-frontend`) a partir de `main`, abrindo PRs para revisão.
  - Faça **commits atômicos** seguindo rigorosamente **Conventional Commits** com escopos claros:
    - `chore(repo): ...`
    - `chore(backend): ...` / `chore(frontend): ...`
    - `feat(backend): ...` / `feat(providers): ...` / `feat(alerts): ...` / `feat(frontend): ...`
    - `fix(backend): ...` / `fix(frontend): ...`
    - `test(frontend): ...`
    - `docs(repo): ...` / `docs(backend): ...` / `docs(frontend): ...`
- **Manutenção Documental e Mudanças de Escopo:**
  - **Modo Executivo:** sempre que uma entrega alterar escopo, stack, contratos de API, provedores ou decisões arquiteturais, atualize os documentos impactados (`docs/`, `backend/API.md`, `backend/docs/architecture.md`, `README.md` e os `AGENTS.md` quando a stack mudar) antes de encerrar a tarefa.
  - **Modo Consultivo:** ao fechar uma mudança de escopo ou nova decisão em conversa, respeite a proibição de edição silenciosa e proponha explicitamente a atualização do documento correspondente em `docs/` antes de iniciar a implementação.
  - **Novos Escopos / Fases:** registre novos escopos seguindo o padrão sequencial `docs/NN-<tema-em-kebab-case>.md` (ex.: `04-...`) e atualize o índice em [`docs/README.md`](./docs/README.md) (e o `README.md` da raiz quando aplicável).
- **Gated Workflow (Qualidade Obrigatória):**
  - Toda tarefa concluída em `backend/` deve passar pelos 3 gates antes de ser considerada finalizada:
    1. `npm run typecheck`
    2. `npm run test`
    3. `npm run build`
  - Toda tarefa concluída em `frontend/` deve passar pelos 4 gates antes de ser considerada finalizada:
    1. `npm run typecheck`
    2. `npm run lint`
    3. `npm run test`
    4. `npm run build`
