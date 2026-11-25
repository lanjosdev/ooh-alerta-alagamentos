# 03 — Escopo da PoC: Player Criativo DOOH (Opção 1 — Custo Zero)

Este documento registra os **requisitos mapeados da frente de Player Criativo DOOH** e as **decisões de escopo fechadas** para a implementação da PoC integrada ao monorepo `ooh-alerta-alagamentos` (reproduzindo fielmente o conceito visual e técnico dos Slides 7, 9, 10, 11 e 12).

---

## 1. Requisitos Funcionais e Visuais Mapeados

### 1.1 Anatomia do Template de Mídia
- **Cabeçalho editorial de alto contraste (fundo claro):**
  - Linha divisória superior com micro-rótulos configuráveis (ex.: marca à esquerda e rótulo da iniciativa à direita).
  - Headline principal em tipografia grande e negrito à esquerda.
  - Bloco de marca configurável à direita (`AVISO` + emblema/cor de destaque).
- **Faixa de contexto do ponto OOH:**
  - Nome da via / localização monitorada à esquerda (ex.: `Av. Jornalista Roberto Marinho`, `Marginal Pinheiros`).
  - Indicador dinâmico de severidade e janela temporal à direita (ex.: `Risco elevado em 30 min`, `Alagamento ativo na via`, `Sem risco no momento`).
- **Área principal — Mapa Vetorial + Mancha Generativa (~55–60% da peça):**
  - Mapa minimalista preto/branco (ruas em traço limpo escuro sobre fundo branco, sem ruído visual, mantendo rótulos legíveis das vias principais e rios).
  - Mancha de enchente azul luminosa **em movimento contínuo (*play/motion*)**, seguindo exatamente a geometria real dos trechos afetados (sem arte feita à mão por local).
- **Selo flutuante de telemetria (canto inferior direito do mapa):**
  - Card com crédito real das fontes ativas (`Dados CGE-SP / INMET / GeoSampa`), exibindo `- TEMPO REAL -` + pílula `ATUALIZADO AGORA` em operação ao vivo, `- REPLAY • DD/MM/AAAA HH:MM -` no modo de data/hora passada, ou `- SIMULAÇÃO -` quando `simulate=` estiver ativo.

### 1.2 Pipeline Generativo da Mancha (4 Etapas)
1. **Geometria Real:** vias obtidas do OpenStreetMap (`LineString`) cruzadas com zonas historicamente alagáveis / cota baixa (GeoSampa WFS).
2. **Marcação do Trecho pelo Dado:** motor de decisão combina alagamentos ativos/históricos do CGE-SP (*match* por via), interseção com manchas do GeoSampa e severidade meteorológica (`Open-Meteo` + `INMET`).
3. **Estilo Generativo Animado:** `MapLibre GL JS` + `deck.gl` (`@deck.gl/mapbox`) aplicando **buffer em múltiplas camadas + brilho ciano/azul + animação de fluxo/pulso contínuo**.
4. **Escala Automática:** qualquer ponto curado, endereço buscado ou coordenada clicada renderiza automaticamente a mancha no formato exato da via.

---

## 2. Decisões de Escopo Fechadas (ADR da PoC)

| Tema | Decisão Fechada | Justificativa / Detalhamento |
| :--- | :--- | :--- |
| **Estrutura & Rotas (`frontend/`)** | **Estrutura enxuta de 2 rotas:** **(1) Painel Principal Unificado (`/`)** e **(2) Modo Player Limpo (`/player?...` ou `/?mode=player&...`)** | Elimina duplicação entre "Monitoramento" e "Estúdio". O Painel Principal reformula a interface atual para uma tela única objetiva: **Mapa Explorador com busca/filtros à esquerda (~60–65%)** e **Preview ao vivo do Player DOOH aberto por padrão à direita (~35–40%)**, mantendo `Clima & Risco` e `Técnico (JSON / XML / GeoJSON)` como abas secundárias no mesmo painel direito. |
| **Interação Mapa ↔ Preview DOOH** | **Pins clicáveis das 7 vias OOH predefinidas + toggle discreto flutuante (`Pontos OOH (7)` / `Regiões SP (12)`) + clique livre + busca de endereço, sem chips inferiores** | O mapa esquerdo exibe os marcadores das 7 vias OOH simuladas com um **toggle discreto flutuante no mapa** para alternar entre `Pontos OOH (7)` e `Regiões SP (12)`, busca de endereço (Nominatim) e clique livre em qualquer rua; **não haverá chips de acesso rápido abaixo do mapa** para evitar poluição visual e maximizar a área útil do mapa. Ao selecionar qualquer ponto, o Preview DOOH à direita atualiza instantaneamente naquele momento. |
| **Filtro Temporal / Replay Histórico (Data + Hora)** | **Consulta por data e hora passadas reais (`date=YYYY-MM-DD` e `time=HH:MM` opcional) com reconstrução de janela CGE-SP + Open-Meteo Histórico** | Permite demonstrar e auditar qualquer dia chuvoso passado sem depender apenas do clima atual. O backend reconstrói quais pontos do **CGE-SP** estavam ativos naquele minuto a partir da janela `De HH:MM a HH:MM` / `Desde HH:MM` (ou consolidado/horário de pico do dia quando sem hora) e busca precipitação horária real via **Open-Meteo Histórico (`archive-api` / `past_days`)**; `INMET` e estações CGE são marcados como `skipped` no modo histórico. Consulta histórica real fica sempre habilitada, restringindo `ENABLE_SIMULATION_PARAMS` apenas ao `simulate=` artificial. |
| **Identidade Visual, Branding & Idioma** | **Layout fiel à estrutura do PDF, porém White-label configurável em PT-BR** | Sem logo Itaú hardcoded; marca genérica padrão (`Alerta OOH`) parametrizada por configuração (nome, subtítulo e cor de destaque ajustáveis em popover discreto no Preview), 100% em português, com o shell da aplicação em estética editorial limpa harmonizada ao mockup DOOH. |
| **Formatos de Tela (Responsividade)** | **Retrato `9:16` + Paisagem `16:9`** | `9:16` encaixa naturalmente no painel direito do Painel Principal; ao selecionar `16:9`, o Preview pode expandir em palco/modal confortável ou abrir direto no Modo Player Limpo (`?format=portrait\|landscape`). |
| **Motor Cartográfico & Dois Estilos Visuais** | **`MapLibre GL JS` + `OpenFreeMap` nos dois mapas + `deck.gl` (`@deck.gl/mapbox`) na mancha do Player** | Unifica o frontend em uma única engine vetorial de custo zero com **dois estilos distintos**: **(a) Esquerda (Explorador)** com estilo cartográfico padrão suave (diferenciação de tons para parques, rios, bairros e hierarquia viária, facilitando orientação em SP); **(b) Direita / Player Limpo** com *Style JSON* editorial **P&B minimalista** fiel ao mockup do PDF + camada animada da mancha azul em `deck.gl`. |
| **Pontos OOH & Geometria OSM** | **Híbrido: 7 pontos curados em SP (GeoJSON local) + Seleção Livre via Overpass API + Busca de Endereço (Nominatim)** | Garante demos instantâneas e 100% determinísticas nas vias icônicas do PDF, enquanto permite testar qualquer endereço ou clique livre no mapa com geometria real do OSM (protegida por cache TTL no backend). |
| **Camada de Suscetibilidade (GeoSampa)** | **Integrar GeoSampa WFS (`Mancha de Inundação` / ocorrências SP) com fallback gracioso** | Prioriza segmentos de vias situados em áreas historicamente alagáveis de SP sem derrubar a aplicação caso o GeoServer municipal oscile (cache TTL longo + degradação graciosa). |
| **Progressão Visual por Severidade (`0..3`)** | **4 estados visuais progressivos** | `NORMAL (0)`: mapa P&B limpo sem mancha (*"Via sem risco no momento • Monitoramento ativo"* + aviso no painel de que em produção exibiria campanha normal). `ATENÇÃO (1)` → `ALERTA (2)` → `CRÍTICO (3)`: escalam progressivamente espessura (buffer), brilho e velocidade da animação azul. |

---

## 3. Catálogo Inicial de Pontos OOH Simulados Curados (SP)

Como o inventário real de telas OOH ainda não está disponível nesta fase, a PoC utiliza um repositório de ativos simulados seguindo o mesmo contrato que receberá o inventário real (planilha/PostGIS) na Fase 2:

1. **Av. Jornalista Roberto Marinho** (Brooklin / Campo Belo — referência dos Slides 7, 9 e 10)
2. **Marginal Pinheiros** (Pinheiros / Cidade Jardim — referência do Slide 11)
3. **Av. Washington Luís — Aeroporto de Congonhas** (Campo Belo — referência dos Slides 8 e 14)
4. **Av. 23 de Maio / Viaduto Jaceguaí** (Centro / Bela Vista — referência do Slide 14)
5. **Marginal Tietê** (Lapa / Ponte das Bandeiras)
6. **Av. do Estado** (Ipiranga / Vila Prudente)
7. **Av. Radial Leste** (Mooca / Tatuapé)

Cada ativo curado mantém `id`, `name`, `corridorName`, `neighborhood`, `zone`, `latitude`, `longitude`, enquadramento de câmera (`center`, `zoom`, `bearing`) e **GeoJSON real da geometria viária (OSM) em cache local**.

---

## 4. Arquitetura Técnica Prevista para a PoC

### 4.1 Backend (`backend/`)
Seguindo estritamente as 4 camadas (`routes` → `controllers` → `services` → `repositories` / `providers`) definidas em [backend/AGENTS.md](../backend/AGENTS.md):

- **Novos Providers Plugáveis (`src/providers/`):**
  - `RoadGeometryProvider` → `OverpassRoadGeometryProvider` (extração de vias `motorway|trunk|primary|secondary|tertiary` via Overpass API com cache TTL + *stale fallback*).
  - `FloodSusceptibilityProvider` → `GeoSampaWfsProvider` (consulta WFS de manchas de inundação / ocorrências históricas da PMSP com cache TTL longo e degradação graciosa).
  - `GeocodingProvider` → `NominatimGeocodingProvider` (busca de endereço por texto em SP/Brasil via Nominatim/OSM respeitando `User-Agent` e cache TTL).
- **Novo Repository (`src/repositories/`):**
  - `OohAssetRepository` → `InMemoryOohAssetRepository` (catálogo dos 7 pontos OOH simulados curados + geometrias OSM locais; pronto para ser trocado por Prisma/PostGIS quando chegar o inventário real).
- **Novo Domínio de Serviços (`src/services/player/`):**
  - `ListPlayerAssetsService` — lista os ativos simulados curados.
  - `SearchAddressService` — executa geocodificação textual normalizada.
  - `GetPlayerSceneService` — orquestra `GetLocationAlertService` + geometria da via (preset ou Overpass) + manchas GeoSampa + *match* por nome de via no CGE-SP + cálculo espacial (`Turf.js`), devolvendo a cena completa pronta para o Player.
- **Novos Endpoints HTTP (`/v1/player/*`, validados com Zod + Swagger):**
  - `GET /v1/player/assets` — catálogo de pontos OOH simulados curados.
  - `GET /v1/player/geocode?q=` — busca de endereço/avenida por texto (Nominatim/OSM).
  - `GET /v1/player/scene` — retorna a cena completa do Player para `assetId` **ou** `lat` + `lon`, aceitando `date` (`YYYY-MM-DD`) e `time` (`HH:MM`, opcional) além de compatibilidade com `cgeDate` e `simulate`. Em consultas históricas (`date`/`time`), reconstrói os pontos ativos do CGE-SP pela janela horária (`De HH:MM a HH:MM` / `Desde HH:MM`, ou horário de pico do dia quando sem `time`) e consulta precipitação real no `OpenMeteoForecastProvider` (`archive-api.open-meteo.com/v1/archive` / `past_days`), marcando `INMET` e `Estação CGE` como `skipped`. O payload contém:
    - Decisão de risco consolidada (`severityLevel`, `severityLabel`, `triggerOverride`, `riskScore`, `simulated`);
    - Textos editoriais em PT-BR para o template (`headline`, `corridorName`, `riskWindowLabel`, `statusNote`, `sourceBadge`);
    - Câmera sugerida (`center`, `zoom`, `bearing`);
    - `FeatureCollection` GeoJSON dos trechos viários com propriedades de intensidade (`riskIntensity`, `matchedCge`, `inGeoSampaZone`, `streetName`, `isPrimaryCorridor`);
    - Telemetria de fontes (`forecast`, `officialAlerts`, `floodingMonitor`, `roadGeometry`, `floodSusceptibility`).

### 4.2 Frontend (`frontend/`)
Seguindo estritamente as 3 camadas (`services` → `hooks` → `components/pages`) e tokens semânticos de [frontend/AGENTS.md](../frontend/AGENTS.md), o frontend é organizado em **2 rotas/visões**:

1. **Painel Principal Unificado (`/` — reformulação objetiva do `MonitoringPage`):**
   - **Cabeçalho único compacto (1 faixa):** título da plataforma, seletor temporal com 3 modos claros (**`Tempo Real`**, **`Histórico`** via popover compacto com Data + Hora + atalhos de dias reais chuvosos, e **`Simular`** `Normal / Atenção / Alerta / Crítico`), badge consolidado de saúde das fontes (com detalhes no hover/popover) e botão de refresh.
   - **Coluna Esquerda (~60–65% — `ExplorerMapPanel` em `MapLibre GL JS` + `OpenFreeMap` estilo padrão suave):**
     - Barra integrada de **busca de endereço por texto (Nominatim/OSM)** + filtros rápidos (`Zona`, `Em Alerta`).
     - Mapa interativo amplo (sem chips inferiores redundantes) com diferenciação suave de tons (parques, rios, bairros, hierarquia viária), **controle discreto flutuante no canto superior do mapa** para alternar camadas (`Pontos OOH (7)` padrão / `Regiões SP (12)`), exibindo os **pins clicáveis das 7 vias OOH predefinidas** (coloridos por severidade) + suporte a **clique livre em qualquer rua**.
   - **Coluna Direita (~35–40% — `PointInspectorStage`, aberto por padrão):**
     - **Aba `Preview OOH` (padrão na abertura):** renderiza o `PlayerCanvas` (`FloodGenerativeMap` com `MapLibre GL JS` estilo **P&B minimalista** + `deck.gl` `@deck.gl/mapbox` `PathLayer`/shader animado) reagindo instantaneamente ao ponto selecionado no mapa esquerdo; inclui controles compactos de formato (`9:16` inline / `16:9` em palco expandido), popover de personalização **white-label** (nome da marca + cor de destaque) e botão **"Abrir / Copiar URL do Player Limpo"**.
     - **Aba `Clima & Risco`:** reaproveita `ClimateRiskTab` (chuva atual, previsão 2h/6h, CGE-SP e INMET).
     - **Aba `Técnico (JSON / XML / GeoJSON)`:** reaproveita `TechnicalInspectorTab` acrescido da inspeção do payload GeoJSON da cena DOOH.

2. **Modo Player Limpo (`/player?...` ou `/?mode=player&...` — `CleanPlayerView`):**
   - Renderização 100% em tela cheia da peça DOOH (`9:16` ou `16:9`), sem cabeçalho, filtros ou painel lateral, dirigida integralmente por parâmetros de URL (`asset`, `lat`, `lon`, `format`, `date`, `time`, `cgeDate`, `simulate`, `brand`, `accent`).

---

## 5. Fora de Escopo desta Fase (Explicitamente Registrado)

Os itens abaixo ficam planejados para fases futuras e **não entram nesta PoC**:

- QR Code dinâmico na peça DOOH (Slide 13).
- WebApp mobile do cidadão, integração Google Maps Routes / rotas de fuga e alertas no WhatsApp (Slides 6 e 14).
- Banco PostgreSQL + PostGIS (substituído por GeoJSON local + Overpass/GeoSampa WFS com cache na PoC, preservando o contrato de repositório/serviço para migração sem retrabalho).
- APIs pagas (Tomorrow.io, Mapbox, Google Weather/Maps) e serviço de exportação MP4 server-side (`Playwright + FFmpeg`).

---

## 6. Critérios de Aceite da PoC

- [ ] No Painel Principal (`/`), o mapa explorador à esquerda (MapLibre estilo padrão suave) mantém visualização ampla (sem chips inferiores redundantes), oferece **toggle discreto flutuante no mapa** (`Pontos OOH (7)` / `Regiões SP (12)`), exibe os 7 pins das vias OOH predefinidas e, ao clicar em qualquer pin, atualiza imediatamente o Preview DOOH à direita com o mapa vetorial P&B minimalista e a mancha azul luminosa animada sobre a geometria real da via.
- [ ] Seleção livre por busca de endereço (Nominatim) ou clique em qualquer rua do mapa carrega geometrias reais via Overpass API e aplica automaticamente o mesmo estilo generativo no Preview DOOH.
- [ ] As abas secundárias (`Clima & Risco` e `Técnico JSON / XML / GeoJSON`) no painel direito continuam funcionando integralmente para o ponto selecionado.
- [ ] Alternância entre `Tempo Real`, **Replay Histórico por Data/Hora passada** (reconstrução da janela CGE-SP + chuva histórica Open-Meteo + selo `REPLAY`) e `Simular` (`Normal/Atenção/Alerta/Crítico`) atualiza progressivamente a mancha, textos e selo de dados sem recarregar a página.
- [ ] Alternância entre formatos `9:16` e `16:9` e abertura do **Modo Player Limpo** (2ª rota, tela cheia via URL) funcionam sem cortes ou overflow.
- [ ] Customização white-label (nome da marca e cor de destaque) reflete imediatamente na peça e na URL do Player Limpo.
- [ ] Todos os gates obrigatórios passam com código de saída `0`:
  - `backend/`: `npm run typecheck`, `npm run test`, `npm run build`
  - `frontend/`: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
