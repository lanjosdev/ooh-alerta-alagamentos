# 08 — Escopo: Base Histórica de Alagamentos e Camada no Mapa Explorador

> **Status:** Proposto — viabilidade avaliada, fontes levantadas (consulta ao WFS do GeoSampa em 27/11/2026). Itens marcados **(a validar)** dependem de confirmação.
> **Relacionados:** [04 — Vias Vizinhas](./04-escopo-alertas-vias-vizinhas.md) · [05 — Fontes em Tempo Real](./05-avaliacao-fontes-tempo-real.md) · [06 — Antialarmismo](./06-criterios-horizonte-e-antialarmismo.md) · [07 — GeoSampa](./07-avaliacao-geosampa-suscetibilidade.md)

Este documento registra a proposta de construir uma **base histórica de alagamentos por via** e exibi-la no **Mapa Explorador** como camada informativa discreta, com filtro de período acumulado (**6 meses, 1, 2, 3 e 5 anos**). Também registra as fontes gratuitas disponíveis para formar essa base.

---

## 1. Objetivo e Valor

- **Informar sem alarmar:** mostrar um fato passado ("esta via alagou 14 vezes em 2 anos"), e não uma previsão. Está alinhado aos critérios do [docs/06](./06-criterios-horizonte-e-antialarmismo.md).
- **Base reaproveitável** pelos outros escopos:
  - tabela de **pontos crônicos** e nível "provável" ([docs/05](./05-avaliacao-fontes-tempo-real.md));
  - **peso histórico calculado**, substituindo o `historicalRiskWeight` manual (G6 do [docs/07](./07-avaliacao-geosampa-suscetibilidade.md));
  - **ranking de vias vizinhas** ([docs/04](./04-escopo-alertas-vias-vizinhas.md)).
- **Escopo visual:** apenas o Mapa Explorador. O Player DOOH continua mostrando somente o estado presente.

---

## 2. Situação Atual

- **Não existe base histórica.** O CGE-SP é consultado dia a dia, sob demanda (`alagamentos.jsp?dataBusca=`), e o resultado é descartado após o cache. Não há persistência no backend (PostGIS está fora do escopo da PoC).
- O GeoSampa é consultado só na camada `mancha_inundacao_25` (fallback `area_inundavel`), sem dimensão de tempo.

---

## 3. Fontes Avaliadas

### 3.1 Já integradas — precisam ser guardadas e organizadas

| Fonte | Conteúdo | Papel na base |
| :--- | :--- | :--- |
| **CGE-SP** (`dataBusca`) | Uma página por dia, com zona, bairro, via, referência, janela horária e status (transitável/intransitável). **Sem coordenadas.** | **Espinha dorsal**: o histórico mais longo e o único com status de trânsito. Foco nos corredores monitorados pela CGE. Retenção disponível no site **(a validar)**. |

### 3.2 Novas no GeoSampa WFS (mesmo servidor já integrado)

| Camada | Conteúdo verificado | Valor |
| :--- | :--- | :--- |
| `geoportal:risco_ocorrencia_alagamento` e `geoportal:risco_ocorrencia_inundacao` | Ocorrências da **Defesa Civil publicadas no GeoSampa** (origem: sistema SIGRC), em **pontos georreferenciados** (EPSG:31983), com data (`dt_ocorrencia`) e subprefeitura. Na consulta: 315 registros em cada, de jan a out/2026, com carga em 16/11/2026. | **Alto.** Resolve a localização. **A camada aparenta manter só o ano corrente**: para acumular histórico, é preciso **salvar cópias periódicas a partir de já**. Não tem horário, nome de via nem status de trânsito. A diferença entre "alagamento" e "inundação" e a contagem idêntica nas duas camadas estão **(a validar)**. |
| `geoportal:mancha_inundacao_5`, `_25` e `_100` | Manchas de inundação em três versões, provavelmente por período de retorno de 5, 25 e 100 anos **(a validar nos metadados)**. | **Alto para o "onde".** Dá graus de suscetibilidade em vez de sim/não (responde a G2 e G9 do docs/07). Estática, fora do filtro de período. |
| `geoportal:risco_hidrologico` | 793 áreas com grau de risco (ex.: `R2`), tipo de processo (ex.: `ALAGAMENTO`), bacia e data de vistoria. | **Médio.** Voltada a moradias (traz `qt_moradia`); contextualiza, mas não é específica de vias. |
| `geoportal:drenagem`, `hidrografia_restituida`, `bacia_hidrografica`, `caderno_drenagem` | Rede de drenagem, córregos (inclusive canalizados) e bacias. | **Médio.** Explica por que uma via alaga (G7 do docs/07). |
| `geoportal:sac_limpeza_enchente_evento` | Pedidos SP156 de "Limpeza da via pública após enchentes ou eventos", com logradouro e número. | **Baixo nesta camada** (175 registros, de 2020–2021). |

### 3.3 Externas ao GeoSampa

| Fonte | Avaliação |
| :--- | :--- |
| **SP156 — Portal de Dados Abertos** (desde 2012) | Pode conter o serviço "Limpeza da via pública após enchentes" em escala muito maior, por endereço. Georreferenciamento e cobertura **(a validar)**. |
| **Atlas Digital de Desastres / S2ID** (MIDR) | Granularidade municipal, sem nível de rua. **Pouco útil** para vias. |
| **Série de chuva da Prefeitura (1933–2025)** | Totais da cidade. Só contexto. |
| **CEMADEN** | Histórico de **chuva** por estação. Útil para calibrar limiares, não registra ocorrências. Limites de download **(a validar)**. |
| **Waze for Cities** | Histórico excelente, mas só via parceria institucional. |

---

## 4. Composição Proposta da Base

1. **CGE-SP (5 anos):** coleta única dos ~1.830 dias, com intervalo educado entre chamadas (~2–3 s, cerca de 1–1,5 h), reaproveitando o parser atual. Depois, coleta diária do **dia anterior (D-1)**, que também contorna o atraso de registro.
2. **Ocorrências da Defesa Civil publicadas no GeoSampa (SIGRC, de agora em diante):** cópias periódicas das camadas de ocorrência do WFS do GeoSampa, deduplicadas por `cd_identificador`. Os pontos também ajudam a **localizar ocorrências do CGE** (mesma data, mesma subprefeitura, mesma via próxima).
3. **Manchas de 5, 25 e 100 anos (GeoSampa):** camada estática graduada do "onde". Entra na base como contexto fixo, fora do filtro de período, por não ter data.
4. **SP156 (a validar):** possível histórico longo de enchentes por endereço.

### 4.1 Localização das ocorrências do CGE

| Abordagem | Como | Prós / Contras |
| :--- | :--- | :--- |
| **Por via** | Casar o nome normalizado (`normalizeStreetName`) com as vias OSM dentro do bairro. | Simples, mas numa via longa (Marginal, Av. do Estado) pinta quilômetros a partir de um único ponto. |
| **Por trecho** | Geocodificar "via + referência + bairro" e encaixar no segmento OSM mais próximo (~200–300 m de trecho). | Mais fiel, mas parte das referências vai falhar. |

**Recomendado:** por trecho, com fallback por via marcado como **"localização aproximada"**, apoio dos pontos SIGRC e uma **tabela curada** para pontos recorrentes que não casarem (a mesma dos pontos crônicos). Registrar a **taxa de ocorrências não localizadas** como métrica de qualidade.

### 4.2 Armazenamento e API

- **Sem banco nesta fase:** arquivo derivado (GeoJSON/JSON) com as ocorrências e os agregados por trecho (total, intransitáveis, data da última ocorrência).
- **Agregados pré-calculados** para 6 meses, 1, 2, 3 e 5 anos, para que a troca de filtro não exija nova consulta.
- **Novo endpoint**, por exemplo `GET /v1/history/flooding?period=1y`, documentado em `backend/API.md`.
- **Volume estimado:** alguns milhares a dezenas de milhares de registros em 5 anos **(a confirmar com a coleta)**; agregado por trecho, poucos MB.

---

## 5. Proposta Visual no Mapa Explorador

- **Camada de linha nativa do MapLibre** sobre o estilo `positron`, abaixo dos rótulos, em **cinza/grafite translúcido**. Sem a mancha animada do deck.gl, para não competir com o azul do risco ao vivo nem com os pins.
- **Intensidade por frequência:** largura ou opacidade em poucas faixas (ex.: 1–2, 3–9, 10+ ocorrências).
- **Controles discretos:** toggle "Histórico de alagamentos" (desligado por padrão) e seletor `6m · 1a · 2a · 3a · 5a`, sempre acumulado.
- **Tooltip no hover:** ex.: "14 ocorrências (5 intransitáveis) • última em 16/01/2026".
- **Legenda** com a origem dos dados (ex.: "Fonte: CGE-SP / Defesa Civil via GeoSampa").
- **Opcional:** toggle separado para as manchas de suscetibilidade (5/25/100 anos), fora do filtro de período.

### 5.1 Ressalvas que a interface precisa deixar claras
- **Ausência de registro não significa que a via nunca alagou.** O CGE só registra os pontos que monitora e que os operadores reportam; há relatos de subnotificação.
- Alguns registros terão **localização aproximada**.

---

## 6. Esforço Estimado (Menor Custo Primeiro)

| Etapa | Esforço |
| :--- | :--- |
| **Salvar cópias periódicas das camadas SIGRC** (urgente, para não perder dados) | Baixo |
| Coleta dos 5 anos do CGE e coleta diária (D-1) | Baixo |
| Localização das ocorrências (geocodificação, encaixe no trecho, tabela curada) | **Alto** — principal risco de qualidade |
| Agregação por trecho e endpoint | Baixo a médio |
| Camada, filtros, tooltip e legenda no Explorador | Baixo a médio |

**Redução de risco:** piloto nos bairros dos 7 pontos curados, medindo a taxa de ocorrências localizadas antes de expandir para a cidade toda.

---

## 7. Decisões em Aberto

| Tema | Pergunta |
| :--- | :--- |
| Referência temporal | No modo Histórico do cabeçalho, o período conta a partir de hoje ou da data de replay selecionada? |
| Persistência | Arquivo derivado versionado, armazenamento em disco gerado pelo backend ou antecipar PostGIS? |
| Retenção das fontes | Até quantos anos o CGE mantém consulta? A camada SIGRC é de fato só do ano corrente? |
| Peso entre fontes | Como somar CGE e SIGRC sem contar duas vezes a mesma ocorrência? |
| Termos de uso | Há restrição para coleta automatizada e reuso comercial dos dados do CGE e do GeoSampa? |

---

## 8. Critérios de Aceite (Propostos)

- [ ] A base contém ocorrências do CGE dos últimos 5 anos (ou o máximo disponível) e é atualizada diariamente.
- [ ] As camadas de ocorrência da Defesa Civil publicadas no GeoSampa são salvas periodicamente e acumuladas sem duplicação.
- [ ] A taxa de ocorrências localizadas é medida e exposta; registros aproximados são identificados como tal.
- [ ] No Mapa Explorador, a camada histórica fica desligada por padrão, usa tons neutros e permite filtrar 6 meses, 1, 2, 3 e 5 anos (acumulado).
- [ ] O tooltip mostra contagem, intransitáveis e data da última ocorrência, e a legenda informa a origem e a ressalva de subnotificação.
- [ ] O Player DOOH não é afetado pela camada histórica.
- [ ] Os gates obrigatórios do `backend/` e do `frontend/` passam com código de saída `0`.

---

## Referências

- [GeoSampa — metadados "Alagamento (dados de Ocorrências)"](https://metadados.geosampa.prefeitura.sp.gov.br/geonetwork/srv/api/records/432c06b1-03a1-4b1f-9210-423e1b58e869)
- [Prefeitura de SP — dados abertos do SP156](https://prefeitura.sp.gov.br/web/inovacao/w/acesso_a_informacao/350229)
- [Atlas Digital de Desastres no Brasil](https://atlasdigital.mdr.gov.br)
- [Plataforma Clima Ambiente — CEMADEN datasets](https://plataforma-clima-ambiente-readthedocs.readthedocs.io/en/latest/cemaden_data.html)
- [Prefeitura de SP — precipitação pluviométrica 1933–2025](https://prefeitura.sp.gov.br/documents/d/licenciamento/precipitacao_pluviometrica_1933_2025)
