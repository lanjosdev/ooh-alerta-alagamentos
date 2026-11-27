# 06 — Decisão: Horizonte de Risco em Horas e Critérios Antialarmismo

> **Status:** Decisão de escopo fechada (horizonte e princípios). Correções e critérios de implementação estão propostos.
> **Relacionados:** [01 — Viabilidade](./01-analise-briefing-e-viabilidade.md) · [03 — Escopo da PoC](./03-escopo-poc-player-dooh.md) · [04 — Vias Vizinhas](./04-escopo-alertas-vias-vizinhas.md) · [05 — Fontes em Tempo Real](./05-avaliacao-fontes-tempo-real.md)

---

## 1. Decisão

- **O projeto não segue literalmente a promessa "High flood risk in 30 min" do briefing.** O briefing provavelmente foi elaborado sem validação técnica da realidade de São Paulo e da disponibilidade de dados dos órgãos responsáveis. O [docs/01](./01-analise-briefing-e-viabilidade.md) já registrava que nenhum órgão público brasileiro fornece previsão determinística rua a rua com 30 minutos de antecedência.
- **Meta de sucesso:** informar **risco de chuva e alagamento em escala de horas (1 a 6 h)**, de forma **criteriosa**.
- **Princípio central:** a peça **não pode passar informação alarmante, antecipada demais ou infundada**. Diante de dúvida entre alertar e não alertar sem evidência suficiente, a peça fica no nível mais baixo justificável.
- **Nowcasting sub-horário** (ex.: Tomorrow.io) deixa de ser requisito. Passa a ser uma melhoria opcional de precisão.

---

## 2. Situação Atual

### 2.1 Horizonte temporal
- O código **já trabalha em horas**: previsão horária do Open-Meteo, decisões com base nas **próximas 2 h** e aba Clima com as próximas 6 h (`backend/src/providers/forecast-provider.ts`). Os textos usam "nas próximas 2h" (`build-player-editorial.ts`, `build-ooh-message-service.ts`).
- O "30 min" aparecia só na documentação (docs/02, 03 e 05), que foi ajustada junto com este registro.

### 2.2 Fontes de alerta antecipado ou infundado

| # | Deficiência | Efeito | Onde |
| :--- | :--- | :--- | :--- |
| A1 | **Avisos INMET futuros entram sem checar a vigência.** O provider une `hoje` e `futuro` e só descarta os `encerrado`. Os campos `inicio`/`fim` não são comparados com o horário atual. | Um aviso que começa amanhã eleva a peça hoje (**antecipado demais**). | `backend/src/providers/inmet/inmet-alerts-provider.ts` |
| A2 | **Avisos INMET não são filtrados por tipo de evento.** Baixa umidade, onda de calor e ventos contam como chuva. | Um aviso "Perigo" de baixa umidade (rank 2) produz "ALERTA DE CHUVA E ALAGAMENTO" (**infundado**). | `inmet-alerts-provider.ts`, `evaluate-risk-service.ts` |
| A3 | **"Perigo Potencial" (rank 1) sozinho dispara ATENÇÃO.** Esses avisos cobrem áreas enormes e duram dias. | Peça em atenção quase permanente durante o verão. | `evaluate-risk-service.ts` |
| A4 | **Uma ocorrência em qualquer ponto da macrozona CGE eleva a via alvo**, com texto "NA VIA". | Alerta local baseado em evento distante (ver D4 no docs/04). | `get-location-alert-service.ts`, `build-player-editorial.ts` |
| A5 | **A via alvo e as áreas GeoSampa ganham mancha a partir do nível 1**, sem evidência local. | Mancha de alagamento sem alagamento (ver D8 e D10 no docs/04). | `match-road-risk.ts` |
| A6 | **Previsão de grade (~9 km) com limiares fixos** decide os níveis 1 e 2. | Risco regional de chuva apresentado como risco de alagamento da via. | `evaluate-risk-service.ts` |
| A7 | **Não há histerese nem persistência.** Uma única leitura sobe o nível, que pode oscilar a cada ciclo de cache (~5 min). | Peça "piscando" entre estados; alerta sem confirmação. | `evaluate-risk-service.ts` |
| A8 | **A severidade é o máximo de qualquer critério isolado.** Não há exigência de corroboração entre fontes. | Um único sinal fraco basta para ALERTA. | `evaluate-risk-service.ts` |

---

## 3. Critérios Antialarmismo (Propostos)

| Critério | Regra | Resolve |
| :--- | :--- | :--- |
| **C1 — Horizonte** | Risco expresso em escala de **1 a 6 h** ("nas próximas horas"), sem prometer minutos nem horário exato. | — |
| **C2 — Vigência** | Avisos oficiais só contam **dentro da janela `inicio`–`fim`**. Avisos futuros podem aparecer na aba técnica, nunca na peça. | A1 |
| **C3 — Pertinência** | Só contam eventos relacionados a chuva e alagamento (ex.: chuvas intensas, acumulado de chuva, tempestade). | A2 |
| **C4 — Corroboração** | Nenhum sinal isolado eleva acima de **ATENÇÃO**. **ALERTA** e **CRÍTICO** exigem duas evidências independentes (ex.: previsão + chuva observada), ou ocorrência real/provável **próxima** à via (ver docs/04 e docs/05). | A3, A6, A8 |
| **C5 — Proximidade** | Ocorrências só elevam a peça quando estão dentro do raio de influência do ponto OOH, não por pertencer à mesma macrozona. | A4 |
| **C6 — Linguagem proporcional** | **ATENÇÃO** = "Previsão de chuva forte na região", **sem mancha na via**. A mancha só aparece com evidência local (alinhado ao R5 do docs/04). Os textos nunca afirmam alagamento sem ocorrência real ou provável. | A5, A6 |
| **C7 — Estabilidade** | Subir de nível só após confirmação em **ciclos consecutivos**; descer com **histerese** (permanência mínima), evitando oscilação na tela. | A7 |
| **C8 — Transparência** | A peça indica a natureza do aviso ("previsão", "provável", "confirmado") e a origem dos dados no selo de telemetria. | — |

---

## 4. Prioridade de Implementação

1. **Correções imediatas, de baixo custo e alto impacto:** C2 (vigência) e C3 (pertinência) no provider INMET e no `EvaluateRiskService`, com testes cobrindo aviso futuro e aviso de tipo não relacionado.
2. **Recalibrar a decisão:** C4 (corroboração), C6 (linguagem proporcional) e C7 (estabilidade).
3. **Dependentes de outros escopos:** C5 (proximidade, docs/04) e o nível "provável" (docs/05).

---

## 5. Critérios de Aceite (Propostos)

- [ ] Um aviso INMET com `inicio` no futuro não altera a severidade nem o texto da peça.
- [ ] Um aviso INMET de evento não relacionado a chuva (ex.: baixa umidade) não altera a severidade nem o texto da peça.
- [ ] Um sinal isolado (só previsão, ou só aviso INMET) nunca eleva a peça acima de ATENÇÃO.
- [ ] No nível ATENÇÃO, a peça não desenha mancha de alagamento sem evidência local, e o texto fala em previsão de chuva, não em alagamento.
- [ ] A severidade não oscila entre ciclos consecutivos sem mudança sustentada das evidências.
- [ ] Nenhum texto da peça promete antecedência em minutos.
- [ ] Os gates obrigatórios do `backend/` e do `frontend/` passam com código de saída `0`.
