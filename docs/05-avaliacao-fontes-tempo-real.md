# 05 — Avaliação: Detecção de Ocorrências em Tempo Real e Fontes Complementares

> **Status:** Avaliação — recomendações e próximos passos propostos. Os itens marcados **(a validar)** ainda precisam ser confirmados (cobertura, termos de uso e custo).
> **Relacionados:** [02 — Pesquisa de Stack e Fontes de Dados](./02-pesquisa-stack-e-fontes-dados.md) · [04 — Alertas de Vias Vizinhas](./04-escopo-alertas-vias-vizinhas.md)

Este documento avalia se o projeto consegue **detectar ocorrências reais de alagamento no mesmo dia**, dado que o CGE-SP muitas vezes só exibe as ocorrências horas depois (às vezes apenas consultando o dia anterior). Também levanta quais fontes externas faltam compor.

---

## 1. Diagnóstico: limitação do CGE-SP como detector ao vivo

- **Como coletamos hoje:** scraping de `https://www.cgesp.org/v3/alagamentos.jsp`, a página do dia, ou `?dataBusca=DD/MM/AAAA` no replay (`backend/src/providers/cge-sp/cge-sp-flooding-provider.ts`), com cache de `300 s` (`CACHE_TTL_CGE_SECONDS`). O atraso observado **não vem do nosso cache**.
- **Origem do atraso:** as ocorrências são **registradas manualmente** por operadores da CGE, muitas vezes depois da janela real (`De HH:MM a HH:MM`) ou consolidadas mais tarde.
- **Consequência:**
  - **No replay histórico, o CGE é excelente**, e a reconstrução por janela horária (`cge-sp-time-window.ts`) funciona bem por isso.
  - **Como gatilho ao vivo, é fraco.**
  - Mesmo quando registrada a tempo, a ocorrência indica que a via **já alagou**. A antecipação do risco vem de outras fontes, em escala de **horas** (o "risco em 30 min" do briefing foi descartado — ver [docs/06](./06-criterios-horizonte-e-antialarmismo.md)).
- **Conclusão:** com o CGE-SP como única fonte de ocorrência, o projeto fica quase sempre atrasado em relação à rua. O CGE deve ser tratado como **confirmação** (e base de calibração), e não como gatilho principal.

---

## 2. Ativos já integrados e subaproveitados

| Ativo | Uso atual | Potencial |
| :--- | :--- | :--- |
| **Estações pluviométricas CGE** (`stationRainfall`) | Só a estação mais próxima, com limiares fixos de `20 mm` / `40 mm` em `EvaluateRiskService`. | Dado quase em tempo real. Pode ser cruzado com pontos crônicos (abaixo) e considerar taxa de chuva recente (`recentDeltaMm`) e estações vizinhas. |
| **Histórico de ocorrências CGE** (`dataBusca`) | Só para replay. | Base para a **tabela de pontos crônicos** (~300 pontos recorrentes, já sugerida em docs/02), vinculada a `way_id` OSM, e para **calibrar limiares por ponto**: "com X mm em Y min na estação próxima, este ponto costuma alagar". |
| **GeoSampa** (manchas de inundação) | Bônus de intensidade por interseção. | Combinado com chuva observada, reforça o sinal "provável" (ver [docs/07](./07-avaliacao-geosampa-suscetibilidade.md)). |

Com isso surge uma camada intermediária de evidência: **"alagamento provável agora"**, inferida a partir de dados ao vivo sem esperar o registro da CGE.

---

## 3. Fontes externas que faltam

### 3.1 Confirmação de ocorrência quase em tempo real

| Fonte | Status em docs/02 | O que entrega | Viabilidade |
| :--- | :---: | :--- | :--- |
| **Waze for Cities (Partner Feed)** | Já listada | Alertas de alagamento reportados por motoristas, com `lat/lon` e score de confiabilidade. É a fonte mais rápida disponível. | Só via parceria com órgão público (Prefeitura/CET). O uso comercial depende de acordo institucional. |
| **TomTom Traffic Incidents API** | **Nova** | Incidentes viários com categoria própria de alagamento, georreferenciados no trecho. | Comercial, com cota gratuita para desenvolvimento. **(a validar: cobertura real de alagamentos em SP)** |
| **HERE Traffic API (Incidents)** | **Nova** | Incidentes (fechamento de via, perigo, clima) com geometria do trecho. | Comercial, com cota gratuita. **(a validar: tipificação de alagamento e cobertura em SP)** |
| **Anomalia de fluxo de tráfego** (TomTom Flow Segment / Google Routes) | **Nova** | Queda brusca de velocidade num trecho durante chuva forte, usada como **sinal indireto** de alagamento. | Comercial. Não confirma sozinha, mas reforça um ponto crônico sob chuva. |

### 3.2 Antecipação (risco em escala de horas)

> O horizonte alvo é de **1 a 6 h** ([docs/06](./06-criterios-horizonte-e-antialarmismo.md)). As fontes abaixo melhoram a precisão desse risco; o nowcasting sub-horário é opcional.

| Fonte | Status em docs/02 | O que entrega | Viabilidade |
| :--- | :---: | :--- | :--- |
| **Tomorrow.io** | Já listada | Nowcasting minuto a minuto (radar, satélite e ML). | Pago. |
| **REDEMET (DECEA) — API** | **Nova** | Produtos de radar meteorológico (imagens/mosaicos) e dados aeronáuticos. | Gratuita com chave. **(a validar: resolução temporal e formato para uso automatizado)** |
| **RainViewer API** | **Nova** | Mosaico de radar com passado recente e nowcast curto, em tiles. | Gratuita com limites. **(a validar: cobertura de radar para SP e termos de uso comercial)** |
| **CEMADEN** | Já listada | Pluviômetros a cada 10 min, numa rede mais densa que a do CGE. | Sem API pública documentada: exige acesso institucional. |
| **SAISP / SIBH (FCTH / DAEE-SP)** | Já listada | Nível de rios e córregos, mais o radar de Ponte Nova. | Convênio. Muito relevante para as marginais e para avenidas sobre córregos (ex.: Roberto Marinho). |
| **"Estado de Atenção / Alerta" da CGE** | **Nova** | Status oficial de alagamento da cidade e das zonas, declarado pela CGE na hora. | Gratuito, por scraping na mesma origem já integrada. Reforça a severidade da zona. |

### 3.3 Menor prioridade

- **Redes sociais (X da CGE e da CET):** publicações em tempo real, mas a API é paga e o scraping é frágil.
- **Defesa Civil (SMS 40199 / cell broadcast):** não há feed público aberto conhecido.

---

## 4. Avaliação e Arquitetura Recomendada

- **Só com fontes gratuitas e abertas**, detectar ocorrências reais no mesmo dia é **muito limitado**. O máximo factível é o **"alagamento provável"**, inferido por chuva observada nas estações CGE somada aos pontos crônicos e ao GeoSampa.
- **Ocorrências reais quase em tempo real** dependem de **tráfego colaborativo** (Waze por parceria, ou TomTom/HERE comercial). Isso é uma **decisão de negócio e de custo**, não de código.
- **Arquitetura recomendada — fusão em 3 camadas de evidência:**

| Camada | Origem | Latência típica | Papel na peça DOOH |
| :--- | :--- | :--- | :--- |
| **Risco** | Previsão (Open-Meteo / nowcasting), avisos INMET, estado de atenção CGE, suscetibilidade GeoSampa | Antecipa de 1 a 6 h | Prevenção ("risco nas próximas horas"), seguindo os critérios antialarmismo do docs/06 |
| **Provável** | Chuva observada agora (estações CGE / CEMADEN) sobre ponto crônico calibrado | Minutos | "Alagamento provável na Av. X" |
| **Confirmado** | Waze / TomTom / HERE (ao vivo); CGE-SP (confirmação posterior) | Minutos (colaborativo) a horas (CGE) | "Alagamento na Av. X — evite" |

Essas camadas se encaixam no eixo **Tipo** da linguagem visual proposta em [docs/04 (R10)](./04-escopo-alertas-vias-vizinhas.md), que passa a ter três níveis de evidência em vez de dois.

---

## 5. Próximos Passos (Menor Custo Primeiro)

1. **Medir o atraso real do CGE:** num dia de chuva, guardar `alagamentos.jsp` a cada 5 min e comparar o horário de aparecimento de cada ponto com a janela que ele declara.
2. **Montar a tabela de pontos crônicos** a partir do histórico CGE (`dataBusca`), vinculada a `way_id` OSM e com frequência e severidade históricas.
3. **Gerar o sinal "provável"** com as estações CGE ao vivo sobre os pontos crônicos, calibrando limiares por ponto a partir do histórico.
4. **Testar o TomTom Traffic Incidents** na cota gratuita durante eventos de chuva, para medir a cobertura real de alagamentos em SP. Repetir com o HERE se necessário.
5. **Coletar o "Estado de Atenção/Alerta" da CGE** como reforço de severidade por zona.
6. **Encaminhar as decisões de negócio:** parceria Waze for Cities via Prefeitura/CET, acesso institucional ao CEMADEN e SAISP, e verba para nowcasting e incidentes comerciais.

---

## 6. Decisões em Aberto

| Tema | Pergunta |
| :--- | :--- |
| Parcerias institucionais | Há caminho para parceria com Prefeitura/CET (Waze for Cities) ou acesso institucional a CEMADEN e SAISP? |
| Orçamento | Há verba para incidentes de tráfego comerciais (TomTom/HERE) e nowcasting (Tomorrow.io)? |
| Linguagem da peça | A peça pode exibir "alagamento provável" (inferido) com o mesmo destaque de uma ocorrência confirmada, ou ele deve ser visualmente intermediário? |
| Fonte de verdade | Quando o colaborativo (Waze/TomTom) e o CGE divergem, qual prevalece e por quanto tempo uma ocorrência sem confirmação permanece ativa? |
