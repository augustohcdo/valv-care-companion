# Playbook: briefing diário

Uso interno. Cobre o que aconteceu **no dia anterior** (fuso America/Sao_Paulo). Informação sem fonte verificável com data não entra como fato.

**Data do briefing:** AAAA-MM-DD · **Janela coberta:** AAAA-MM-DD 00:00 a 23:59 (America/Sao_Paulo)

## Regras de qualidade

1. **Data do fato, não da matéria.** Cada item informa quando o evento ocorreu e quando a fonte publicou. Se o evento é do dia anterior, entra nas seções normais. Se é anterior mas só foi divulgado agora (ex.: DOU publicou registro de dias atrás, artigo online-first), entra marcado com **[divulgado ontem]** e a data real.
2. **Dúvida sobre a data vai para "Não confirmado".** Nunca empurre um item antigo para parecer novidade.
3. **Link em cada afirmação.** Formato `[Nome da fonte](URL)` logo após a frase, com data de publicação. Preferir fonte primária (regulador, artigo, SEC, comunicado oficial) e citar a secundária (imprensa) só como complemento, dizendo qual é qual.
4. **Confiança:** 🟢 confirmado por fonte primária · 🟡 fonte secundária confiável ou dado parcial · 🔴 rumor ou inferência (rotular como tal).
5. **Relevância para a Edwards:** 🔴 Alta (exige ação/atenção esta semana) · 🟠 Média · ⚪ Baixa (contexto).
6. **Seção sem novidade diz "Sem novidades verificadas em AAAA-MM-DD" e lista o que foi consultado.** Silêncio não é resposta.
7. Se a fonte primária não pôde ser acessada (portal dinâmico, paywall), diga qual e o que ficou sem checagem.

## Estrutura

### 0. Resumo executivo (máx. 6 linhas)
Top 3 do dia em uma linha cada: **fato → impacto para a Edwards → ação sugerida**. Se nada relevante: dizer isso.

### 1. Placar do dia
| Região | Itens | Alta | Média | Baixa |
| --- | --- | --- | --- | --- |
| Global (total) | | | | |
| Brasil | | | | |

### 2. Nacional: Brasil
Subseções:
- **Regulatório (ANVISA/DOU):** novos registros, revalidações, alterações, cancelamentos, alertas de tecnovigilância, ações de campo de válvulas e acessórios.
- **Compras públicas e preços:** licitações, atas de registro de preços, contratos, dispensas e pregões de TAVR, TEER, próteses valvares. Por item: órgão, UF, **região (N, NE, CO, SE, S)**, produto/modelo, quantidade, valor unitário, vencedor, escopo incluído.
- **Acesso e reembolso:** CONITEC (consultas públicas, relatórios), ANS (rol, diretrizes), SUS/SIGTAP, judicialização.
- **Mercado e concorrentes no Brasil:** movimentos de Medtronic, Abbott, Boston Scientific, Meril, distribuidores e fabricantes nacionais; lançamentos, treinamentos, parcerias com hospitais.
- **Centros, sociedades e evidência nacional:** SBHCI, SBC, InCor e outros centros, registros e estudos brasileiros, eventos.

### 3. Global
Para cada região, item a item:
- **América do Norte (EUA e Canadá):** FDA (PMA, suplementos, Breakthrough, recalls), CMS/coberturas, ensaios, empresas.
- **Europa (UE, Reino Unido, Suíça):** marcação CE/MDR, EUDAMED, agências nacionais, sociedades, ensaios.
- **Ásia-Pacífico (Japão, China, Índia, Coreia, Austrália e outros):** PMDA, NMPA, CDSCO, TGA, fabricantes locais e internacionalização, preços por volume.
- **América Latina (fora do Brasil):** México, Argentina, Colômbia, Chile e outros: registros, compras públicas, concorrentes.
- **Oriente Médio e África:** somente se houver fato relevante.

### 4. Transversais
- **Edwards:** comunicados, resultados, estudos, litígios, aquisições.
- **Concorrentes:** empresa a empresa (Medtronic, Abbott, Boston Scientific, Meril, JenaValve, Anteris, chineses, brasileiros, startups).
- **Evidência clínica:** artigos, apresentações, registros, diretrizes. Usar o playbook `evidencia-clinica.md` para os relevantes.
- **Pipeline (tricúspide, mitral, insuficiência aórtica, novas plataformas):** marcos atingidos.
- **Investimentos, M&A e patentes/litígios.**

### 5. Formato de cada item
```
**[Título objetivo]** · 🔴 Alta · 🟢 Confirmado · Região/País · Empresa/produto
- **O que aconteceu** (evento em AAAA-MM-DD; publicado em AAAA-MM-DD): 2 a 4 frases com números, definições e contexto.
- **Por que importa para a Edwards:** ameaça, oportunidade ou apenas contexto, e por quê.
- **Ação sugerida:** (se houver)
- **Fontes:** [Primária: nome](URL) · [Secundária: nome](URL)
```

### 6. Não confirmado / rumores
Itens sem data ou fonte primária, com o que falta para confirmar.

### 7. Agenda dos próximos 7 dias
Congressos, sessões de late-breaker, decisões regulatórias esperadas, datas de resultados de empresas, aberturas de licitações, prazos de consulta pública. Cada uma com link.

### 8. O que foi consultado
Lista das fontes verificadas no dia e as que falharam. Serve para auditar a cobertura.

## Cuidados
- Somente fontes públicas e lícitas. Não é material promocional e não deve ser distribuído a profissionais de saúde.
- Não converter dado de outra região em afirmação sobre o Brasil sem dizer que é extrapolação.
- Números de estudos vêm da publicação; cálculo próprio é rotulado como tal.
