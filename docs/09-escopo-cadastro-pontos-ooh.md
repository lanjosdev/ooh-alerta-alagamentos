# 09 — Escopo: Cadastro e Importação dos Pontos OOH da Campanha

> **Status:** Proposto — decisão fechada de que o cadastro/importação **vai existir** caso o projeto seja aprovado. A geração de imagem/vídeo no servidor fica registrada apenas como **evolução futura**.
> **Relacionados:** [03 — Escopo da PoC](./03-escopo-poc-player-dooh.md) · [04 — Vias Vizinhas](./04-escopo-alertas-vias-vizinhas.md) · [06 — Antialarmismo](./06-criterios-horizonte-e-antialarmismo.md) · [07 — GeoSampa](./07-avaliacao-geosampa-suscetibilidade.md) · [08 — Base Histórica](./08-escopo-base-historica-alagamentos.md)

Se o projeto for aprovado, a lista de pontos OOH participantes será enviada pela **exibidora (JCDecaux)**, para uma campanha publicitária do Itaú (informação de contexto, sem impacto técnico). Os responsáveis pela lista provavelmente **não são técnicos**. Este documento define como esses pontos chegam ao **mesmo nível de qualidade dos 7 pontos curados** da PoC, mantendo o esforço do cliente mínimo.

---

## 1. Princípios

- **O esforço do cliente é mínimo:** uma planilha simples, com 4 colunas obrigatórias, e uma conversa técnica única sobre o player.
- **A inteligência espacial fica do nosso lado:** via, pistas do corredor, vizinhas, apelidos, dados estáticos e câmera são produzidos pelo processo de importação.
- **Quem define a qualidade é o processo, não a origem do ponto:** catálogo, pontos importados e clique livre passam pelo mesmo serviço de preparação.

---

## 2. Como o Catálogo Curado é Gerado Hoje

- O script `backend/scripts/fetch-curated-geometries.ts` (`npm run fetch:curated-geometries`) parte de **sementes escritas à mão**. Para cada ponto, alguém definiu o filtro por nome das vias a incluir, quais delas são a via alvo, os **apelidos** para o CGE e a **câmera**. O script baixa as vias do OSM num quadrado de ~1,5 km e grava o snapshot em `curated-ooh-geometries.ts`.
- O repositório (`InMemoryOohAssetRepository`) valida o catálogo com Zod e **exige exatamente 7 ativos** (`.length(7)`).
- **O contrato está pronto** (`OohAssetRepository` / `OohAsset`), mas **o julgamento humano embutido nas sementes não escala** para dezenas ou centenas de pontos.

---

## 3. O que Pedir ao Cliente

### 3.1 Separar comercial de técnico

| Tipo | Quem responde | Frequência |
| :--- | :--- | :--- |
| **Lista de pontos** (quais telas participam) | Atendimento / mídia da exibidora ou da agência | Por campanha, com atualizações |
| **Perguntas sobre o player** (HTML5 ou só imagem/vídeo, CMS, forma de entrega, resolução) | Equipe técnica / operações da exibidora | Uma vez (em geral, padrão para toda a rede) |

### 3.2 Planilha — colunas obrigatórias

| Campo | Exemplo | Por quê |
| :--- | :--- | :--- |
| **Código do ponto** (o que a exibidora já usa) | `SP-1234` | Identificação e atualizações sem duplicar. |
| **Endereço com referência** | "Av. Roberto Marinho, 1500, em frente ao nº 1480" | Localização e conferência da coordenada. |
| **Latitude e longitude** | `-23.6180, -46.6838` | Precisão. Exibidoras grandes costumam ter no cadastro de inventário **(a confirmar)**; se faltar, o endereço preciso basta. |
| **Formato da tela** | `vertical` / `horizontal` | Define o layout (`9:16` / `16:9`). |

### 3.3 Planilha — colunas desejáveis

| Campo | Como pedir em linguagem simples |
| :--- | :--- |
| **Para quem a tela está virada** | "A tela é vista por quem vai sentido Centro ou sentido bairro?" ou "de frente para qual rua?" |
| **Tipo de mídia** | `imagem` / `vídeo` (todas as telas são digitais). Pode vir da conversa técnica, se for padrão da rede. |
| **Resolução, duração do slot, formatos aceitos** | Idem: preferencialmente da conversa técnica. |
| **Foto do local** | Ajuda a confirmar via e sentido na revisão. |

### 3.4 Cuidados práticos

- **Modelo de planilha (Excel)** com colunas fixas, listas de opções e uma linha de exemplo preenchida.
- **Mobiliário com duas faces digitais** (ex.: abrigo de ônibus): cada face pode ser vista por um sentido diferente e deve ser tratada como **um ponto por face**. Perguntar explicitamente.
- **Coordenadas imprecisas** (sede, centro do quarteirão) são detectadas na importação e marcadas para revisão.
- **Fluxo de ida e volta:** a importação devolve uma **lista curta de pendências** em linguagem simples (ex.: "o ponto SP-1234 está a 200 m do endereço informado; qual está certo?").
- **Atualizações durante a campanha** (pontos que entram ou saem) usam o código do ponto como chave.

---

## 4. Processo de Importação (do nosso lado)

| Etapa | O que faz |
| :--- | :--- |
| **1. Importar e validar** | Validação com Zod, remoção de duplicados e conferência coordenada × endereço (geocodificação reversa). Gera o relatório de pendências. |
| **2. Ancorar na via** | Encaixe na via mais próxima **pela distância até a linha** (limite ~30 m, mesmo critério dos 7 pontos), usando a face/sentido da tela para escolher via e sentido. Agrupa as **pistas do mesmo corredor** como via alvo. |
| **3. Extrair vias** | Snapshot das vias OSM no raio de influência ([docs/04](./04-escopo-alertas-vias-vizinhas.md)), **sem filtro por nome**, incluindo as vizinhas. Em volume, processar um **extrato local do OSM de SP** (Geofabrik) em vez da API pública do Overpass. |
| **4. Gerar apelidos** | **Tabela global de apelidos** (números por extenso, abreviações, títulos) + nomes de via que a CGE já usou nos arredores ([docs/08](./08-escopo-base-historica-alagamentos.md)). |
| **5. Enriquecer** | Snapshot GeoSampa (manchas 5/25/100), zona e estação CGE, subprefeitura, pontos crônicos próximos e peso histórico calculado ([docs/07](./07-avaliacao-geosampa-suscetibilidade.md), [docs/08](./08-escopo-base-historica-alagamentos.md)). |
| **6. Câmera automática** | Centro no ponto, rotação alinhada à via ou à face da tela, zoom proporcional ao raio. Ajuste manual só quando necessário. |
| **7. Revisão humana** | Modo de revisão na aplicação, mostrando a peça de cada ponto em sequência, com status **rascunho → revisado → publicado** e alertas para casos ambíguos (encaixe incerto, via sem nome, nenhuma vizinha). |
| **8. Publicar** | Inicialmente, JSON versionado por campanha (validação sem o limite de 7). Na Fase 2, PostGIS, como previsto no [docs/03](./03-escopo-poc-player-dooh.md), mantendo o contrato do repositório. |
| **9. Manter** | Atualização periódica do OSM, revalidação dos pontos e histórico de versões por ponto. |

**Impactos no frontend:** o contador fixo "Pontos OOH (7)" passa a ser dinâmico, o Mapa Explorador precisa de **agrupamento de marcadores** e a lista de pontos precisa de busca.

### 4.1 Paridade com o clique livre

As etapas 2 a 6 devem formar **um serviço único**. O **clique livre usa o mesmo serviço, sem a revisão humana**. Isso elimina por construção a diferença atual entre catálogo e clique livre (seção 5), que passa a ser apenas "revisado" × "automático".

---

## 5. Diagnóstico: Diferença Atual entre Catálogo e Clique Livre

A **decisão de risco é calculada da mesma forma** nos dois casos (`GetPlayerSceneService` sempre chama a análise por coordenada, e o frontend envia os mesmos parâmetros de cenário). A diferença está em **quais vias são carregadas e qual é a via alvo**:

| Aspecto | Catálogo | Clique livre |
| :--- | :--- | :--- |
| **Origem das vias** | Snapshot local fixo | Overpass ao vivo (raio `300 m`, limite `8 s`). Falha = zero vias, sem mancha; bloqueio de `30 s` para novos cliques fora do cache. |
| **Via alvo** | Curada à mão, com todas as pistas do corredor | `markNearestStreetAsPrimary`: um único nome, pelo **vértice** mais próximo (não pela linha). Pode escolher transversal, alça ou pista paralela. |
| **Vias sem nome** | Excluídas no snapshot | Viram "Via sem nome"; se o vértice mais próximo for uma alça sem nome, **todas as alças sem nome** viram via alvo, enquanto o título cita a avenida. |
| **Apelidos para o CGE** | `aliases` por ativo | Nenhum. Ex.: OSM "Avenida Vinte e Três de Maio" × CGE "Av. 23 de Maio" não casam, e uma ocorrência real deixa de acender a via. |
| **Câmera** | Fixa e curada | Ajustada às vias do raio de 300 m. |

---

## 6. Evolução Futura: Geração de Imagem/Vídeo no Servidor (Fora de Escopo)

Registrado apenas como possibilidade, caso os players da exibidora não aceitem HTML5. Hoje o projeto entrega a peça como **HTML5 ao vivo** e os dados como JSON/RSS, sem mídia anexada. O [docs/02](./02-pesquisa-stack-e-fontes-dados.md) (Camada 5) já previa um renderizador `Playwright + FFmpeg`.

- **Renderização por mudança de estado:** assinatura do estado da cena por ponto (nível, vias afetadas, textos); só renderiza de novo quando ela muda.
- **Imagem:** quadro estático. Sem animação, o template precisa comunicar com cor, espessura e legenda (linguagem visual de dois eixos do docs/04).
- **Vídeo:** loop sem corte, na resolução e duração de cada ponto.
- **Publicação:** URL estável por ponto (ex.: `/v1/player/assets/{id}/media`) via CDN e feed MRSS com a mídia anexada.
- **Antialarmismo (obrigatório se implementado):** imagem/vídeo fica na tela até ser trocado. Cada peça precisa de **data de validade explícita** (feed e cabeçalho HTTP), **horário de atualização impresso** e definição do estado "sem risco" (campanha normal ou nada) — ver [docs/06](./06-criterios-horizonte-e-antialarmismo.md).
- **Custos:** renderização WebGL headless exige GPU ou renderização por software; dimensionar pelo pior caso (evento de chuva mudando muitos pontos ao mesmo tempo).

---

## 7. Decisões em Aberto

| Tema | Pergunta |
| :--- | :--- |
| Volume | Dezenas ou centenas de pontos? Define se a revisão ponto a ponto é viável. |
| Capacidade do player | Os players da exibidora aceitam HTML5 + WebGL + rede aberta, ou só imagem/vídeo via CMS? |
| Precisão dos dados | A exibidora tem coordenadas e sentido/face das telas no cadastro de inventário? |
| Revisão | Quem revisa os pontos e qual o prazo entre receber a lista e publicar? |
| Persistência | JSON versionado na primeira campanha ou PostGIS desde o início? |

---

## 8. Critérios de Aceite (Propostos)

- [ ] Existe um modelo de planilha com as 4 colunas obrigatórias, as desejáveis, listas de opções e exemplo.
- [ ] A importação valida a planilha e gera um relatório de pendências em linguagem simples.
- [ ] Cada ponto importado é ancorado à via pela distância até a linha, com as pistas do corredor agrupadas, vizinhas incluídas e apelidos gerados.
- [ ] Pontos importados passam por revisão (rascunho → revisado → publicado) antes de ir ao ar.
- [ ] O repositório aceita qualquer quantidade de pontos, mantendo o contrato `OohAssetRepository`.
- [ ] O clique livre usa o mesmo serviço de preparação, e um ponto importado e um clique livre no mesmo local produzem a mesma via alvo e as mesmas vizinhas.
- [ ] O Mapa Explorador suporta a quantidade de pontos (contador dinâmico, agrupamento e busca).
- [ ] Os gates obrigatórios do `backend/` e do `frontend/` passam com código de saída `0`.
