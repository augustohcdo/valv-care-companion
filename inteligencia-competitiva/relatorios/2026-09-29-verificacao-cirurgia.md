# Verificação das informações de cirurgia valvar (mapa competitivo e panorama ANVISA)

**Posição em:** 2026-09-29. Objetivo: separar o que está confirmado em fonte primária do que continua hipótese, e registrar as correções. Níveis de fonte conforme `protocolo-de-verificacao.md`.

## 1. Correções (o que estava errado ou enganoso)

| # | O que estava escrito | Problema | Correção | Fonte |
| --- | --- | --- | --- | --- |
| 1 | Abbott **Trifecta GT** listado como produto ativo e como "validade a vigiar" | **A Abbott retirou e descontinuou toda a família Trifecta** (carta a clientes de 31/07/2023, após alerta da FDA de fevereiro de 2023 sobre deterioração estrutural precoce). O registro na ANVISA continua vigente (nº 81258750001, publicado em 14/02/2018, validade 14/02/2028). | **Registro vigente não significa produto comercializado.** Trifecta sai da lista de produtos ativos da Abbott. | [TCTMD](https://www.tctmd.com/news/abbott-stop-making-trifecta-surgical-aortic-valves) (nível 2), [MedTech Dive](https://www.medtechdive.com/news/abbott-pulls-trifecta-heart-valves-deterioration/689515/) (nível 2), [carta da Abbott a clientes, jul/2023](https://www.structuralheart.abbott/int/fileadmin/pdf/OUS-Abbott-Trifecta-Customer-Letter-July-2023.pdf) (nível 1, fabricante). Registro: cadastro ANVISA. 🟢 |
| 2 | "**Epic Max** (registro de fev/2026)" | Leitura enganosa: parece lançamento recente. A aprovação da FDA foi em março de 2023; o registro brasileiro só saiu em fev/2026. | Registrar as duas datas. | [Comunicado da Abbott, 30/03/2023](https://abbott.mediaroom.com/2023-03-30-Abbott-Receives-FDA-Approval-for-Epic-TM-Max-Tissue-Valve-to-Treat-Aortic-Valve-Disease) (nível 1); cadastro ANVISA (10332340525, publicação 02/02/2026). 🟢 |
| 3 | On-X: "estudo PROACT/LOWERING-IT" | "LOWERING-IT" **não foi verificado**. | Removido. Mantido só o PROACT. | Ver 2.4. |
| 4 | "Fabricantes asiáticos (ex.: Lepu, Jenscare)" e "Anteris ... relevância para cirurgia" | Escritos de memória, **sem verificação**. | Removidos do mapa. | n/d |
| 5 | Panorama: "o arquivo só mostra registros com validade em vigor" | Era inferência. Não há registros vencidos ou cancelados no arquivo, mas isso não prova que o cadastro exclui os cancelados. | Reescrito como inferência. | Cadastro ANVISA. |

## 2. Confirmado em fonte primária 🟢

### 2.1 FDA (banco PMA, via [openFDA](https://open.fda.gov/apis/device/pma/))
Consultas por nome comercial em `api.fda.gov/device/pma.json` (ex.: `search=trade_name:"INSPIRIS"`). openFDA é dado não validado pela FDA: para uso externo, conferir no banco PMA. As datas abaixo são as que aparecem nos registros.

| Produto | Empresa | PMA | O que o registro mostra |
| --- | --- | --- | --- |
| INSPIRIS RESILIA (aórtica) | Edwards | P150048 | Decisão em 29/06/2017; suplemento mais recente no banco: S101, 03/06/2026 |
| MITRIS RESILIA (mitral) | Edwards | P150048 | Decisão em 16/03/2022; suplemento mais recente: S099, 16/04/2026 |
| KONECT RESILIA (conduto aórtico valvulado) | Edwards | P150048 | Decisão em 10/07/2020; suplemento mais recente: S103, 29/07/2026 |
| EDWARDS INTUITY ELITE | Edwards | P150036 | Decisão em 12/08/2016; suplemento mais recente: S080, 29/07/2026 |
| PERIMOUNT / MAGNA | Edwards | P860057 | Família com suplementos até 29/07/2026 (S227) |
| AVALUS | Medtronic | P170006 | Decisão em 31/07/2017 (bate com a fonte de imprensa); suplemento mais recente: S045, 09/07/2026 |
| HANCOCK II / MOSAIC | Medtronic | P980043 / P990064 | Suplementos recentes (fev e mar/2026) |
| EPIC / Epic Max | Abbott | P040021 / P190023 | Suplemento de 18/09/2026 (S063) em P040021 |
| TRIFECTA | Abbott | P100029 | Decisão em 20/04/2011; **último suplemento em 14/12/2022**, coerente com a descontinuação |
| PERCEVAL | Corcym | P150011 | Decisão em 08/01/2016; suplemento em 22/12/2025 |
| SOLO SMART, MITROFLOW, CROWN PRT | Corcym | P130011, P060038 | Existem no banco. Mitroflow: 32 registros, último suplemento em 21/11/2019; um deles com código de decisão APWD (significado não confirmado por mim) |
| ON-X | On-X Life Technologies | P000037 | Decisão em 30/05/2001; suplemento mais recente: S071, 04/08/2026 |
| CARBOMEDICS, SJM MASTERS, OPEN PIVOT | Corcym, Abbott, Medtronic | P900060, P810002, P990046 | Existem no banco |

Observações: datas de "decisão" de produtos antigos (ex.: Hancock II) são de reemissões no banco, não do primeiro lançamento: não usar como data de estreia. Um suplemento recente mostra **atividade regulatória**, não necessariamente lançamento.

### 2.2 ANVISA (cadastro aberto, 29/09/2026)
Produtos, detentores, fabricantes, datas e validades do panorama vêm do arquivo oficial. **Auditoria da classificação cirúrgico/transcateter:** revisei os 79 nomes comerciais classificados como cirúrgicos. Nenhum parece transcateter. Casos de borda resolvidos:
- **Inovare SafeSync B-Delivery System (Braile, registro 10159030114)**: é **valva aórtica transcateter** balão-expansível, não cirúrgica, conforme o [site da Braile](https://braile.com.br/produto/safesync/) e o [registro ANVISA citado pela empresa](https://www.tavinobrasil.com.br/wp-content/uploads/2024/07/Catalogo_Protese-Valvular-Biologica-Inovare_SafeSync-28-06.pdf). Estava certo classificá-la como transcateter.
- **Melody** é válvula pulmonar transcateter (correto no segmento transcateter). **Allegra, Harmony, Venus A-Valve, VitaFlow, TricValve**: transcateter.
- Mantida a ressalva: a separação é por palavras-chave e pode errar; conferir linha a linha antes de citar.

### 2.3 Evidência e regulatório citados
- **On-X aórtica com INR 1,5 a 2,0**: aprovado pela FDA com base no ensaio randomizado PROACT (varfarina em INR reduzido mais aspirina 81 mg). Fontes: [resultados intermediários do PROACT, JTCVS/PubMed](https://pubmed.ncbi.nlm.nih.gov/24512654/) (nível 1) e [comunicado da On-X sobre a aprovação](https://www.onxlti.com/fda-approval-onx-aortic-less-warfarin/) (nível 1, fabricante). O "PROACT Xa" é outro estudo (apixabana em On-X aórtica) e não deve ser confundido. 🟢 para o PROACT; o resultado do PROACT Xa **não foi verificado por mim**.
- **Avalus**: FDA em 31/07/2017 (openFDA P170006, e [Cardiovascular News](https://cardiovascularnews.com/medtronics-avalus-pericardial-valve-receives-ce-mark-fda-approval/)). 🟢

## 3. Provável, mas só com fonte secundária ou parcial 🟡

| Afirmação | Situação | Fonte |
| --- | --- | --- |
| **Avalus Ultra** está aprovado nos EUA e na UE | Há página de produto da Medtronic e estudo pós-aprovação registrado; as datas e a aprovação específica **não foram confirmadas em fonte regulatória**. | [Página da Medtronic](https://www.medtronic.com/en-us/healthcare-professionals/products/cardiovascular/heart-valves/tissue-valves-conduits/avalus-ultra-bioprosthesis.html) (nível 1, fabricante, não confirma aprovação); agregador de ensaios (nível 3). |
| **Foldax TRIA** (válvula mitral de polímero): aprovada na Índia em jun/2025 e só investigacional nos EUA; dados de 1 ano em 67 pacientes | Vários veículos concordam, mas não li o comunicado da CDSCO nem o artigo do JACC. | [MDDI](https://www.mddionline.com/cardiovascular/foldax-spells-out-regulatory-plans-for-tria-surgical-heart-valve), [ClinicalTrials.gov NCT04717570](https://clinicaltrials.gov/study/NCT04717570) (nível 1, estudo). |
| **PERIMOUNT Theon RSR** (Edwards) como linha nova ou renomeada | O nome aparece no banco PMA (P150036, suplemento S079, 11/03/2026, código OK30, ou seja, aviso de alteração de 30 dias, **não** aprovação inicial) e no [AccessGUDID](https://accessgudid.nlm.nih.gov/devices/00690103177176). Lançamento comercial não confirmado. | openFDA e GUDID (nível 1), mas sem comunicado da empresa. |

## 4. Não verificado (continua hipótese ❓)

- Posições de mercado, participação e volumes por empresa (nenhuma fonte pública usada).
- Anéis Simulus, Physio, Cosgrove, Profile 3D, Tailor e Seguin **não aparecem no banco PMA** com esses nomes; podem estar em outra via regulatória. Não verifiquei.
- Status de descontinuação de cada modelo listado no cadastro da ANVISA (o caso Trifecta mostra que isso importa). **Os demais modelos podem ter o mesmo problema; só o Trifecta foi checado.**
- Mitroflow: status comercial atual (o último suplemento de FDA é de 2019; o significado do código APWD não foi confirmado).
- PROACT Xa e demais estudos de anticoagulação em ensaio.
- Tudo o que está marcado ❓ nas seções de transcateter do `mapa-competitivo.md`.

## 5. Método e reprodução
1. Cadastro ANVISA baixado em 29/09/2026 e processado por script; conferência manual nome a nome dos itens cirúrgicos.
2. openFDA `pma.json` por nome comercial, com data de decisão e suplementos.
3. Busca web por fonte primária ou fonte secundária confiável para cada afirmação de memória.
4. Onde a fonte não pôde ser aberta (site da ANVISA, texto completo de JTCVS e Annals), a afirmação ficou 🟡 ou ❓.

## 6. Como usar isto
Ao falar com clientes ou em material interno, usar somente as linhas 🟢. Tratar 🟡 como "provável, a confirmar". Não citar nada de ❓ como fato.
