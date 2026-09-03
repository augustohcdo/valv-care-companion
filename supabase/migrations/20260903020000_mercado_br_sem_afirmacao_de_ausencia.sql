-- As dezenove "não confirmado" saem: era ausência de evidência virando afirmação
--
-- ## O defeito, e por que ele chegou à tela
--
-- A coluna `mercado_br` tinha três estados, e a intenção era boa: `confirmado`,
-- `nao_confirmado` e NULL para "ninguém procurou". O que eu não percebi é que os
-- dois primeiros não são simétricos.
--
-- `confirmado` vem de prova positiva — uma página brasileira que lista o
-- produto. `nao_confirmado` vinha de **não ter achado nada**, que é outra coisa.
-- E a tela mostrava isso ao cardiologista como "registro brasileiro não
-- confirmado", ao lado do tipo e da posição da prótese: no lugar de maior
-- atenção do cartão, uma dúvida sobre produtos que ele implanta toda semana —
-- Abbott Epic, St. Jude Regent, Corcym Perceval, as Medtronic.
--
-- ## Por que não é caso de procurar melhor
--
-- A base da ANVISA está atrás de desafio do Cloudflare e não se contorna. O que
-- restou foram catálogos de distribuidor, que provam presença e **nunca provam
-- ausência**. Um método que só consegue confirmar não pode produzir a
-- informação "não vendida no Brasil". Gerar uma segunda lista pelo mesmo caminho
-- repetiria o erro com mais confiança.
--
-- ## O que fica
--
-- As 21 `confirmado` e os 10 números de registro conferidos no HTML da fonte
-- continuam gravados — são afirmações de presença, que o método sustenta. Não
-- aparecem em tela nenhuma; ficam como referência para quem um dia tiver acesso
-- ao registro oficial e quiser conferir.
--
-- Estado, data e fonte saem JUNTOS, porque o CHECK deste mesmo esquema exige
-- `(mercado_br IS NULL) = (mercado_br_conferido_em IS NULL)` — afirmação sem
-- data é palpite com cara de fato, e a recíproca também vale.

UPDATE public.prosthesis_catalog SET
  mercado_br = NULL,
  mercado_br_conferido_em = NULL,
  mercado_br_fonte = NULL
 WHERE mercado_br = 'nao_confirmado';
