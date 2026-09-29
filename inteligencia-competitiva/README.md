# Inteligência competitiva em válvulas cardíacas

**Foco principal: cirurgia valvar aberta** (SAVR, mitral, tricúspide, raiz da aorta, minimamente invasiva). O transcateter entra como contexto e concorrência. Os briefings marcam cada item como Segmento: Cirurgia ou Transcateter e listam a cirurgia primeiro.

Base de conhecimento do agente **`valve-intel`** (definido em `.claude/agents/valve-intel.md`), pensado para apoiar um profissional da Edwards Lifesciences em novidades de mercado, comparação com concorrentes, status regulatório (ANVISA e demais), evidência, preços e licitações.

Este material é separado do app ValvePath e não é usado por ele.

## Como usar

No Claude Code, abra este repositório e peça algo como:

- "Use o valve-intel para montar um battlecard SAPIEN 3 x Myval para o Brasil."
- "valve-intel: qual o status atual do EVOQUE na ANVISA e o que concorrentes têm em tricúspide?"
- "valve-intel: briefing diário de ontem."
- "valve-intel: briefing semanal consolidado."
- "valve-intel: levante preços de TAVR em licitações públicas nos últimos 12 meses."

O agente pesquisa na web, cita as fontes e classifica a confiança de cada dado.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `fontes.md` | Catálogo de fontes com status de acesso testado (ANVISA, FDA, DOU, PNCP, SIGTAP, CONITEC, ANS, registros, empresas, patentes, notícias, fóruns, aplicativos). |
| `protocolo-de-verificacao.md` | Como garantir que cada informação é robusta e faz sentido. |
| `ferramentas/` | Script de coleta por API aberta. |
| `mapa-competitivo.md` | Panorama inicial de produtos e empresas, com watchlist. **Hipóteses a verificar**, não fatos confirmados. |
| `playbooks/` | Modelos de entrega: battlecard (transcateter e cirúrgico), regulatório, preços/licitações, briefing diário, briefing semanal consolidado, evidência clínica. Os briefings são segmentados por região (Brasil e global) e trazem link de fonte em cada afirmação. |
| `relatorios/` | Onde o agente salva relatórios datados (`AAAA-MM-DD-assunto.md`). Já existe o panorama ANVISA de válvulas cirúrgicas e anéis no Brasil (2026-09-29). |

## Coleta e verificação

- `ferramentas/coletar.py` puxa dados por API aberta (ANVISA, PNCP, openFDA, ClinicalTrials.gov, PubMed, SEC) e devolve Markdown com link e data em cada linha. Exemplo: `python3 inteligencia-competitiva/ferramentas/coletar.py tudo --desde 2026-09-28`.
- `protocolo-de-verificacao.md` define a hierarquia de fontes, as regras para chamar algo de confirmado e as checagens de coerência.
- `fontes.md` lista as fontes com o status de acesso testado (o que abre, o que bloqueia, o que exige login).

## Limites que você precisa conhecer

- **Nenhum agente é onisciente.** Dados não públicos (preço de lista de concorrentes, volume por hospital, contratos privados) não estão disponíveis; o agente vai dizer isso e oferecer estimativas rotuladas.
- **A qualidade depende da web acessível.** Alguns portais (ANVISA, DOU, PNCP) têm buscas dinâmicas que a ferramenta de busca do agente pode não conseguir consultar. Nesses casos, exporte a consulta (PDF/CSV) e passe o arquivo ao agente para análise.
- **Uso interno.** Os relatórios não são material promocional. Respeite as políticas de compliance da Edwards.
- **Só fontes lícitas.** O agente não deve ser usado para obter informação confidencial de terceiros.

## Manutenção

1. Revise `mapa-competitivo.md` mensalmente e atualize `Verificado em` e `Fonte`.
2. Ajuste `fontes.md` quando portais mudarem.
3. Guarde os relatórios úteis em `relatorios/`.
