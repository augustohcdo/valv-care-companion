# Protocolo de verificação

Objetivo: que cada informação entregue seja **robusta** (verificável, datada, com fonte) e **faça sentido** (coerente com o resto do que se sabe). Vale para briefings, battlecards e qualquer resposta do `valve-intel`.

## 1. Hierarquia das fontes

| Nível | Tipo | Exemplos | Pode sustentar "🟢 Confirmado"? |
| --- | --- | --- | --- |
| 1 | Registro oficial ou base de dados regulatória | Cadastro ANVISA, DOU, banco PMA da FDA, EUDAMED, PNCP, SEC EDGAR, ClinicalTrials.gov | Sim, sozinho |
| 1 | Comunicado oficial do fabricante | Newsroom da empresa, release em bolsa (8-K), *field safety notice* | Sim, para o que a própria empresa afirma (ex.: "obteve aprovação"). Não para alegações de superioridade |
| 1 | Artigo revisado por pares ou apresentação oficial de congresso | JACC, NEJM, EHJ, Lancet, late-breaker com slides | Sim, para os resultados publicados |
| 2 | Imprensa especializada com fonte identificada | TCTMD, Cardiovascular Business, MedTech Dive, Fierce, Healio, Medscape | Só com fonte de nível 1 junto. Sozinha, é 🟡 |
| 3 | Análise de terceiros, relatórios de mercado, transcrições, agregadores | Evaluate, GlobalData, Investing.com, resumos automáticos | Não. É 🟡 e deve ser rotulada como estimativa/opinião |
| 4 | Redes sociais, fóruns, comentários, boatos | X, LinkedIn, Reddit, WhatsApp | Não. É 🔴 até haver fonte de nível 1 |

Sites de agregação e "notícias" automáticas de bolsa podem errar números e datas. Sempre subir até a fonte original (release, filing, artigo).

## 2. Regras para chamar algo de confirmado

1. **Dois pontos de ancoragem quando possível**: fonte de nível 1 + segunda fonte independente. Se só existe uma fonte de nível 1, ainda é 🟢, mas diga qual.
2. **Só nível 2 ou 3 → 🟡.** Só nível 4 → 🔴.
3. **Fonte que se contradiz com outra**: apresente as duas versões, diga qual tem mais peso e por quê. Não escolha em silêncio.
4. **Não use a memória do modelo como fonte de fato atual.** O que veio da memória entra como "conhecimento prévio, não verificado".

## 3. Checagens de coerência (fazem sentido?)

Antes de publicar, passe cada item por estas perguntas. Se falhar, reverifique ou rebaixe a confiança.

- **Data:** o evento ocorreu na janela do briefing? A data do fato bate com a da fonte? Fusos horários de eventos nos EUA/Ásia foram convertidos?
- **Ordem de grandeza:** o número é plausível? (Ex.: preço unitário de TAVR fora da faixa de milhares de reais pode ser valor total do contrato, kit completo ou erro de digitação no edital.)
- **Unidade e escopo:** valor unitário ou total? Inclui bainha, balão, proctoring? Moeda? Ano?
- **Denominador:** percentuais de estudos: de quantos pacientes, em qual população, em qual seguimento, qual definição de desfecho (VARC-2 ou VARC-3)?
- **Indicação:** aprovado para qual população e qual anatomia? "Registrado" não é "indicado para" nem "reembolsado".
- **Região:** o fato vale para o Brasil ou é dos EUA/Europa? Aprovação numa região não implica em outra.
- **Registro vigente não é produto comercializado.** Antes de listar um modelo como ativo, procurar descontinuação, recall ou alerta de segurança (FDA, ANVISA, comunicado do fabricante). Exemplo: o Trifecta da Abbott foi descontinuado em 2023 e o registro brasileiro seguiu vigente até 2028.
- **Identidade do produto:** mesmo nome comercial pode designar gerações diferentes (ex.: G4 e G5, RESILIA e anterior). Confira modelo e versão.
- **Consistência interna:** o item contradiz algo que a mesma fonte disse antes, ou algo estabelecido no `mapa-competitivo.md`? Se sim, explique.
- **Interesse da fonte:** o fabricante descrevendo seu produto, patrocinador financiando o estudo, consultoria vendendo relatório. Registre o viés possível.
- **Causalidade:** correlação em registro observacional não é efeito de dispositivo. Rotule inferências.

## 4. Como tratar cada tipo de dado

| Dado | Regra |
| --- | --- |
| Produto listado como ativo | Checar descontinuação e alertas (FDA, ANVISA, comunicado da empresa) antes de afirmar que está à venda. Suplemento recente na FDA mostra atividade regulatória, não lançamento. Data de "decisão" de produto antigo no banco PMA pode ser reemissão, não estreia. |
| Registro ANVISA | Ler do cadastro aberto e conferir na consulta oficial e no DOU. Registrar nº do registro, detentor, validade e data de publicação. Lembrar: cadastro não traz a indicação aprovada. |
| Preços | Sempre faixa observada, com origem, data, quantidade, escopo. Mínimo 3 observações para falar em mediana. Identificar valor unitário vs. total. Não comparar preços de escopos diferentes. |
| Estudos | Ler o resumo do artigo ou o slide oficial. Se só há notícia, marcar 🟡 e buscar a publicação. Registrar N, seguimento, desfecho primário, limitações. |
| Aprovações | Comunicado da empresa + base do regulador. Data da decisão, não do comunicado. |
| Resultados financeiros | Filing ou release da própria empresa. Guidance é declaração da empresa, não fato. |
| Rumores | Nunca em resumo executivo como fato. Vão para "Não confirmado" com o que falta para confirmar. |
| Traduções | Guardar o termo original quando a tradução puder mudar o sentido (ex.: "registro" vs. "cadastro", "aprovação" vs. "autorização"). |

## 5. O que fazer quando não dá para acessar a fonte

Não preencha a lacuna com suposição. Faça, nesta ordem:

1. Tente outra rota para a mesma fonte (API aberta, CSV, versão em cache da busca, página espelho oficial).
2. Busque uma fonte independente de nível 1 ou 2.
3. Se não houver, registre em "O que foi consultado e falhou" com o motivo (bloqueio, login, paywall, portal fora do ar) e o que ficou sem checagem.
4. Peça ao usuário para exportar o dado (PDF, CSV, captura de tela) quando o acesso exige login pessoal.

## 6. Limites que precisam ser ditos

- Não há acesso a áreas com login pessoal (LinkedIn, X, Doximity, Sermo, grupos fechados, bases pagas como Evaluate, UpToDate e edições completas de revistas). O agente usa o que é público (resumos, comunicados, notícias).
- Preços de lista e volumes privados não são públicos.
- Fóruns e redes sociais servem como **sinal fraco** para pautar uma checagem, não como prova.
- Cobertura de compras públicas é ampla, mas não total: dispensas, compras fora do PNCP e contratos privados escapam.
- Nenhum sistema garante ausência de erro. Por isso o briefing lista o que foi consultado e o que falhou, e classifica a confiança de cada item.

## 7. Lista de verificação final (antes de entregar)

- [ ] Cada afirmação factual tem `[fonte](URL)` e data.
- [ ] Toda afirmação 🟢 está ancorada em nível 1.
- [ ] Datas do fato conferidas com a janela do briefing.
- [ ] Números conferidos (unidade, escopo, denominador).
- [ ] Região correta em cada item; extrapolações rotuladas.
- [ ] Contradições entre fontes explicadas.
- [ ] Rumores fora do resumo executivo.
- [ ] Seções vazias dizem "sem novidades verificadas" e o que foi consultado.
- [ ] Fontes que falharam listadas.
