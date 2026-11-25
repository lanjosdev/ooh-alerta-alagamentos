# Documentação de Produto, Pesquisa e Escopo — OOH Alerta Alagamentos

Este diretório centraliza a documentação transversal do monorepo (produto, diagnóstico de viabilidade, pesquisa tecnológica/fontes de dados e especificações de escopo), complementando a documentação técnica específica de cada subaplicação.

---

## Índice

| Documento | Foco Principal |
| :--- | :--- |
| [01 — Análise do Briefing e Viabilidade Técnica](./01-analise-briefing-e-viabilidade.md) | Estudo da apresentação *Anti-Flood Ads* (Itaú Seguros / Africa Creative), matriz de alinhamento com a PoC atual, avaliação de viabilidade técnica (fontes, precisão de 30 min, hardware DOOH, rotas de fuga e WhatsApp) e checklist de validação. |
| [02 — Pesquisa de Stack e Fontes de Dados (Player DOOH)](./02-pesquisa-stack-e-fontes-dados.md) | Levantamento aprofundado em 5 camadas (mapa vetorial, geometria viária/topografia, dados em tempo real, renderização generativa e entrega DOOH), comparando recursos gratuitos e pagos (citados no PDF + extras) e definindo as stacks recomendadas para **PoC (custo zero)** vs. **Produção**. |
| [03 — Escopo da PoC: Player Criativo DOOH](./03-escopo-poc-player-dooh.md) | Mapeamento completo de requisitos da tela DOOH e decisões fechadas de escopo para a PoC (estrutura enxuta de 2 rotas: Painel Principal Unificado + Modo Player Limpo, identidade white-label PT-BR, formatos 9:16 e 16:9, MapLibre com 2 estilos + deck.gl, catálogo de 7 vias + seleção livre/Nominatim/Overpass/GeoSampa e contratos `/v1/player/*`). |

---

## Documentação Complementar no Repositório

- [Diretrizes Globais do Monorepo (`AGENTS.md`)](../AGENTS.md)
- [Visão Geral do Repositório (`README.md`)](../README.md)
- [Arquitetura do Backend (`backend/docs/architecture.md`)](../backend/docs/architecture.md)
- [Contrato da API REST e RSS 2.0 (`backend/API.md`)](../backend/API.md)
- [Guia do Frontend de Monitoramento (`frontend/README.md`)](../frontend/README.md)
