# OOH Alerta Alagamentos

Plataforma tecnológica para transformar telas digitais de mídia OOH (como relógios urbanos) em pontos dinâmicos de informação e alerta sobre chuvas intensas e riscos de alagamento.

- **Foco inicial da PoC:** Capital de São Paulo (`IBGE 3550308`), cruzando fontes públicas e previsão hiperlocal por região/coordenada.
- **Preparado para expansão:** arquitetura multi-município pronta para o Estado de São Paulo e para integração futura com provedores meteorológicos pagos (ex.: Tomorrow.io, Google Weather API) e com a planilha de pontos OOH (histórico de 5 anos).
- **Formatos de entrega previstos:** API REST (`JSON` no padrão `ApiResponse<T>`) e Feeds `XML / RSS 2.0` para consumo direto pelos players DOOH.

---

## Estrutura do Repositório

```text
ooh-alerta-alagamentos/
├── AGENTS.md                  # Diretrizes globais de governança e código
├── README.md                  # Visão geral do repositório
└── backend/                   # API Fastify v5 + TypeScript + Zod + Swagger + Vitest
    ├── AGENTS.md              # Diretrizes arquiteturais do backend
    ├── API.md                 # Contrato dos endpoints REST e RSS
    ├── docs/architecture.md   # Blueprint técnico, fluxos e roadmap de provedores
    └── src/                   # Código-fonte da aplicação
```

---

## Pré-requisitos

- **Node.js** `>= 22` (validado em `v24.22.3`)
- **npm** `>= 10`

---

## Como Rodar o Backend

Execute os comandos dentro da pasta `backend/`:

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Após iniciar:
- Healthcheck: `GET http://localhost:3333/v1/health`
- Documentação Swagger UI: `http://localhost:3333/docs`

### Comandos de Qualidade (Gates)

```bash
cd backend
npm run typecheck   # Verificação estrita TypeScript (tsc --noEmit)
npm run test        # Suíte de testes unitários e de integração (Vitest)
npm run build       # Compilação de produção para backend/build/
```

---

## Documentação Adicional

- [Diretrizes do Backend (`backend/AGENTS.md`)](./backend/AGENTS.md)
- [Contrato da API (`backend/API.md`)](./backend/API.md)
- [Arquitetura da Plataforma (`backend/docs/architecture.md`)](./backend/docs/architecture.md)

---

## Fluxo de Trabalho Git

- A branch `main` mantém a base estável e validada pelos gates.
- Novas funcionalidades (ex.: conectores meteorológicos, motor de risco e endpoints de alertas) são desenvolvidas em feature branches (como `feat/poc-flood-alerts-api`) com commits atômicos no padrão Conventional Commits e revisão via Pull Request.
