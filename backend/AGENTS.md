# Diretrizes do Backend — OOH Alerta Alagamentos

Este arquivo rege a arquitetura, governança e convenções para o código sob `backend/`. Complementa as diretrizes globais da raiz ([`../AGENTS.md`](../AGENTS.md)) e o contrato em [`API.md`](./API.md).

---

## 1. Stack Tecnológica Core

- **Framework:** Fastify v5, Node.js (`>= 22`), TypeScript Strict (`strict: true`).
- **Validação de Schemas e OpenAPI:** Zod integrado via `fastify-type-provider-zod`, com Swagger UI automático em `/docs` (`@fastify/swagger` + `@fastify/swagger-ui`).
- **Logging e Erros:** Pino logger centralizado (`src/lib/logger.ts`) e exceções derivadas de `ApplicationError` (`src/utils/application-error.ts`).
- **Testes:** Vitest (`app.inject()` para integração HTTP e testes unitários colocados em `*.spec.ts`).

---

## 2. Arquitetura em 4 Camadas + Provedores Plugáveis

A implementação de regras de negócio e rotas segue estritamente o padrão desacoplado:

### 1. Routes (`src/routes/[dominio].ts`)
- Declaram endpoints sob o prefixo `/v1` e associam schemas Zod estritos (`params`, `query`, `body`, `response`) em `src/routes/schemas/`.
- Delegam a execução diretamente ao Controller correspondente.

### 2. Controllers (`src/controllers/[dominio]/[operacao]-controller.ts`)
- Camada fina focada no ciclo HTTP (`FastifyRequest` → Service → `FastifyReply`).
- Rotas JSON devolvem sempre o envelope canônico `ApiResponse<T>`.
- Rotas de feed DOOH (`.xml`) respondem `application/rss+xml; charset=utf-8` com RSS 2.0 válido.
- **Nunca** insira regras de negócio ou parsing de fontes externas no controller.

### 3. Services (`src/services/[dominio]/[operacao]-service.ts`)
- **Uma classe por operação de domínio** contendo o método público `execute()` (Single Responsibility Principle).
- Contêm regra de negócio pura (como motor de risco e geração de mensagens OOH) e lançam exceções especializadas (`ApplicationError`, `BadRequestError`, `NotFoundError`).
- Recebem `repositories` e `providers` injetados via construtor (Dependency Inversion).

### 4. Repositories (`src/repositories/`) e Providers (`src/providers/`)
- **`src/repositories/`**: contratos de acesso a localidades/pontos OOH (`[dominio]-repository.ts`) e implementações (`in-memory/` na PoC; prontos para receber `prisma-repositories/` ou importador de planilha OOH na Fase 2).
- **`src/providers/`**: interfaces de integração externa (`forecast-provider.ts`, `official-alerts-provider.ts`, `flooding-monitor-provider.ts`) e *adapters* plugáveis por fonte (`open-meteo/`, `inmet/`, `cge-sp/`, e futuros provedores pagos como `tomorrow-io/` ou `google-weather/`).
- **Nunca** acople regras de negócio ou controllers diretamente ao payload bruto de um provedor externo.

---

## 3. Contratos de Resposta, Cache e Logging

- **Envelope Padrão JSON (`ApiResponse<T>`):**
  ```typescript
  interface ApiResponse<T> {
    success: boolean;
    message: string | null;
    data: T | null;
  }
  ```
  - Sucesso: `{ success: true, message: null, data: { ... } }`
  - Erro tratado: `{ success: false, message: "Motivo amigável", data: null }`
- **Feeds XML / RSS 2.0:** endpoints terminados em `/feed.xml` entregam XML puro (`Content-Type: application/rss+xml; charset=utf-8`) para compatibilidade direta com players DOOH.
- **Resiliência e Cache:** integrações externas devem operar com timeout explícito, cache TTL e *stale fallback* (em caso de indisponibilidade temporária de órgão público, priorizar degradação graciosa em vez de derrubar a API).
- **Logging Centralizado:** utilize exclusivamente o `logger` (`pino`) de `src/lib/logger.ts`. **É proibido o uso de `console.log`**.

---

## 4. Diretrizes de Código TypeScript

- **`strict: true` + Tolerância Zero a `any`:** utilize `unknown` com type guards ou tipos inferidos via Zod.
- **`verbatimModuleSyntax: true` + `module: "nodenext"`:** use extensão `.js` nos imports relativos (`import { env } from './env.js'`) e `import type` para importações exclusivas de tipos.

---

## 5. Fluxo Canônico e Gates Obrigatórios

Ao adicionar um novo endpoint ou provedor na branch de feature:
1. Defina ou reutilize o contrato em `src/repositories/` ou `src/providers/`.
2. Implemente o `service` (`execute()`) com injeção de dependências + teste unitário (`*.spec.ts`).
3. Crie o `controller` fino e registre a `route` com schema Zod.
4. Adicione testes de integração com `app.inject()` em `src/app.spec.ts` (ou `*.spec.ts` dedicado) e atualize `API.md`.

Antes de concluir ou commitar, todos os 3 gates dentro de `backend/` devem passar:
1. `npm run typecheck`
2. `npm run test`
3. `npm run build`
