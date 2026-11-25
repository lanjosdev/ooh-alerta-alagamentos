# 01 — Análise do Briefing e Viabilidade Técnica (*Anti-Flood Ads*)

Este documento registra o estudo técnico da apresentação **Itaú Seguros — Anti-Flood Ads** (Africa Creative — Ideias Cannes 2026–2027), avalia o nível de alinhamento com o repositório `ooh-alerta-alagamentos` atual e detalha a viabilidade técnica de cada frente proposta.

---

## 1. Síntese da Apresentação (PDF — 16 Slides)

A proposta posiciona os ativos OOH/DOOH do **Itaú Seguros** como uma **infraestrutura pública de informação preditiva geolocalizada** contra alagamentos urbanos (contextualizada no alerta de Super El Niño entre nov/2026 e jan/2027), destacando inclusive no **Slide 16** o teste inicial conduzido pela Bizsys (*"Testes em andamento - BisSys: Mapeamento de OOHs vs. Áreas com histórico de enchentes em SP"*).

| Bloco do Briefing | Slides | Expectativa / Entregável Apresentado |
| :--- | :---: | :--- |
| **Proposta de Valor** | 1–6, 15 | Transformar telas OOH/DOOH do Itaú (metrô, aeroportos, shoppings, passarelas e mobiliário urbano JCDecaux/NEOOH) em pontos dinâmicos de alerta preditivo onde decisões de mobilidade acontecem, incluindo sugestão de rotas de fuga. |
| **Cruzamento de Dados** | 3, 5, 8 | Cruzamento em tempo real de 4 pilares de dados públicos/abertos: **(1) Geografia urbana** (GeoSampa, MDE, topografia, bacias, rios ocultos, drenagem); **(2) Clima & Chuva** (Radar CGE, Telemetria CEMADEN, INMET, Defesa Civil, modelos NOAA & ECMWF); **(3) Mobilidade & Tráfego** (SPTrans, CET, feeds da Prefeitura, Google Maps); **(4) Histórico de enchentes** (CGE, manchas da Prefeitura, Defesa Civil). |
| **Player Criativo DOOH Generativo** *(frente protagonista)* | 7, 9–12 | Template HTML5 responsivo com partes fixas (cabeçalho editorial, marca, local do OOH, janela *"High flood risk in 30 min"*, selo `Data CGE / CEMADEN • REAL-TIME • ATUALIZADO AGORA`) e **mapa vetorial com mancha de enchente generativa em *play/motion*** desenhada automaticamente sobre a geometria real da rua via **OSM + QGIS/PostGIS + MapLibre + deck.gl** (sem arte manual por local). |
| **Extensão Mobile & WhatsApp** | 13–14 | **1.** QR Code no ativo OOH/NEOOH → **2.** WebApp (`itau.antiflood.com.br`) no mapa da região sem app e sem cadastro → **3.** Usuário informa destino (Google Maps) e WhatsApp → **4.** Monitoramento contínuo do trajeto com alertas personalizados no WhatsApp antes da água. |
| **Mapeamento de Inventário** | 16 | Sobreposição de ativos OOH reais com áreas de histórico de enchentes em São Paulo (*Testes em andamento - BisSys*). |

> **Observação de protagonismo:** O **Player Criativo DOOH com mapa generativo da região do ponto** concentra o maior peso narrativo e visual da apresentação (6 de 16 slides dedicados diretamente a ele). Além disso, a mesma engine cartográfica/generativa do player é reaproveitada na tela mobile e nos cards do WhatsApp (Slide 14).

---

## 2. Matriz de Alinhamento: Estado Atual do Repositório vs. Briefing

**Veredito executivo:** o projeto atual está bem posicionado como **Fase 1 (fundação do motor de dados, decisão de risco e distribuição resiliente para DOOH)**, cobrindo cerca de **25% a 30%** do escopo total da visão do PDF. A arquitetura desacoplada em 4 camadas + provedores plugáveis do backend permite evoluir sem reescrever o core.

| Dimensão | Status Atual | O que o projeto já entrega | Lacuna em relação ao PDF |
| :--- | :---: | :--- | :--- |
| **Ingestão, Cache & Resiliência DOOH** | **Alinhado** | Backend Fastify v5 + Zod com `Promise.allSettled`, cache TTL + *stale fallback*, modo simulação (`cgeDate`, `simulate`), JSON (`ApiResponse<T>`) e RSS 2.0 (`<ooh:*>`). | Evoluir payload para entregar também **geometrias GeoJSON** de trechos viários marcados para o player gráfico (não apenas textos `headline/message/subtext`). |
| **Fontes de Clima & Alagamentos** | **Parcial (Boa base)** | Integra **Open-Meteo** (grade ECMWF ~9 km), **INMET** (IBGE + *point-in-polygon* GeoJSON) e **CGE-SP** (pontos de alagamento ativos/intransitáveis + 28 estações). | Faltam **CEMADEN** (citado no selo `CGE/CEMADEN`), **Defesa Civil**, **Radar CGE** e provedor de **nowcasting sub-horário** (5–30 min) para sustentar *"High flood risk in 30 min"*. |
| **Geografia Urbana & Granularidade de Via** | **Lacuna Crítica** | Motor de risco agrega alagamentos por **zona macro** (`Zona Oeste`, `Zona Sul`, etc.). Pontos do CGE são strings (`street`, `reference`), sem `lat/lon` ou geometria viária. | Exige precisão no **trecho exato da rua** (ex.: *Av. Roberto Marinho*, *Marginal Pinheiros*), integrando malha **OSM**, **GeoSampa** (manchas históricas, cotas baixas, hidrografia) e *map-matching* dos pontos do CGE. |
| **Inventário OOH & Escala Nacional** | **Preparado / Mockado** | Catálogo inicial de 12 regiões em memória (`in-memory-region-repository.ts`), mas `/by-coordinates` já funciona nacionalmente (Open-Meteo + INMET) e a arquitetura já prevê importação real + *spatial clustering*. | Substituir o catálogo fixo por ativos OOH reais (planilha/PostGIS) — ou, antes do inventário chegar, por pontos OOH simulados curados + seleção livre. |
| **Player Criativo DOOH (MapLibre + deck.gl)** | **Lacuna Crítica** | `frontend/` atual é um **dashboard operacional interno** em **Leaflet** + tiles raster OSM com pins circulares. | Construir a **peça criativa HTML5 responsiva** com **MapLibre GL + deck.gl** e mancha de enchente animada sobre a geometria da via. |
| **Mobilidade, Tráfego & Rotas de Fuga** | **Lacuna Crítica** | Mensagens apenas sugerem textualmente *"busque rotas alternativas"*. | Não consome dados de tráfego (CET/SPTrans/Google) nem calcula desvios/rotas de fuga. |
| **Jornada QR Code → WebApp → WhatsApp** | **Lacuna Crítica** | Inexistente no repositório atual. | Exige QR Code dinâmico por tela, WebApp mobile com rota, cruzamento `polyline × áreas em risco` e integração WhatsApp Cloud API. |

---

## 3. Avaliação de Viabilidade Técnica: O que é Real vs. Incerto no PDF

A ideia central da campanha é **tecnicamente viável**, mas alguns pontos da apresentação simplificam restrições reais de dados públicos no Brasil, termos de uso de APIs e infraestrutura de mídia OOH.

### 3.1 Totalmente Viável (Baixo Risco)
- **Cruzamento geoespacial de OOHs com histórico de enchentes (Slide 16):** camadas oficiais do GeoSampa + PostGIS/GeoJSON.
- **Mancha generativa automática sobre a geometria real da rua (Slide 12):** OSM + MapLibre GL + deck.gl (um único estilo paramétrico aplicado a qualquer segmento marcado pelo dado, sem arte manual).
- **Motor resiliente com CGE-SP + INMET + previsão meteorológica:** já validado ao vivo neste repositório.
- **Interseção de rotas com polígonos/trechos em risco + envio de recorte de imagem do mapa no WhatsApp** (quando entrar a fase mobile).

### 3.2 Viável com Adaptações Arquiteturais Importantes
1. **Lista de 18+ fontes "públicas e abertas em tempo real" (Slide 8):**
   - **GeoSampa (MDE, drenagem, rios ocultos, manchas)** existe e é aberto (WFS/downloads), mas é **camada estática** de suscetibilidade e **cobre apenas a Capital SP** (não é nacional).
   - **CEMADEN** possui dados públicos, mas **não oferece API REST pública documentada** com SLA aberto — requer acesso institucional/convênio ou consumo indireto.
   - **CET, Defesa Civil (ocorrências por endereço) e Radar CGE vetorial bruto** não possuem APIs abertas padronizadas em tempo real.
   - **Google Maps Traffic** não pode ser extraído ou cruzado em banco próprio (violação direta dos Termos de Serviço da Google Maps Platform).
   - **Direcionamento realista:** operar com um **núcleo confiável de 5 a 6 fontes** (OSM + GeoSampa/DEM estáticos, CGE-SP, INMET, CEMADEN institucional e 1 API comercial de nowcasting) em vez de prometer 18 integrações simultâneas.

2. **Hardware e CMS das Exibidoras DOOH (Slides 7, 9 e 11):**
   - Muitos players de rua (JCDecaux, NEOOH, mobiliário urbano) rodam em hardware embarcado sem WebGL fluido ou sem rede livre para *vector tiles*.
   - **Mitigação viável:** suportar **HTML5 + WebGL ao vivo** em players modernos e, quando necessário em produção, adicionar um **renderizador server-side (`Playwright + FFmpeg`)** que gera loops `.mp4` de 10–15 s sob demanda quando o risco muda e publica via CMS/feed.

3. **Rotas de Fuga no Google Maps (Slides 6 e 14 — fase futura):**
   - A Google Maps Routes API permite obter a *polyline* da rota (e checar no PostGIS se cruza área alagada), **mas não suporta `avoid_polygons` customizados** para recalcular desvios ao redor de polígonos arbitrários.
   - Para cálculo real de rotas de fuga evitando manchas de alagamento, será necessário um motor que suporte polígonos de exclusão (como **Valhalla**, **OpenRouteService** ou **HERE Routing API**).

4. **Ativação de WhatsApp "sem cadastro" (Slide 14 — fase futura):**
   - Pedir para o usuário digitar o telefone em formulário web aberto gera risco de spam/abuso em nome do Itaú e força envio de *templates* pagos pela Meta.
   - **Solução recomendada:** substituir o campo de telefone por **deep link `https://wa.me/...`** pré-preenchido (comprova opt-in LGPD, autentica o número automaticamente, abre a janela de 24h da Meta e reduz custo), mantendo descarte automático após 3h.

### 3.3 Ponto Mais Sensível / Incerto (Alinhamento Obrigatório)
- **Promessa determinística de *"High flood risk in 30 min"* por rua específica:**
  - Nenhum órgão público brasileiro fornece previsão hidrológica determinística rua-a-rua com 30 minutos de antecedência.
  - O que é **cientificamente defensável e viável em software** é um **índice preditivo probabilístico hiperlocal**, combinando:
    1. Suscetibilidade estática da via (cota baixa + histórico de enchentes / GeoSampa);
    2. *Nowcasting* sub-horário (5–15 min via API comercial com radar, como Tomorrow.io) + taxa de precipitação recente em pluviômetros próximos (CGE/CEMADEN);
    3. Confirmação em tempo real de alagamento já reportado na via/entorno (CGE-SP).

---

## 4. Checklist de Validação para Alinhamento com Agência / Exibidoras / Cliente

Antes de estimar custo e prazo da fase de **produção comercial**, validar:

- [ ] **Escopo geográfico inicial:** piloto restrito à **Capital SP** (GeoSampa + CGE-SP) ou já nasce multi-cidade/nacional?
- [ ] **Capacidade dos players OOH contratados:** aceitam **HTML5 + WebGL + rede aberta** ou exigem **vídeo MP4 / imagem via CMS**?
- [ ] **Orçamento de APIs comerciais:** há verba prevista para provedor de *nowcasting* (ex.: Tomorrow.io), hospedagem de *vector tiles* (Protomaps/Mapbox) e, na fase mobile, WhatsApp Cloud API / motor de roteamento?
- [ ] **Nível de exigência de "rotas de fuga":** basta alertar trechos em risco na rota (mobile) ou precisa recalcular desvios com `avoid_polygons`?
- [ ] **Governança e AppSec Itaú:** onde ficarão hospedados domínio, credenciais e tráfego de dados pessoais (LGPD na fase mobile/WhatsApp)?
