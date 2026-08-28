# Dados do catálogo de próteses

O que povoa a EOA de referência, o gradiente e a foto oficial de cada prótese.
Rodar estes scripts é idempotente.

```bash
SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/aplicar-eoa.mjs --seco   # simula
SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/aplicar-eoa.mjs
SUPABASE_SERVICE_ROLE_KEY=... node scripts/catalogo/aplicar-imagens.mjs
```

## `eoa-ase-2024.json` — a EOA de referência

Vem das tabelas do apêndice de:

> Zoghbi WA, Jone P-N, Chamsi-Pasha MA, et al. *Guidelines for the Evaluation of
> Prosthetic Valve Function With Cardiovascular Imaging.* J Am Soc Echocardiogr
> 2024;37(1):2-63. PMID **38182282**.

- **Tabela A4** — próteses aórticas cirúrgicas
- **Tabela A5** — próteses mitrais cirúrgicas
- **Tabelas A1 e A2** — SAPIEN e CoreValve/Evolut, por tamanho

**Os valores foram decodificados à mão, linha por linha.** O texto sai do PDF
sem espaços (`2119.168.21.060.3` é "21 mm, 19,1±8,2 mmHg, 1,0±0,3 cm²") e um
parser por regex erra: o Freestyle 19 mm reporta gradiente e **não** reporta
EOA, e a heurística "o último par é a EOA" o transformava numa EOA de 13 cm².
Por isso não há parser neste diretório — há uma tabela conferida.

## `eoa-estudos.json` — o garimpo por modelo

Para as próteses que **não** estão nas tabelas das diretrizes. Cada valor foi
lido no texto do artigo, nunca em resumo de buscador.

| Modelo | Fonte | Tamanhos |
|---|---|---|
| Abbott Portico | Registro CONFIDENCE (Möllmann 2023), 30 dias | 23, 25, 27, 29 |
| Meril Dafodil (aórtica) | Ensaio Dafodil-1 (Hiremath 2020), 12 meses | 19, 21 |
| Meril Dafodil (mitral) | idem | 27, 31 |
| Corcym Solo Smart | Christ 2017, alta — modelo "Sorin Freedom Solo" | 23, 25, 27 |
| Edwards Magna Ease | Mayr 2021, alta | 23, 25 |

**Regra do n ≥ 10.** Um valor derivado de 2 ou 3 casos não é referência, é
anedota — e aqui alimentaria o recomendador que diz a um cirurgião qual prótese
evita mismatch. A regra tem prova prática: no Dafodil-1, o 23 mm (n=3) marca EOA
2,32 cm² e o 25 mm (n=3) marca 1,84 — a curva inverte, que é ruído de amostra.
Os tamanhos recusados estão nomeados em `eoa-estudos.json`.

## Onde a busca deu vazio

`src/data/buscaDeFontes.ts` registra, por família, **o que foi consultado e o
que se achou** — com data. Existe porque campo vazio tem dois sentidos
clinicamente opostos: "ninguém procurou" e "procurou-se e não há". Sem separar
os dois, o médico não sabe se o produto é mal documentado ou se o catálogo é
incompleto, e pode ler a ausência como "esta prótese não dá mismatch".

Vazio de verdade, com o motivo: Braile Biocor e Inovare, Meril Miltonia e Myval
(o LANDMARK tem por tamanho, mas em suplemento fechado), Abbott Navitor e
Masters HP, Corcym Crown PRT, Edwards Konect, Magna Mitral e Mitris, Medtronic
Open Pivot.

**A base da FDA está bloqueada deste contêiner** — os SSED trariam a tabela
hemodinâmica completa de todo dispositivo aprovado, mas `accessdata.fda.gov`
devolve HTML de erro mesmo para URL conhecida. É o caminho a tentar de outra
rede.

### O que ficou de fora das tabelas da ASE, e por quê

- **Epic mitral e Mitris Resilia**: a Tabela A5 tem cinco colunas (pico, médio,
  velocidade de pico, THP, EOA) e essas linhas trazem só dois pares. Em posição
  mitral, velocidade de pico (m/s) e EOA (cm²) caem na mesma faixa numérica —
  não dá para saber qual é qual. Preencher seria adivinhar a coluna.
- **Braile, Corcym (fora a Perceval), Meril, Open Pivot, Portico, Konect,
  Magna Ease, Magna Mitral, Crown PRT, Solo Smart, Masters HP**: não estão nas
  tabelas da ASE. Precisam de IFU do fabricante ou publicação própria — vários
  atrás de material suplementar ou de assinatura.

### Correspondências de nome que foram decididas, não deduzidas

A tabela nomeia a geração medida; o catálogo às vezes traz a seguinte. Quando
foram usadas, o rótulo da fonte diz o nome exato da entrada da ASE:

| Catálogo | Entrada na ASE |
|---|---|
| Trifecta GT | Abbott Trifecta |
| Intuity Elite | Edwards Intuity |
| Perceval Plus | Sorin Perceval Sutureless (S/M/L/XL) |
| Sapien 3 Ultra, Ultra RESILIA | SAPIEN 3 |
| Evolut FX, Evolut PRO+ | Evolut R (30 dias) |
| Perimount | Baxter Perimount |

## `imagens-rastreadas.json` — as fotos

Saída do rastreio dos sites dos fabricantes. **Procedência por rastreio, não por
domínio**: a foto da Edwards não mora em `edwards.com`, mora na CDN de conteúdo
deles — o que garante que é a imagem certa é ela ter sido achada dentro de uma
página viva sob o domínio do fabricante, e essa página fica gravada como
`reference_url`.

`aplicar-imagens.mjs` carrega um veredito **por família, conferido à mão**. Das
22 candidatas do rastreio, 4 foram recusadas por serem outro produto:

- Perimount recebeu `magna-ease-aortic-valve.jpg` (a Edwards vende a Magna Ease
  como "PERIMOUNT Magna Ease", então o nome casou);
- Sapien 3 e Sapien 3 Ultra receberam a foto cujo texto alternativo diz
  "SAPIEN 3 Ultra RESILIA";
- Epic recebeu `epic-max-av-side-flip-fnl.png` — a Epic **Max** é outra válvula.

Mostrar a válvula errada a um cirurgião é pior do que não mostrar nenhuma.

## O gradiente de referência

Tem coluna própria: `mean_gradient_ref` e `mean_gradient_ref_sd`, criadas pela
migration `20260828020000`. **80 dos 87 tamanhos com EOA também têm gradiente.**

Ele passou um tempo dentro de `description`, numa frase demarcada, porque o
token da Management API expirou no meio da rodada e a `service_role` não executa
DDL. Com o token novo, a coluna entrou e os scripts passaram a limpar a sobra —
por isso eles ainda cortam a frase antes de gravar.

Duas coisas que a aplicação ensinou, e que estão viradas em guarda:

- **`CREATE OR REPLACE` não muda tipo de retorno.** A migration muda, e o
  Postgres recusa com "cannot change return type of existing function". Precisa
  de `DROP FUNCTION` antes. Quando falhou, a transação inteira reverteu —
  inclusive as colunas —, que é o comportamento certo.
- **A restrição `prosthesis_catalog_eoa_com_fonte` só entrou agora**, junto: ela
  ficou de fora quando o token caiu. Conferida barrando de verdade uma tentativa
  de apagar a fonte de uma linha que tem EOA.
