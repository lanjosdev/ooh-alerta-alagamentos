# 04 — Escopo: Alertas de Vias Vizinhas no Player DOOH

> **Status:** Proposto — diagnóstico registrado, decisões de implementação em aberto (seção 4).
> **Base:** codebase após a PoC do Player Criativo DOOH ([03 — Escopo da PoC](./03-escopo-poc-player-dooh.md)).

Este documento registra a mudança de foco do Player DOOH: a peça de um ponto OOH **não deve alertar apenas sobre a via alvo**, mas exibir **com a mesma importância** os alertas e ocorrências das **vias vizinhas (arredores)**. O objetivo é preventivo: o motorista que passa pela tela precisa saber **quais vias próximas evitar**. Se apenas a via alvo for destacada e ela já estiver inundada, o aviso chega tarde demais para mudar a rota.

---

## 1. Objetivo

- Tratar o ponto OOH como **centro de uma área de decisão de rota**, não como monitor de uma única via.
- Dar às vias vizinhas afetadas **o mesmo peso visual e editorial** da via alvo.
- Diferenciar com clareza **ocorrência confirmada** (CGE-SP) de **risco presumido** (meteorologia + suscetibilidade histórica).
- Orientar o desvio: indicar **quais vias evitar** e, quando houver dado, **em qual sentido**.

---

## 2. Diagnóstico da Codebase Atual

O pipeline atual (`GetPlayerSceneService` → `EvaluateRiskService` → `matchRoadRisk` → `buildPlayerEditorial` → `FloodGenerativeMap`) foi desenhado em torno da via alvo. As vias vizinhas só aparecem por efeito colateral.

### 2.1 Dados — os arredores mal são enxergados

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| D1 | **A vizinhança é pequena.** No clique livre, o Overpass consulta `300 m`. O raio de `450 m` só é usado no fallback, quando a primeira consulta não retorna nada. Isso cobre pouco mais que o cruzamento. | `backend/src/providers/overpass/overpass-road-geometry-provider.ts` |
| D2 | **Os snapshots curados têm poucas vizinhas.** Cada um dos 7 ativos traz só 2 a 5 nomes de via, colados ao corredor. Uma ocorrência numa via próxima fora do snapshot não tem geometria onde ser desenhada. | `backend/src/repositories/in-memory/curated-ooh-geometries.ts` |
| D3 | **O CGE-SP não tem coordenada.** O `FloodingPoint` traz só `zone`, `neighborhood`, `street`, `reference` e `direction`. A ligação com o mapa depende apenas do nome da via, e `reference`/`direction` são ignorados. | `backend/src/providers/flooding-monitor-provider.ts` |
| D4 | **A vizinhança é definida pela zona CGE, não pela distância.** As zonas são macrorregiões (Sul, Oeste, Centro…). Ocorrências distantes na mesma zona elevam a severidade, enquanto vias vizinhas de **outra zona** são descartadas (caso comum em limites, como as marginais). | `backend/src/services/alerts/get-location-alert-service.ts` (`pointsInZone`) |
| D5 | **Um clique sem estação CGE próxima perde o CGE.** Nesse caso `zone: null`, então `pointsInZone = []`. | `get-location-alert-service.ts` (`resolveLocation`) |
| D6 | **O filtro de tipo de via esconde ruas.** A consulta primária só aceita `motorway` até `tertiary`. Ruas `residential`/`unclassified`, que alagam com frequência e servem de rota de fuga, só entram no fallback. | `overpass-road-geometry-provider.ts` (`PRIMARY_HIGHWAY_REGEX`) |

### 2.2 Decisão — severidade única, centrada no alvo

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| D7 | **Existe um só `severityLevel` para a cena.** Não há risco por via, então não dá para expressar "alvo OK, vizinha X intransitável". | `backend/src/services/alerts/evaluate-risk-service.ts` |
| D8 | **A via alvo é pintada por presunção.** Com severidade `>= 1`, o `isPrimaryCorridor` sempre recebe mancha, mesmo sem evidência. Quando a ocorrência real está na vizinha, o alvo aparece inundado e a mensagem fica invertida. | `backend/src/services/player/match-road-risk.ts` (`calculateRiskIntensity`) |
| D9 | **Não há hierarquia entre evidência e presunção.** O alvo sem evidência recebe a base `0,3–0,8`. Uma vizinha com CGE confirmado recebe a mesma base `+0,25`. Visualmente as duas ficam quase iguais. | `match-road-risk.ts` |
| D10 | **A suscetibilidade do GeoSampa pesa como alagamento.** Com qualquer alerta meteorológico (nível 1 ou mais), toda via em área alagável histórica ganha mancha, o que dilui o sinal das ocorrências reais. | `match-road-risk.ts` |
| D11 | **A via inteira é pintada.** O match por nome acende todos os segmentos homônimos dentro do raio, não o trecho da ocorrência (referência e sentido). | `match-road-risk.ts` (`streetsMatch`) |

### 2.3 Editorial — o texto só fala da via alvo

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| D12 | **Os textos não citam as vias afetadas.** `headline`, `riskWindowLabel` e `statusNote` nunca nomeiam as vias. "ALAGAMENTO INTRANSITÁVEL NA VIA" é exibido mesmo quando o ponto intransitável está em outra via da zona. | `backend/src/services/player/build-player-editorial.ts` |
| D13 | **"Via sem risco" pode aparecer com vizinha afetada.** O estado `NORMAL` é decidido pela severidade, não pelo estado das vizinhas. | `build-player-editorial.ts` |
| D14 | **Não há orientação de desvio.** Falta um texto como "Evite a Av. X sentido Centro". O campo `direction` do CGE não é aproveitado. | `build-player-editorial.ts` |

### 2.4 Visual — as vizinhas são anônimas

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| D15 | **A mancha não diferencia tipos de via.** O frontend recebe `matchedCge`, `matchedCgeImpassable` e `isPrimaryCorridor`, mas usa só `riskIntensity`. Não há rótulo, ícone de intransitável nem cor distinta para ocorrência confirmada. | `frontend/src/features/player/components/FloodGenerativeMap.tsx`, `frontend/src/types/player.ts` |
| D16 | **Ocorrências fora do quadro somem.** A câmera dos ativos curados é fixa e não existe indicador como "+2 alagamentos a 800 m ao norte". | `get-player-scene-service.ts` (câmera), `FloodGenerativeMap.tsx` |
| D17 | **Uma severidade alta pode aparecer sem mancha.** Se a ocorrência que elevou o nível estiver numa via fora da geometria carregada, a peça mostra "CRÍTICO" sem mancha, ou só com a mancha presumida no alvo. | Combinação de D2, D4 e D8 |

### 2.5 Linguagem visual — risco × ocorrência real

Hoje a mancha **não diferencia** alerta de risco (presumido) de ocorrência real (confirmada pelo CGE-SP), nem por cor nem pelo grau de intensidade de cada tipo.

**Como a mancha é desenhada hoje:**
- **Paleta fixa e única:** toda mancha usa os mesmos três tons azul/ciano, em camadas de halo, corpo e núcleo (`FLOOD_COLOR_OUTER_GLOW`, `FLOOD_COLOR_MID_BODY`, `FLOOD_COLOR_CORE_CYAN` em `frontend/src/features/player/styles/mapStyles.ts`). Nenhum tom depende do tipo de dado, e a cor de destaque white-label também não afeta a mancha.
- **Dois controles de intensidade:**
  1. **Severidade da cena (`0–3`)**, aplicada igualmente a todas as vias via `SEVERITY_VISUAL_PROFILES` (multiplicador de largura, opacidade do brilho, velocidade do fluxo e força do pulso).
  2. **`riskIntensity` por via (`0–1`)**, que aumenta largura e opacidade de cada trecho em `buildFloodLayers` (`frontend/src/features/player/components/FloodGenerativeMap.tsx`).
- `matchedCge`, `matchedCgeImpassable` e `inGeoSampaZone` chegam ao frontend, mas **não são lidos na renderização**. Só servem para compor o `riskIntensity` no backend. O Player também não tem legenda.

**Intensidade resultante (`calculateRiskIntensity`: base da severidade + bônus de evidência, truncada em `1`):**

| Situação da via | Sev. 1 | Sev. 2 | Sev. 3 |
| :--- | :---: | :---: | :---: |
| Via alvo sem evidência (presumido) | 0,30 | 0,55 | 0,80 |
| Só área alagável histórica (GeoSampa) | 0,45 | 0,70 | **0,95** |
| CGE ativo transitável | — | 0,80 | 1,00 |
| CGE ativo intransitável | — | **0,95** | 1,00 |

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| D18 | **Risco e ocorrência não se distinguem por cor, padrão ou ícone.** Um trecho presumido e um trecho com alagamento confirmado usam a mesma paleta e o mesmo estilo de traço. | `mapStyles.ts`, `FloodGenerativeMap.tsx` |
| D19 | **Risco presumido pode aparecer igual a ocorrência real.** Uma via só em área GeoSampa no nível 3 (`0,95`) fica idêntica a uma via **intransitável confirmada** no nível 2 (`0,95`). A via alvo sem evidência no nível 3 (`0,80`) fica igual a um alagamento transitável real no nível 2. | `match-road-risk.ts` (`calculateRiskIntensity`) |
| D20 | **O truncamento em `1` apaga a gradação no nível 3.** Ocorrência transitável, intransitável e intransitável em zona GeoSampa resultam todas em `1,00`. | `match-road-risk.ts` |
| D21 | **A severidade da cena pesa mais que a evidência da via.** `SEVERITY_VISUAL_PROFILES` muda largura, brilho e velocidade de todas as vias de uma vez. Uma via presumida num cenário crítico pulsa mais forte que uma ocorrência real num cenário de alerta. | `mapStyles.ts`, `FloodGenerativeMap.tsx` |
| D22 | **A gradação restante é imperceptível em DOOH.** Entre `0,80` e `1,00`, o halo externo passa de cerca de `49 m` para `56 m`, com alfa um pouco maior. É uma diferença ilegível para quem vê a tela por poucos segundos. | `FloodGenerativeMap.tsx` (`getWidth` / `getColor`) |
| D23 | **Não há legenda.** O espectador não tem como interpretar o que cor, espessura ou pulso significam. | `PlayerCanvas.tsx` / `FloodGenerativeMap.tsx` |

---

## 3. Requisitos Propostos

### 3.1 Dados e proximidade
- **R1 — Ocorrências posicionadas:** geocodificar cada ponto CGE-SP ativo (`street` + `reference` + `neighborhood`) para uma posição ou trecho aproximado, com cache TTL longo.
- **R2 — Vizinhança por distância:** substituir o filtro por zona CGE por um **raio de influência** a partir do ponto OOH, sem restrição de zona.
- **R3 — Raio e geometria adequados a decisões de rota:** ampliar a consulta de geometria para cobrir as vias de acesso e desvio, incluindo ocorrências dentro do raio mesmo fora do snapshot curado.

### 3.2 Decisão por via
- **R4 — Risco por via:** cada via relevante tem estado próprio (`confirmado-intransitavel`, `confirmado-transitavel`, `presumido`, `sem-risco`). A severidade da cena passa a ser o **máximo entre alvo e vizinhas**, preservando a origem.
- **R5 — Evidência acima de presunção:** a via alvo só é pintada como alagada com evidência, ou com estilo explicitamente "presumido". A suscetibilidade GeoSampa reforça o risco, mas sozinha não equivale a ocorrência (papel detalhado em [docs/07](./07-avaliacao-geosampa-suscetibilidade.md)).
- **R6 — Trecho, não via inteira:** quando houver posição (R1), destacar só o trecho próximo à ocorrência.

### 3.3 Editorial
- **R7 — Vias afetadas no texto:** listar as vias vizinhas afetadas, com prioridade para intransitáveis e as mais próximas, respeitando o limite de caracteres do template.
- **R8 — Orientação de desvio:** exibir uma mensagem do tipo "Evite: Av. X (sentido Y)" quando houver `direction`.
- **R9 — Estado normal correto:** "sem risco" só aparece quando alvo **e** vizinhas estão sem risco. Com o alvo livre e uma vizinha afetada, a peça usa uma mensagem própria (ex.: "Via livre • Alagamento a 600 m na Av. X").

### 3.4 Visual
- **R10 — Linguagem visual em dois eixos independentes** (resolve D18–D22), mantendo a estética editorial do template:
  - **Eixo 1 — Tipo:** **risco presumido** (meteorologia, suscetibilidade GeoSampa, via alvo sem evidência) e **ocorrência real** (CGE-SP) com aparência inconfundível. Exemplo: risco em azul translúcido ou tracejado; ocorrência em cor sólida de contraste, com ícone. Como o CGE-SP registra ocorrências com atraso, a [avaliação de fontes em tempo real (docs/05)](./05-avaliacao-fontes-tempo-real.md) propõe um nível intermediário, **"provável"** (chuva observada agora sobre ponto crônico), que passaria a compor este eixo: **risco → provável → confirmado**.
  - **Eixo 2 — Grau dentro de cada tipo:** risco em escala própria (baixo → alto, a partir da meteorologia e da suscetibilidade); ocorrência em **transitável** × **intransitável**, com contraste legível em DOOH, não só alguns metros de largura a mais.
  - O grau de uma via **não deve ser multiplicado pela severidade da cena inteira**. A severidade global continua valendo para texto e selo, mas não deve fazer um trecho presumido parecer mais grave que uma ocorrência real.
  - Os campos de evidência (`matchedCge`, `matchedCgeImpassable`, `inGeoSampaZone`, ou o estado por via de R4) passam a ser lidos diretamente na renderização, em vez de colapsados num único `riskIntensity`.
- **R10b — Legenda compacta:** exibir na peça uma legenda mínima (ex.: "Risco" / "Alagamento" / "Intransitável") que seja legível em `9:16` e `16:9` e também no Modo Player Limpo (resolve D23).
- **R11 — Rótulos nas vias afetadas:** marcador ou rótulo curto sobre cada ocorrência confirmada.
- **R12 — Enquadramento e indicadores fora do quadro:** ajustar a câmera para incluir as ocorrências próximas relevantes, ou exibir indicadores de direção e distância para as que ficarem fora.

### 3.5 Contrato da API
- **R13 — Payload de vizinhança em `/v1/player/scene`:** expor a lista de ocorrências próximas (`streetName`, `status`, `distanceMeters`, `bearing`, `direction`, `reference`, `source`), e um estado por feature viária que substitua ou complemente `riskIntensity`. A mudança deve ser retrocompatível ou versionada, e documentada em `backend/API.md`.

---

## 4. Decisões em Aberto

| Tema | Pergunta | Opções iniciais |
| :--- | :--- | :--- |
| Raio de influência | Qual distância define "vizinha relevante"? | Raio fixo (ex.: 1–2 km); raio por tipo de via; raio configurável por ativo OOH |
| Geocodificação CGE | Como posicionar ocorrências sem coordenada? | Nominatim (`street` + `reference`); interseção com geometria OSM da via pelo `neighborhood`; tabela curada de pontos recorrentes |
| Peso alvo × vizinhas | Uma vizinha intransitável eleva a cena a `CRÍTICO`? | Máximo simples; máximo ponderado pela distância; severidade dupla (alvo / arredores) |
| Presunção no alvo | Manter a mancha presumida no alvo sem evidência? | Remover; manter com estilo "presumido"; manter só no nível 3 |
| Codificação visual risco × ocorrência | Qual combinação de atributos separa os tipos e os graus sem poluir o mapa P&B editorial? | Cor distinta por tipo (ex.: azul = risco, vermelho/âmbar = ocorrência); mesmo matiz com padrão diferente (tracejado × sólido); ícones ou rótulos sobre ocorrências; combinação desses atributos |
| Animação por tipo | O fluxo/pulso animado vale para os dois tipos? | Animação só em ocorrência real; animação em ambos com ritmos diferentes; risco estático |
| Limite editorial | Quantas vias citar no texto? | 1–3 mais críticas/próximas; rotação entre ocorrências |
| Feeds JSON/RSS | Os alertas de `/v1/alerts` e `/feed.xml` também passam a incluir vizinhas? | Sim, no mesmo contrato; só no Player |

---

## 5. Fora de Escopo desta Fase

- Cálculo de **rotas alternativas** (Google Maps Routes / OSRM). Esta fase só indica **o que evitar**, sem sugerir trajeto.
- Previsão de alagamento por trecho com modelos hidrológicos próprios.
- Integração com fontes pagas de tráfego e incidentes (Waze for Cities, TomTom, HERE).

---

## 6. Critérios de Aceite (Propostos)

- [ ] Com o alvo sem ocorrência e uma vizinha intransitável dentro do raio, a peça destaca a vizinha como confirmada, cita o nome dela no texto e **não** mostra "Via sem risco".
- [ ] Uma ocorrência CGE em outra zona, dentro do raio de influência, é considerada. Uma ocorrência na mesma zona, fora do raio, não eleva a severidade da cena.
- [ ] Ocorrências confirmadas e risco presumido são visualmente distinguíveis, no Preview OOH e no Modo Player Limpo.
- [ ] Dentro de cada tipo, o grau é legível: risco baixo × alto e ocorrência transitável × intransitável. Uma via presumida nunca aparece igual ou mais grave que uma ocorrência real, independentemente da severidade da cena.
- [ ] A peça exibe uma legenda compacta da linguagem visual nos formatos `9:16` e `16:9`.
- [ ] Ocorrências relevantes fora do enquadramento ganham indicador de direção e distância, ou a câmera passa a enquadrá-las.
- [ ] O payload de `/v1/player/scene` expõe as ocorrências próximas, documentado em `backend/API.md` e na aba Técnico.
- [ ] O replay histórico (`date`/`time`) e a simulação (`simulate=`) continuam funcionando com a nova lógica de vizinhança.
- [ ] Os gates obrigatórios do `backend/` e do `frontend/` passam com código de saída `0`.
