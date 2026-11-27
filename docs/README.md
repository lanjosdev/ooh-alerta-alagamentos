# Documentação de Produto, Pesquisa e Escopo — OOH Alerta Alagamentos

Este diretório centraliza a documentação transversal do monorepo (produto, diagnóstico de viabilidade, pesquisa tecnológica/fontes de dados e especificações de escopo), complementando a documentação técnica específica de cada subaplicação.

---

## Índice

| Documento | Foco Principal |
| :--- | :--- |
| [01 — Análise do Briefing e Viabilidade Técnica](./01-analise-briefing-e-viabilidade.md) | Estudo da apresentação *Anti-Flood Ads* (Itaú Seguros / Africa Creative), matriz de alinhamento com a PoC atual, avaliação de viabilidade técnica (fontes, precisão de 30 min, hardware DOOH, rotas de fuga e WhatsApp) e checklist de validação. |
| [02 — Pesquisa de Stack e Fontes de Dados (Player DOOH)](./02-pesquisa-stack-e-fontes-dados.md) | Levantamento aprofundado em 5 camadas (mapa vetorial, geometria viária/topografia, dados em tempo real, renderização generativa e entrega DOOH), comparando recursos gratuitos e pagos (citados no PDF + extras) e definindo as stacks recomendadas para **PoC (custo zero)** vs. **Produção**. |
| [03 — Escopo da PoC: Player Criativo DOOH](./03-escopo-poc-player-dooh.md) | Mapeamento completo de requisitos da tela DOOH e decisões fechadas de escopo para a PoC (estrutura enxuta de 2 rotas: Painel Principal Unificado + Modo Player Limpo, identidade white-label PT-BR, formatos 9:16 e 16:9, MapLibre com 2 estilos + deck.gl, catálogo de 7 vias + seleção livre/Nominatim/Overpass/GeoSampa e contratos `/v1/player/*`). |
| [04 — Escopo: Alertas de Vias Vizinhas no Player DOOH](./04-escopo-alertas-vias-vizinhas.md) | **Proposto.** Diagnóstico das deficiências da codebase para alertar sobre vias vizinhas ao ponto OOH com a mesma importância da via alvo (proximidade, risco por via, editorial e visual, incluindo a linguagem visual em dois eixos: risco presumido × ocorrência real e o grau de cada um), requisitos propostos, decisões em aberto e critérios de aceite. |
| [05 — Avaliação: Detecção de Ocorrências em Tempo Real e Fontes Complementares](./05-avaliacao-fontes-tempo-real.md) | **Avaliação.** Limitação do CGE-SP como detector ao vivo (registro manual atrasado), ativos subaproveitados (estações e histórico CGE, pontos crônicos), fontes externas que faltam (Waze, TomTom/HERE, radar, estado de atenção CGE), arquitetura de fusão em 3 camadas de evidência (risco → provável → confirmado) e próximos passos. |
| [06 — Decisão: Horizonte de Risco em Horas e Critérios Antialarmismo](./06-criterios-horizonte-e-antialarmismo.md) | **Decisão fechada.** Descarta o "risco em 30 min" do briefing em favor de risco em escala de horas (1–6 h); registra as fontes atuais de alerta antecipado ou infundado (ex.: avisos INMET futuros e não relacionados a chuva) e os critérios antialarmismo C1–C8 (vigência, pertinência, corroboração, proximidade, linguagem proporcional, estabilidade e transparência). |
| [07 — Avaliação: Papel do GeoSampa (Suscetibilidade) na Inteligência de Risco](./07-avaliacao-geosampa-suscetibilidade.md) | **Avaliação.** Como o GeoSampa é usado hoje (só bônus de intensidade e filtro de vizinhas no Player, sem influenciar a severidade), deficiências G1–G9 (subaproveitado e mal usado como gatilho de mancha) e papel proposto: "onde" alaga combinado com "quando" (chuva), recorte do trecho baixo, ranking de vizinhas e snapshot estático. |
| [08 — Escopo: Base Histórica de Alagamentos e Camada no Mapa Explorador](./08-escopo-base-historica-alagamentos.md) | **Proposto.** Base histórica por via (CGE-SP 5 anos + ocorrências georreferenciadas da Defesa Civil no GeoSampa + manchas 5/25/100), localização das ocorrências, armazenamento sem banco, camada discreta no Explorador com filtro acumulado (6m–5a), ressalvas, esforço e critérios de aceite. |
| [09 — Escopo: Cadastro e Importação dos Pontos OOH da Campanha](./09-escopo-cadastro-pontos-ooh.md) | **Proposto (cadastro decidido).** O que pedir à exibidora (planilha simples com 4 colunas obrigatórias + conversa técnica única), processo de importação em 9 etapas até o nível do catálogo curado, paridade com o clique livre (diagnóstico da diferença atual) e geração de imagem/vídeo no servidor como evolução futura. |
| [10 — Roadmap e Backlog Consolidado](./10-roadmap-e-backlog.md) | **Documento vivo — ponto de entrada para planos de implementação.** Backlog deduplicado dos docs 04–09 em fases (B-01…B-34), status e dependências de cada item, mapa de equivalência entre identificadores, suposições explícitas, decisões pendentes (cliente/negócio × equipe) e investigações de validação. |

---

## Documentação Complementar no Repositório

- [Diretrizes Globais do Monorepo (`AGENTS.md`)](../AGENTS.md)
- [Visão Geral do Repositório (`README.md`)](../README.md)
- [Arquitetura do Backend (`backend/docs/architecture.md`)](../backend/docs/architecture.md)
- [Contrato da API REST e RSS 2.0 (`backend/API.md`)](../backend/API.md)
- [Guia do Frontend de Monitoramento (`frontend/README.md`)](../frontend/README.md)
