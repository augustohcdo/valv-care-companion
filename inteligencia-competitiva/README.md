# Inteligência competitiva em válvulas cardíacas

Base de conhecimento do agente **`valve-intel`** (definido em `.claude/agents/valve-intel.md`), pensado para apoiar um profissional da Edwards Lifesciences em novidades de mercado, comparação com concorrentes, status regulatório (ANVISA e demais), evidência, preços e licitações.

Este material é separado do app ValvePath e não é usado por ele.

## Como usar

No Claude Code, abra este repositório e peça algo como:

- "Use o valve-intel para montar um battlecard SAPIEN 3 x Myval para o Brasil."
- "valve-intel: qual o status atual do EVOQUE na ANVISA e o que concorrentes têm em tricúspide?"
- "valve-intel: briefing das últimas duas semanas."
- "valve-intel: levante preços de TAVR em licitações públicas nos últimos 12 meses."

O agente pesquisa na web, cita as fontes e classifica a confiança de cada dado.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `fontes.md` | Onde buscar cada tipo de dado (ANVISA, FDA, DOU, PNCP, SIGTAP, CONITEC, ANS, registros, empresas, patentes). |
| `mapa-competitivo.md` | Panorama inicial de produtos e empresas, com watchlist. **Hipóteses a verificar**, não fatos confirmados. |
| `playbooks/` | Modelos de entrega: battlecard, regulatório, preços/licitações, briefing periódico, evidência clínica. |
| `relatorios/` | Onde o agente salva relatórios datados (`AAAA-MM-DD-assunto.md`). |

## Limites que você precisa conhecer

- **Nenhum agente é onisciente.** Dados não públicos (preço de lista de concorrentes, volume por hospital, contratos privados) não estão disponíveis; o agente vai dizer isso e oferecer estimativas rotuladas.
- **A qualidade depende da web acessível.** Alguns portais (ANVISA, DOU, PNCP) têm buscas dinâmicas que a ferramenta de busca do agente pode não conseguir consultar. Nesses casos, exporte a consulta (PDF/CSV) e passe o arquivo ao agente para análise.
- **Uso interno.** Os relatórios não são material promocional. Respeite as políticas de compliance da Edwards.
- **Só fontes lícitas.** O agente não deve ser usado para obter informação confidencial de terceiros.

## Manutenção

1. Revise `mapa-competitivo.md` mensalmente e atualize `Verificado em` e `Fonte`.
2. Ajuste `fontes.md` quando portais mudarem.
3. Guarde os relatórios úteis em `relatorios/`.
