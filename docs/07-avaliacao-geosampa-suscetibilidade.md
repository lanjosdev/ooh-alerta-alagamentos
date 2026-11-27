# 07 — Avaliação: Papel do GeoSampa (Suscetibilidade) na Inteligência de Risco

> **Status:** Avaliação — diagnóstico e papel proposto. Os itens marcados **(a validar)** dependem de confirmação nos metadados da Prefeitura ou no WFS.
> **Relacionados:** [04 — Vias Vizinhas](./04-escopo-alertas-vias-vizinhas.md) · [05 — Fontes em Tempo Real](./05-avaliacao-fontes-tempo-real.md) · [06 — Horizonte e Antialarmismo](./06-criterios-horizonte-e-antialarmismo.md)

O GeoSampa é **a principal fonte gratuita para responder "onde alaga"**, que é exatamente o que o foco nas vias vizinhas precisa. Hoje ele é tratado como um detalhe da mancha: ao mesmo tempo **subaproveitado** (não pesa na inteligência de risco) e **mal usado** (vira gatilho de mancha sem evidência).

---

## 1. O que o GeoSampa é e como é usado hoje

- **Natureza do dado:** camada **estática** de suscetibilidade, com polígonos de mancha de inundação ou área inundável da Prefeitura de São Paulo. Ela diz **onde** costuma alagar, mas não **quando**.
- **Coleta:** `GeoSampaWfsProvider` (`backend/src/providers/geosampa/geosampa-wfs-provider.ts`) consulta o WFS 2.0.0 ao vivo, com camada principal `geoportal:mancha_inundacao_25` e fallback `geoportal:area_inundavel`. A consulta usa um bbox de `500 m` ao redor do alvo, limite de `500` polígonos (`count`), timeout de `5 s` e cache TTL (`CACHE_TTL_GEOSAMPA_SECONDS`). Só roda na Capital; fora dela fica `skipped`.
- **Onde entra:** só em `matchRoadRisk` (`backend/src/services/player/match-road-risk.ts`), na cena do Player. Cada via OSM é testada com buffer de `20 m` contra os polígonos, e o resultado é binário (`inGeoSampaZone`). Esse valor tem dois efeitos:
  1. **Habilita a mancha em vias vizinhas.** Fora a via alvo, uma via só recebe mancha com ocorrência CGE ou estando em área GeoSampa.
  2. **Soma `+0,15` ao `riskIntensity`** (mancha um pouco mais larga e opaca).
- **Onde não entra:**
  - **Severidade:** `EvaluateRiskService` não recebe GeoSampa. O peso histórico (`historicalRiskWeight`) é um valor fixo por região, digitado à mão (`0,75`–`0,9` em `in-memory-region-repository.ts`), e só afeta o `riskScore`, não o nível.
  - **Editorial:** aparece apenas como crédito no selo de fontes (`build-player-editorial.ts`).
  - **`/v1/alerts` e `/feed.xml`:** não usam GeoSampa.
  - **Mapa:** os polígonos não são desenhados. A aba Técnico mostra só `geoSampaZonesCount`.

---

## 2. Deficiências

### 2.1 Subaproveitado

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| G1 | **Não influencia a decisão de severidade.** A mesma previsão gera o mesmo nível dentro de uma mancha de inundação ou em terreno alto. Deveria ser o principal modulador entre "chuva na região" e "risco de alagamento nesta via". | `evaluate-risk-service.ts`, `get-location-alert-service.ts` |
| G2 | **Só há resposta binária.** Não importa a proporção da via dentro da mancha, a área afetada nem a distância até o ponto OOH. Não existe ranking de vizinhas por suscetibilidade. | `match-road-risk.ts` (`isRoadInGeoSampaZone`) |
| G3 | **A via inteira é pintada.** A mancha cobre todo o segmento OSM, e não só o trecho que cruza o polígono. O GeoSampa é o dado que permitiria **recortar o trecho baixo** (resolve D11 do docs/04). | `match-road-risk.ts`, `FloodGenerativeMap.tsx` |
| G4 | **Os pontos curados não são determinísticos nesse aspecto.** As vias curadas vêm de snapshot local, mas o GeoSampa é consultado ao vivo. Se o WFS falhar ou passar de `5 s`, as vizinhas perdem a mancha **silenciosamente** (fonte `error`, zonas vazias). | `get-player-scene-service.ts` (`fetchGeoSampaZones`) |
| G5 | **Área curta e possível truncamento.** O bbox tem ~`500 m` e o limite é de `500` polígonos. Como a camada é muito fragmentada (polígonos de ~`86 m²`), a vizinhança relevante para decisão de rota pode ficar de fora ou incompleta. | `geosampa-wfs-provider.ts` |
| G6 | **O peso histórico é manual.** O `historicalRiskWeight` poderia ser derivado do GeoSampa e do histórico CGE, em vez de definido à mão por região. | `in-memory-region-repository.ts` |
| G7 | **Faltam camadas e cruzamentos:** histórico de pontos crônicos do CGE (docs/05) e outras camadas do GeoSampa. A consulta ao WFS confirmou camadas disponíveis e não usadas: ocorrências georreferenciadas da Defesa Civil (`risco_ocorrencia_alagamento`, `risco_ocorrencia_inundacao`), `risco_hidrologico`, `drenagem`, `hidrografia_restituida` e `bacia_hidrografica` (detalhes em [docs/08](./08-escopo-base-historica-alagamentos.md)). | — |

### 2.2 Mal usado

| # | Deficiência | Onde |
| :--- | :--- | :--- |
| G8 | **Vira gatilho de mancha.** A partir do nível 1, que pode vir só de previsão de grade, toda vizinha em área GeoSampa ganha mancha de alagamento sem ocorrência. Contradiz o antialarmismo: suscetibilidade indica **onde é provável**, não **que está alagando** (equivale a D10 do docs/04 e A5 do docs/06). | `match-road-risk.ts` (`calculateRiskIntensity`) |
| G9 | **A semântica da camada não está validada.** O código não documenta o que `mancha_inundacao_25` representa (modelagem, ocorrências passadas, período de retorno?) nem a diferença para `area_inundavel` **(a validar nos metadados da Prefeitura antes de aumentar o peso da camada)**. O WFS também oferece `mancha_inundacao_5` e `mancha_inundacao_100`, o que sugere períodos de retorno de 5, 25 e 100 anos e permitiria graduar a suscetibilidade (ver [docs/08](./08-escopo-base-historica-alagamentos.md)). | `geosampa-wfs-provider.ts` |

---

## 3. Papel Proposto

**Princípio:** o GeoSampa responde **"onde"**; as fontes dinâmicas (previsão, estações, ocorrências) respondem **"quando"**. Nenhum dos dois, sozinho, justifica mancha de alagamento.

| Camada de evidência (docs/05) | Papel do GeoSampa |
| :--- | :--- |
| **Risco** | A previsão de chuva só vira **risco de alagamento** de uma via se ela estiver em área suscetível. Fora dela, a peça mostra apenas "chuva forte na região". Assim, o GeoSampa **reduz** o alarmismo em vez de aumentá-lo. |
| **Provável** | Chuva **observada** (estações CGE / CEMADEN) sobre um trecho GeoSampa ou ponto crônico gera "alagamento provável". É a melhor evidência gratuita disponível no mesmo dia. |
| **Confirmado** | Contextualiza e localiza o trecho da ocorrência confirmada (recorte do trecho baixo). |

**Uso nas vias vizinhas (docs/04):**
- **Selecionar e ordenar** quais vizinhas monitorar e citar no texto (as mais suscetíveis e mais próximas).
- **Desenhar só o trecho baixo** da via, não o segmento inteiro.
- **Visual:** área suscetível sem chuva observada não ganha mancha de alagamento. No máximo, ganha um estilo discreto de "risco".

**Engenharia de dados:**
- Tratar o GeoSampa como dado estático: **snapshot ou pré-processamento** por ponto OOH (ou por célula da cidade), com o WFS ao vivo apenas como atualização.
- Pré-calcular por segmento OSM: proporção dentro da mancha, extensão afetada e distância ao ponto OOH.
- Derivar o peso histórico por ponto ou trecho a partir do GeoSampa e do histórico CGE, substituindo o `historicalRiskWeight` manual.

---

## 4. Próximos Passos

1. **Validar a semântica** de `mancha_inundacao_25` e `area_inundavel` nos metadados do GeoSampa e levantar outras camadas úteis (hidrografia, relevo).
2. **Medir a cobertura** dos polígonos nos 7 pontos curados (quantos polígonos, quantos trechos de via afetados, se há truncamento pelo limite de `500`).
3. **Gerar snapshot** GeoSampa para os pontos curados, com o mesmo padrão determinístico das geometrias OSM.
4. **Redesenhar o papel na decisão** junto com os critérios C4 e C6 do docs/06 e com o nível "provável" do docs/05.

---

## 5. Critérios de Aceite (Propostos)

- [ ] Com chuva prevista, uma via fora de área suscetível não recebe mancha nem texto de alagamento; a peça fala apenas em chuva na região.
- [ ] Área suscetível sem chuva observada nem ocorrência não recebe mancha de alagamento.
- [ ] Chuva observada sobre trecho suscetível gera o estado "provável", visualmente distinto de ocorrência confirmada.
- [ ] A mancha cobre o trecho da via dentro da área suscetível, não o segmento OSM inteiro.
- [ ] Nos pontos curados, a falha do WFS ao vivo não altera o resultado (snapshot local).
- [ ] Os gates obrigatórios do `backend/` e do `frontend/` passam com código de saída `0`.
