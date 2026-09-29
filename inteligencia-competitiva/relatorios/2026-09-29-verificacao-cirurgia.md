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

---

# Fase 2: descontinuação, recalls e alertas por família (29/09/2026)

**Método.** (1) openFDA `recall.json`, buscando cada nome comercial do cadastro da ANVISA na descrição do produto; (2) busca web por descontinuação e comunicados de segurança por fabricante; (3) leitura das fontes que abriram. **Limites:** o openFDA cobre só recalls dos EUA, e a busca é por palavras na descrição, então **ausência de recall não prova ausência de problema**; os alertas da ANVISA (`antigo.anvisa.gov.br`) deram 403 para leitura direta, então os alertas brasileiros abaixo vêm de resumos de busca ou de sites secundários (🟡).

## A. Achados por família

| Família (marca) | Descontinuada? | Recalls e comunicados de segurança encontrados | Situação |
| --- | --- | --- | --- |
| **Abbott Trifecta / Trifecta GT** | **Sim, em 2023** | Alerta da FDA (fev/2023) sobre deterioração estrutural precoce; carta da Abbott (31/07/2023) | 🟢 [FDA: carta aos profissionais](https://www.fda.gov/medical-devices/letters-health-care-providers/abbott-trifecta-valves-potential-risk-early-structural-valve-deterioration-letter-health-care) e fontes da Fase 1. Registro na ANVISA ainda vigente. |
| **Artivion On-X (mitral com anel Conform-X)** | Não | **Recall aberto, iniciado em 01/02/2026**: válvulas liberadas e distribuídas antes de concluídos todos os testes exigidos. **10 unidades, distribuídas à Coreia do Sul** segundo o registro. Causa "em investigação pela empresa". Status "Open, Classified". A ação foi pedir ao cliente que colocasse em quarentena. | 🟢 openFDA (`res_event_number` 98548), conferir no [banco de recalls da FDA](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRES/res.cfm). Nenhuma outra fonte independente foi encontrada. Não há indício de que atinja o Brasil, **mas isso não foi verificado**. |
| On-X (aórtica e demais) | Não | Recalls por erro de rotulagem em 2014, 2015 e 2019 (2019: 2 unidades, número de série errado; terminado em jun/2020) | 🟢 [FDA, recall 170731](https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfres/res.cfm?id=170731) e openFDA. |
| On-X e o anticoagulante apixabana (PROACT Xa) | n/a | **Estudo interrompido em 23/09/2022** por recomendação do comitê independente de segurança: eventos de coágulo com AVC foram mais frequentes com apixabana do que com varfarina. | 🟢 [Comunicado da Artivion](https://www.prnewswire.com/news-releases/artivion-follows-recommendation-to-stop-proact-xa-clinical-trial-301631774.html) (fabricante, nível 1). Isso resolve a dúvida que ficou aberta na Fase 1. |
| **Corcym Carbomedics** (válvulas e próteses Carbo-Seal / Carbo-Seal Valsalva) | Não encontrada | **Aviso de segurança REC-000703, datado de 17/01/2025**: motivo "espessura do folheto fora da especificação"; produtos listados no Anexo A a devolver. Fonte: modelo do aviso hospedado pelo regulador holandês. Li só o cabeçalho e o motivo; **não li a parte sobre pacientes já implantados**. | 🟢 para a existência e o motivo ([aviso no site da IGJ](https://www.igj.nl/site/binaries/site-content/collections/documents/2025/01/22/corcym-s.r.l.-rec-000703-carbomedics-prosthetic-heart-valves-and-carbomedics-carbo-seal-and-carbo-seal-valsalva-ascending-aortic-prostheses/IT210457-Corcym+S.r.l.-REC-000703-Carbomedics+Prosthetic+Heart+Valves+and+Carbomedics+Carbo-Seal+and+Carbo-Seal+Valsalva+Ascending+Aortic+Prostheses_Geredigeerd.pdf)); 🟡 para o alcance. Nenhum recall nos EUA. Impacto no Brasil não verificado. |
| **Corcym Perceval** | Não | Ação de campo nos EUA em 31/10/2016 (passos do implante); acessórios "Dual Collapser" em 29/07/2020 (queixas de impossibilidade de colapsar a válvula). No Brasil, alerta de 07/12/2016 (nº 2026, ação FSCA-HV-2016-001) sobre técnica cirúrgica, com risco de mau posicionamento, regurgitação perivalvular e marca-passo permanente. | 🟢 FDA (openFDA). 🟡 alerta brasileiro (fonte: [resumo do Grupo IBES](https://www.ibes.med.br/tecnovigilancia-anvisa-valvula-cardiaca-alerta-de-seguranca-com-foco-na-tecnica-cirurgica/), secundária). O registro citado no alerta (80483300010, detentor Alcard) **não está no cadastro atual**; o Perceval hoje aparece sob a VR Medical. |
| Corcym Mitroflow, Solo Smart, Crown PRT, Bicarbon, Pericarbon | Não encontrada | Nenhum recall no openFDA | 🟡 ausência de achado. Mitroflow: status comercial ainda não esclarecido. |
| **Medtronic Hancock II e Mosaic (mitral)** | Não encontrada | Recall de 21/05/2019: 15 unidades distribuídas no mundo com **rótulo de tamanho errado** (as válvulas em si estavam corretas). Recall antigo de 2009 (válvulas com Cinch distribuídas por engano). Também mudança de material do stent (acetal → PEEK) porque o fornecedor descontinuou o acetal, descrita no protocolo do estudo NCT03139721. | 🟢 openFDA e [protocolo do estudo](https://cdn.clinicaltrials.gov/large-docs/21/NCT03139721/Prot_000.pdf). Página de produto do Hancock II segue no site da Medtronic. |
| Medtronic Open Pivot | Não encontrada | Recall de 11/02/2020: caixa rotulada como aórtica com produto mitral (reclamação da China); 2004: prótese colocada invertida no suporte | 🟢 openFDA. |
| Medtronic Simulus (anéis) | Não encontrada | Recall de 14/01/2020: kits **dimensionadores de demonstração** enviados a clientes por engano (não o anel implantável) | 🟢 openFDA. |
| Medtronic Avalus | Não encontrada | Nenhum recall no openFDA | 🟡 ausência de achado. |
| **Edwards** Inspiris, Mitris, Konect, Perimount/Magna, Intuity Elite | Não encontrada | **Nenhum recall no openFDA** para esses nomes. Intuity Elite consta como "em distribuição comercial" no FDA AccessGUDID. Páginas de produto de Intuity e Magna Ease/Magna Mitral Ease existem no site da Edwards. | 🟡 ausência de achado + 🟢 status no GUDID ([AccessGUDID: Intuity Elite](https://accessgudid.nlm.nih.gov/devices/00690103194562)). Não implica que nunca haverá problema. |
| Abbott Epic, Epic Plus, Epic Max, Masters, Regent | Não encontrada | Nenhum recall no openFDA. Epic Plus aprovado pela FDA em set/2021 (comunicado da Abbott). Masters e Regent seguem no site da Abbott. | 🟡 ausência de achado; 🟢 [aprovação Epic Plus](https://abbott.mediaroom.com/2021-09-22-FDA-Approves-Abbotts-Epic-TM-Plus-Tissue-Valves-for-People-in-Need-of-Mitral-or-Aortic-Valve-Replacement). |
| Artivion CryoValve SG (homoenxerto pulmonar humano) | Não | 2024: recalls por resultados de teste inválidos (28/05/2024) e por doador com cultura positiva para *Staphylococcus aureus* (06/03/2024) | 🟢 openFDA. Relevante para Ross e cirurgia pulmonar. |
| **Cardioprótese Ltda** (bioprótese de pericárdio bovino, Brasil) | Não encontrada | **Alerta ANVISA nº 3671**, recolhimento decidido pela ANVISA; notificação em 13/10/2021 (código de ação de campo 80166). O registro (nº 10263870001, publicado em 1996) segue vigente até 01/11/2036 no cadastro. | 🟡 resumo de busca do próprio site da ANVISA (página deu 403). Outro caso de **registro vigente após recolhimento**. |
| Labcor, Braile (cirúrgicas), Meril Dafodil, anéis Physio, Cosgrove, McCarthy-Adams, Contour 3D, CG Future, Profile 3D, Seguin, Tailor, Duran, Tri-Ad | Não pesquisado a fundo | Nenhum recall no openFDA (anéis podem estar registrados na FDA sob outra descrição). Sem busca de descontinuação. | ❓ **Não verificado.** |

## B. Uma pista sobre o cadastro da ANVISA

O **Acurate neo2** (transcateter, Boston Scientific) teve alerta da ANVISA (nº 4909) informando que a empresa decidiu descontinuar a comercialização mundial. O cadastro atual **não contém nenhum registro de válvula da Boston Scientific**. Isso sugere que o arquivo aberto exclui registros cancelados, e que por isso o Trifecta (cujo registro ainda está lá) segue vigente por a empresa não ter cancelado. É inferência 🟡, baseada em um único caso (o alerta veio de resumo de busca; página da ANVISA deu 403).

## C. O que isso muda para o uso
- Para cada linha de "registro vigente" no panorama, a resposta a "está à venda?" continua sendo **desconhecida**, salvo Trifecta (descontinuado). Pergunte ao fabricante ou ao distribuidor.
- Recalls encontrados são, em sua maioria, de **rotulagem, acessórios e amostras de demonstração**, não de falha do implante. Exceções a ler com atenção: Carbomedics (espessura de folheto, 2025), Perceval (técnica, 2016) e On-X mitral (testes incompletos, 2026, 10 unidades).
- O recall On-X e o aviso Carbomedics **não têm confirmação de impacto no Brasil**. Recomendo consultar o setor de assuntos regulatórios ou o distribuidor local (Jotec para On-X; VR Medical para Corcym) e a Tecnovigilância da ANVISA.

## D. Ainda em aberto
Resolvido ou reclassificado na Fase 3, abaixo.

---

# Fase 3: pontos em aberto (29/09/2026)

## 1. Aviso Carbomedics (Corcym), lido por inteiro
**Correção (Fase 4, abaixo):** a versão da IGJ é editada e curta, mas a versão hospedada pela HPRA (Irlanda) traz o texto completo; o que vem a seguir descreve a versão da IGJ. O conteúdo completo está na Fase 4. A versão da IGJ contém só: referência REC-000703, data 17/01/2025, produtos (válvulas protéticas Carbomedics e próteses Carbo-Seal e Carbo-Seal Valsalva), "motivo: espessura do folheto fora da especificação", a carta introdutória (os dispositivos do Anexo A foram enviados ao seu serviço; ação corretiva de campo da Corcym S.r.l.) e a nota "o restante do aviso detalha o que motivou a ação e o que fazer". **Não há no documento público** o risco clínico, os lotes, nem orientação sobre pacientes já implantados. 🟢 para o que está escrito; **o alcance real continua desconhecido** e só o fabricante, o distribuidor (VR Medical) ou a Tecnovigilância podem informar. Isso substitui a ressalva "li só o cabeçalho".

## 2. Alertas da ANVISA (nº 3671 e nº 4909), na fonte original
**Não foi possível ler.** O portal antigo (`antigo.anvisa.gov.br`) devolve apenas a casca do portal e o sistema `anvisa.gov.br/sistec` responde com bloqueio da Cloudflare (403). Alternativas usadas:
- **Acurate neo2 (alerta 4909): confirmado em fonte primária alternativa.** A Boston Scientific comunicou à SEC em **28/05/2025** que "está descontinuando as vendas mundiais dos sistemas ACURATE neo2 e ACURATE Prime e não buscará mais a aprovação da FDA", citando exigências clínicas e regulatórias crescentes ("prohibitive" o investimento adicional). 🟢 [Formulário 8-K na SEC](https://www.sec.gov/Archives/edgar/data/885725/000088572525000033/bsx-20250528.htm). Segundo veículos especializados, o anúncio veio menos de uma semana depois de o estudo ACURATE IDE não atingir a não inferioridade frente ao Evolut da Medtronic 🟡 ([MassDevice](https://www.massdevice.com/boston-scientific-discontinues-acurate-tavr-sales-cites-regulatory-burden/)). Não li o resumo do estudo.
- **Cardioprótese (alerta 3671): detalhe só por resumo de busca do próprio site da ANVISA 🟡.** Segundo o resumo, o recolhimento foi determinado pela **Resolução RE nº 1.978, de 14/05/2021**, após inspeção sanitária na empresa em 18 a 22/01/2021 que apontou fabricação em desacordo com exigências da RDC; modelos **Bioprótese de Pericárdio Bovino Premium Mitral e Premium Aórtica**; ação: devolução ao fabricante. Página original não lida. O registro nº 10263870001 segue vigente no cadastro até 01/11/2036.

## 3. Status comercial por família (o que pude apurar)

| Família | Resultado | Confiança |
| --- | --- | --- |
| **Corcym Mitroflow** | Uma revisão em periódico revisado por pares descreve o Mitroflow como **descontinuado e substituído pelo Crown PRT** ([MDPI, J Clin Med 2023](https://www.mdpi.com/2077-0383/12/22/7063)). O FDA ainda mantém o PMA P060038 (último suplemento em 2019), e o registro brasileiro foi publicado em 06/02/2023 (validade 2036). Não achei comunicado da Corcym confirmando. | 🟡 |
| **Edwards Physio II e Physio Flex** | Constam "em distribuição comercial" no FDA AccessGUDID (registro do Physio II de ago/2023); o Physio Flex tem estudo clínico recente (pacientes tratados até abr/2024). Fontes: [GUDID Physio II](https://accessgudid.nlm.nih.gov/devices/00690103180183), [GUDID Physio Flex](https://accessgudid.nlm.nih.gov/devices/00690103206180). | 🟢 status; sem achado de descontinuação |
| Edwards Cosgrove e McCarthy-Adams (IMR ETlogix) | Nenhuma informação de descontinuação, **nem** de disponibilidade atual. O registro brasileiro do McCarthy-Adams vence em 18/02/2028. | ❓ |
| **Medtronic Profile 3D, Contour 3D, CG Future** | Páginas de produto ativas no site da Medtronic. Simulus e Duran AnCore aparecem em documentos de estudos. Nenhum achado de descontinuação ou aviso. | 🟡 |
| **Abbott Tailor, Séguin, Rigid Saddle** | Fazem parte do portfólio no site da Abbott e de estudo pós-mercado (NCT04761120). Nenhum achado de descontinuação ou aviso. | 🟡 |
| **Labcor** | Modelos no site da Labcor (TLPB-A, TLPB-M, L-Hydro, Dokimos Plus, Kyros). Nenhum recolhimento encontrado. | 🟡 |
| **Braile** | Produtos no site e artigos. Nenhum recolhimento encontrado. O Inovare SafeSync (transcateter) e o Alpha são produtos distintos. | 🟡 |
| **Meril Dafodil** | Marcação CE; estudos Dafodil-1 com seguimento de 5 anos publicado em 2026; registro europeu EURODAF-1 previsto para abril de 2026; Dafodil Neo no site da Meril. Sem recall ou descontinuação. | 🟡 |

**Regra que continua valendo:** "não encontrei descontinuação ou recolhimento" **não é** "está comercializado". Para saber se um modelo está à venda no Brasil, pergunte ao distribuidor. Foram pesquisados só os canais públicos.

## 4. Lacuna que encontrei no meu próprio recorte
O panorama ANVISA considerou os nomes técnicos "prótese valvar cardíaca (biológica/mecânica)", "anéis de anuloplastia" e "válvula cardíaca". **Condutos e enxertos valvados podem estar cadastrados sob "Próteses cardiovasculares" e ficaram de fora.** Varredura complementar no cadastro (29/09/2026), com nomes que indicam enxerto ou conduto valvado:

| Empresa | Registro | Produto | Publicação | Validade |
| --- | --- | --- | --- | --- |
| Labcor | 10171250027 | Enxerto arterial tubular valvado orgânico | 12/12/2005 | 12/12/2035 |
| Labcor | 10171250029 | Enxerto arterial inorgânico valvado | 06/11/2006 | 06/11/2036 |
| Labcor | 10171250037 | Enxerto arterial tubular valvado orgânico L-Hydro | 17/09/2007 | 17/09/2027 |
| Labcor | 10171250035 | Enxerto arterial valvado orgânico | 02/07/2007 | 02/07/2027 |
| Labcor | 10171250034 | Enxerto arterial valvado orgânico L-Hydro | 11/06/2007 | 11/06/2027 |
| Labcor | 10171250046 | Enxerto arterial inorgânico valvado | 08/04/2013 | 08/04/2028 |
| Abbott (St. Jude) | 10332340091 | Enxerto aórtico valvado Masters Series com tecnologia de enxerto | 07/03/2002 | 07/03/2037 |
| Medtronic (Auto Suture) | 10349001078 | Enxerto valvulado aórtico Open Pivot (já estava no panorama) | 24/05/2021 | 11/08/2034 |
| Edwards | 80219050182 | Conduto aórtico valvulado Konect RESILIA (já estava no panorama) | 21/02/2022 | 21/02/2032 |

Conclusão: no segmento de **raiz da aorta (condutos valvados)**, a Labcor é a empresa com mais registros no cadastro; mostra que o recorte do panorama subestimava o portfólio nacional. Outros nomes de conduto (ex.: "tubo" ou "tubo valvado" com outra grafia) podem existir e não foram varridos exaustivamente. Também há homoenxertos (CryoValve, Artivion) e itens de tecido de outras empresas que não foram procurados.

## 5. O que continua sem verificação
- Alcance clínico do aviso Carbomedics e do recall On-X mitral no Brasil.
- Texto original dos alertas da ANVISA (bloqueio do portal).
- Status comercial atual, no Brasil, de qualquer modelo (exceto Trifecta e Acurate, descontinuados).
- Cosgrove e McCarthy-Adams: disponibilidade.
- Homoenxertos e outros itens de tecido no cadastro.

---

# Fase 4: Carbomedics completo, condutos e recall On-X (29/09/2026)

## 1. Aviso Carbomedics (REC-000703): texto completo
Fonte: [aviso hospedado pela HPRA, Irlanda](https://assets.hpra.ie/data/docs/default-source/product-updates/fsn/field-safety-notices/january-2025/carbomedics-prosthetic-heart-valves_corcym-s-r-l-_advice-regarding-a-device-removal.pdf?sfvrsn=79f09d78_1) (comunicado do fabricante, hospedado por regulador; nível 1). O texto não pôde ser extraído pelas ferramentas de leitura, então **extraí o texto direto do PDF**; a transcrição abaixo é fiel ao que li. Datado de **17/01/2025**, assinado pelo gerente de qualidade da Corcym; a HPRA registra o aviso em 04/02/2025.

| Item | O que o aviso diz |
| --- | --- |
| Produtos | Válvulas Carbomedics (bidisco, carbono pirolítico, para posição aórtica ou mitral) e próteses de aorta ascendente Carbo-Seal e Carbo-Seal Valsalva (que usam o mesmo conjunto folhetos/orifício). Modelos e números de série: **Anexo A, não público**. |
| Problema | A Corcym detectou que os produtos do Anexo A "podem apresentar folhetos com espessura do revestimento de carbono pirolítico abaixo da especificação". |
| Risco | Se implantado um folheto com revestimento fino, "o folheto pode sofrer desgaste acelerado ao longo do tempo", com potencial falha levando a **esteno-insuficiência, insuficiência cardíaca aguda ou progressiva e lesão grave**. |
| Probabilidade | A empresa faz testes extensos; "embora esses testes estejam em andamento e precisem de confirmação, os resultados preliminares sugerem que essa probabilidade é **muito baixa**". Testes e simulações do impacto sobre a durabilidade tinham resultados previstos "até meados de fevereiro" (de 2025). |
| Ação do usuário | Identificar o estoque do Anexo A, colocar em **quarentena**, devolver o formulário a `FSCA@corcym.com` e devolver os dispositivos. Prazos: passos 1 e 2 até **24/01/2025**; devolução até **31/01/2025**. |
| Ação do fabricante | Remoção de produto, prevista para concluir até **31/03/2025**. |
| Pacientes já implantados | Sem novas recomendações até saírem os resultados dos testes. O aviso lembra que a probabilidade é considerada muito baixa e que o modo de falha por desgaste, se ocorresse, seria **ao longo do tempo**. |
| Comunicação ao paciente | **Não exigida** ("Is the FSN required to be communicated to the patient? No"). |
| Acompanhamento | O aviso diz que **é esperado um aviso de acompanhamento** ("Further advice... follow-up FSN: Yes"). **Não encontrei o acompanhamento publicado** nas buscas. |

**Como ler:** é uma ação preventiva de **estoque** (produtos ainda nas prateleiras) com probabilidade preliminar descrita como muito baixa, não um alerta de falha em implantes. O resultado dos testes de durabilidade e a lista de lotes não são públicos. O que isso significa para o Brasil (se as unidades do Anexo A foram enviadas à VR Medical ou a hospitais brasileiros) **é desconhecido**: perguntar à VR Medical ou à Tecnovigilância.

## 2. Recall On-X mitral (fev/2026): checagem adicional
- O registro do openFDA (nº 98548) continua sendo a única fonte encontrada. Busca web não achou outra menção.
- O relatório trimestral da Artivion (10-Q de 30/06/2026) **não menciona** o recall, o que é compatível com um evento de 10 unidades, sem materialidade financeira. Isso não confirma nem contradiz o recall. 🟢 openFDA; sem corroboração independente.

## 3. Conclusão da varredura de condutos e enxertos no cadastro ANVISA
Varredura ampliada (29/09/2026) sobre os nomes técnicos "Próteses cardiovasculares", "Próteses vasculares" e "Enxertos", cruzando com termos de valva, aorta e raiz:
- **Condutos/enxertos valvados:** 6 da Labcor, 1 da St. Jude/Abbott (Masters), Konect (Edwards), Open Pivot (Medtronic). Nenhum outro conduto valvado de outra empresa foi encontrado; Carbo-Seal e On-X Ascendente já estavam na lista de mecânicas.
- **Enxerto de raiz sem valva:** **Terumo Gelweave Valsalva** (enxerto arterial de poliéster vedado com gelatina), registro 80012280188, publicado em 14/08/2017, **validade 14/08/2027**. Relevante para cirurgia da raiz da aorta.
- **Remendos de pericárdio bovino** (usados em cirurgia cardíaca, não são válvulas): Labcor, Braile, Cardioprótese (a mesma empresa do recolhimento de 2021) e Products and Features (DryPatch, 2025).
- **Não foram encontrados** homoenxertos valvares (ex.: CryoValve) no cadastro por essa varredura; isso pode significar que não há registro ou que estão sob outro nome.

## 4. O que ainda resta em aberto
- Lista de lotes do Carbomedics e resultado dos testes de durabilidade (não públicos).
- Impacto no Brasil do aviso Carbomedics e do recall On-X.
- Texto original dos alertas da ANVISA (bloqueio do portal).
- Status comercial atual de cada modelo no Brasil.
- Cosgrove e McCarthy-Adams (disponibilidade).
