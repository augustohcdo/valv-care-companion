# Catálogo de fontes

Onde buscar cada tipo de dado, **como acessar de fato** e o quanto confiar. Leia junto com `protocolo-de-verificacao.md`.

**Acesso testado em 2026-09-29** a partir do ambiente do agente (nuvem, busca restrita aos EUA). Legenda:

- 🟢 **API/arquivo aberto**: dado estruturado, acessível por `ferramentas/coletar.py` ou `curl`. Melhor rota.
- 🔵 **Leitura de página**: WebFetch/WebSearch conseguem ler.
- 🟠 **Instável ou parcial**: bloqueio intermitente, busca dinâmica, ou só resumo.
- 🔴 **Bloqueado ou com login**: o agente não lê. Precisa de exportação do usuário ou de fonte alternativa.
- ⚪ **Não testado.**

Níveis de fonte (1 a 4) seguem o protocolo. Endereços mudam: se um link falhar, pesquise o nome do portal.

## 1. Regulatório

| Fonte | Nível | Acesso | Como usar |
| --- | --- | --- | --- |
| **ANVISA: cadastro aberto de produtos para saúde** (`dados.anvisa.gov.br/dados/TA_PRODUTO_SAUDE_SITE.csv`) | 1 | 🟢 CSV de ~27 MB, ~116 mil linhas | `coletar.py anvisa`. Traz registro, produto, detentor, fabricante, classe, data de publicação e validade. **Não traz** indicação nem situação detalhada. Campo de atualização é a data da carga. |
| ANVISA: Consulta de Produtos (`consultas.anvisa.gov.br`) | 1 | 🔴 403 para o agente | Conferência manual pelo usuário; usar o CSV acima como rota principal. |
| **DOU** (`in.gov.br/consulta`) | 1 | 🟠 busca por URL responde; página inicial às vezes 502 | Buscar termos como "válvula cardíaca", nomes de detentores. Conferir data de publicação. |
| ANVISA: alertas de tecnovigilância e Notivisa (`gov.br/anvisa`) | 1 | 🔵 página institucional lê; alertas por busca | Buscar "alerta tecnovigilância + válvula". |
| **FDA via openFDA** (`api.fda.gov/device/pma.json`, `/recall.json`, `/event.json`) | 1 | 🟢 JSON | `coletar.py fda`. openFDA é não validado; confirmar no banco PMA (`accessdata.fda.gov`, 🔵). |
| FDA: PMA, MAUDE, TPLC (`accessdata.fda.gov`) | 1 | 🔵 | Conferência final de decisão e SSED. MAUDE é notificação espontânea. |
| **EUDAMED** (`ec.europa.eu/tools/eudamed`) | 1 | 🟢 API pública de dispositivos respondeu | Cobertura ainda em adoção gradual; ausência não prova inexistência. |
| PMDA Japão (`pmda.go.jp/english`) | 1 | 🔵 | Aprovações e notas de segurança. |
| NMPA China (`nmpa.gov.cn`) | 1 | 🔴 412 | Usar comunicados das empresas e imprensa (HKEX). |
| TGA Austrália, CDSCO Índia | 1 | 🟠 sem resposta no teste | Buscar por WebSearch, ARTG. |
| MHRA Reino Unido, Swissmedic, Health Canada | 1 | 🔵 (MHRA e Swissmedic lêem) | Alertas e registros. |
| ANMAT Argentina, COFEPRIS México, INVIMA Colômbia, ISP Chile | 1 | ⚪ | A busca já retornou certificados da ANMAT (Helena). Testar caso a caso. |

## 2. Preços, compras e reembolso (Brasil)

| Fonte | Nível | Acesso | Como usar |
| --- | --- | --- | --- |
| **PNCP: busca pública** (`pncp.gov.br/api/search/`) | 1 | 🟢 JSON de editais, atas e contratos, com órgão, UF, município, modalidade, datas e valor global | `coletar.py pncp`. Testado: retorna TAVI reais (ex.: editais, atas e contratos de 2026). Valor global costuma ser total; itens e unitários estão nos documentos do link. Servidor recusa rajadas: o script espera entre chamadas. |
| PNCP: consulta por contratações (`pncp.gov.br/api/consulta/v1/...`) | 1 | 🟢 | Filtragem por data e modalidade; sem busca textual. |
| Painel de Preços ComprasGov (`paineldeprecos.planejamento.gov.br`) | 1 | 🔴 403 | Alternativa: PNCP e atas. |
| Banco de Preços em Saúde (`bps.saude.gov.br`) | 1 | 🟠 login/exportação | Pedir exportação ao usuário se necessário. |
| SIGTAP (`sigtap.datasus.gov.br`) | 1 | 🟠 respondeu por HTTP simples; busca dinâmica | Valores de procedimento SUS (não é preço do dispositivo). |
| CONITEC (`gov.br/conitec`) | 1 | 🔵 | Consultas públicas e relatórios de recomendação. |
| ANS (`gov.br/ans`) | 1 | 🔵 | Rol, resoluções normativas, TUSS. |
| DATASUS/TabNet, CNES | 1 | 🔵 páginas; extração exige TabNet | Volumes de procedimentos e hospitais. |
| Diários oficiais e portais de transparência estaduais e municipais | 1 | 🟠 varia | Dispensas e compras fora do PNCP. |
| Jurisprudência (tribunais de justiça, `jusbrasil.com.br`) | 1 a 3 | 🟠 JusBrasil 403; tribunais variam | Processos de fornecimento de TAVI/OPME. |
| NICE (UK), G-BA (DE), CMS (EUA) | 1 | 🔵 NICE e CMS; G-BA sem resposta | Comparar cobertura e evidência exigida. CMS: decisões de cobertura nacional. |

## 3. Evidência, registros, diretrizes

| Fonte | Nível | Acesso | Como usar |
| --- | --- | --- | --- |
| **PubMed** (E-utilities) | 1 | 🟢 JSON | `coletar.py pubmed`. Abstract e metadados. |
| **Europe PMC** (`ebi.ac.uk/europepmc/webservices/rest`) | 1 | 🟢 JSON | Inclui preprints. O site principal dá 403, a API funciona. |
| **ClinicalTrials.gov** (API v2) | 1 | 🟢 JSON | `coletar.py estudos`. Status, patrocinador, datas. |
| ReBEC (`ensaiosclinicos.gov.br`), EU CTIS (`euclinicaltrials.eu`) | 1 | 🔵 | Estudos no Brasil e na UE. |
| JACC, NEJM, Lancet, AHA Journals, EHJ (OUP) | 1 | 🔴 403 direto; 🔵 via PubMed/abstract | Ler resumo no PubMed; texto completo só se aberto. |
| EuroIntervention (PCR), JTCVS, Annals of Thoracic Surgery, JAMA Cardiology | 1 | 🔵/🟠 | Resumos. |
| medRxiv, bioRxiv (preprints) | 3 | ⚪ | Rotular como não revisado por pares. |
| STS Risk Calculator (`riskcalc.sts.org`), EuroSCORE II | 1 | 🔵 | Ferramenta de risco. |
| Diretrizes: ACC/AHA, ESC/EACTS, SBC, CCS, JCS | 1 | 🔵 sites lêem (ACC, ESC, SBC) | Verificar sempre a edição vigente e a data. Só citar recomendação com classe e nível de evidência. |
| Registros: STS/ACC TVT, SWEDEHEART, FRANCE-TAVI, GARY, NICOR, J-TVT, Registro Brasileiro de TAVI (SBHCI) | 1 | 🔵 artigos e relatórios | Números vêm da publicação. |
| VARC-3 e documentos de consenso | 1 | 🔵 | Definições de desfecho. |

## 4. Empresas e mercado

| Fonte | Nível | Acesso | Como usar |
| --- | --- | --- | --- |
| **SEC EDGAR** (`data.sec.gov/submissions/`) | 1 | 🟢 JSON (exige User-Agent identificado) | `coletar.py sec`. 8-K, 10-Q, 10-K de Edwards, Medtronic, Abbott, Boston Scientific, Artivion. |
| Edwards: newsroom (`edwards.com/newsroom`), RI (`ir.edwards.com`) | 1 | 🔵 newsroom; RI bloqueia bot (403 "Just a moment") | Comunicados oficiais; RI via SEC e via busca. |
| Medtronic, Abbott, Boston Scientific, Artivion, Corcym, Anteris, Meril, MicroPort, Venus Medtech | 1 | 🔵 sites lêem | Comunicados e páginas de produto. JenaValve: site com 406, usar imprensa e SEC/comunicados. |
| Fabricantes e distribuidores nacionais (ex.: Braile Biomédica) | 1 | 🔵 | Registros na ANVISA. |
| HKEX/Shenzhen (MicroPort, Venus, Peijia) | 1 | ⚪ | Divulgações a bolsa. |
| Associações: ABIMED, AdvaMed, MedTech Europe | 3 | 🔵 ABIMED; AdvaMed e MedTech Europe 403 | Posicionamento e dados setoriais. |
| Consultorias e relatórios: Evaluate, GlobalData, iData, Frost & Sullivan | 3 | 🟠 só página pública | Estimativas de terceiros; rotular como tal. |
| Transcrições e resumos de earnings (Investing.com etc.) | 3 | 🔵 | Só para achar a fonte primária. Nunca como confirmação. |
| Patentes: Google Patents, Espacenet, USPTO, INPI | 1 | 🔵 Google Patents; 🔴 Espacenet 403; INPI sem resposta | Busca por depositante e classe CPC A61F 2/24. |
| Litígios: PACER, UPC, tribunais brasileiros | 1 | 🔴/🟠 | Notícias jurídicas como pista; confirmar na decisão. |

## 5. Notícias e comunidade científica

| Fonte | Nível | Acesso | Observação |
| --- | --- | --- | --- |
| **TCTMD** (CRF) | 2 | 🔵 WebFetch leu a página inicial; `curl` simples tem 403 | Melhor cobertura de congressos e estudos valvares. |
| Cardiovascular Business, MedTech Dive, Fierce MedTech, MassDevice, Healio Cardiology, Medscape Cardiology, CardioBrief, Becker's | 2 | 🔵/🟠 (MedTech Dive, Healio, Medscape, Fierce lêem; Cardiovascular Business e MassDevice 403 direto, aparecem na busca) | Usar para achar a fonte primária. |
| Imprensa brasileira de saúde e negócios (Newslab, Valor Saúde, Medicina S/A e similares) | 2 | 🔵 aparece na busca | Bom para movimentos locais; conferir o comunicado de origem. |
| Sociedades: ACC, ESC, EACTS, STS, AATS, SBC, SBHCI, SOLACI, CRF, PCR | 1 | 🔵 | Congressos, diretrizes, comunicados. |
| Congressos: TCT, New York Valves, EuroPCR, PCR London Valves, CSI Frankfurt, TVT, ACC, ESC, EACTS, AATS, STS, SBHCI, SBC | 1 | 🔵 | Programas e late-breakers. |
| Pacientes: Heart Valve Voice (`heartvalvevoice.com`), American Heart Association, Mended Hearts, associações de pacientes | 3 | 🔵 Heart Valve Voice lê; AHA 403 | Percepção e acesso; não é evidência clínica. |
| Fóruns e redes: Reddit (r/cardiology), X, LinkedIn, Doximity, Sermo | 4 | 🔴 login/403 (LinkedIn, X e Doximity respondem só a tela de login) | **Sinal fraco.** Nunca confirmação. O agente não lê áreas com login. |

## 6. Aplicativos e ferramentas do setor

Aplicativos móveis e áreas logadas não são acessíveis ao agente. Servem ao usuário para consulta e, se ele exportar/colar o conteúdo, entram como insumo.

| Tipo | Exemplos | Uso |
| --- | --- | --- |
| Diretrizes de bolso | ACC Guideline Hub, ESC Pocket Guidelines, app da SBC | Conferir recomendação e classe de evidência. |
| Calculadoras | STS Risk Calculator (web, acessível), EuroSCORE II | Estratificação de risco. |
| Notícias e educação | app do TCTMD, Medscape | Novidades e CME. |
| Plataformas dos fabricantes (áreas de médicos, academias, portais de treinamento) | Edwards, Medtronic, Abbott, Boston Scientific | Acesso restrito a profissionais. Só o material público entra. |
| Bases pagas | UpToDate, Evaluate, GlobalData | Só com acesso do usuário. |

## 7. Como o agente acessa (ordem de tentativa)

1. **API/arquivo aberto** via `ferramentas/coletar.py` (ANVISA, PNCP, openFDA, ClinicalTrials.gov, PubMed, SEC). Rota preferida por ser estruturada e datada.
2. **WebFetch** na página oficial ou no link retornado pela API.
3. **WebSearch** com `allowed_domains` do portal-alvo (a busca é restrita aos EUA, então fontes brasileiras e asiáticas aparecem menos: filtre pelo domínio e busque em português).
4. **Fonte alternativa de nível 1 ou 2** para o mesmo fato.
5. **Pedido de exportação ao usuário** para áreas com login ou pagas.
6. Se nada funcionar: registrar como **não checado**, com o motivo.

## 8. Monitoramento contínuo

- Briefing diário e semanal automáticos (rotinas), que rodam a coleta e listam o que consultaram e o que falhou.
- Alertas próprios do usuário: PubMed e Google Alerts para nomes de produtos; Diário Oficial por palavra-chave; comunicados e 8-K dos concorrentes.
- Revisar este catálogo a cada mês: testar os links e atualizar as marcações de acesso.
