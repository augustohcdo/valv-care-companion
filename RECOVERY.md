# Recuperação do ValvePath

O que fazer se o projeto Supabase for perdido. Este documento existe porque
exportar não é restaurar: até o ensaio descrito no fim, ninguém tinha provado
que os arquivos do backup voltam a ser um sistema.

**Este procedimento foi executado de verdade em 03/08/2026**, num projeto
descartável, a partir do export daquele dia. O que está escrito aqui é o
caminho que funcionou, não o que deveria funcionar.

---

## O que o backup cobre — e o que não cobre

| Item | No backup? | Onde vive |
|---|---|---|
| 38 tabelas de `public` | sim | `clinical-exports/exports/<data>/<tabela>.ndjson` |
| Contas e vínculos de login | sim, **sem senha** | `auth_users.ndjson`, `auth_identities.ndjson` |
| Schema (tabelas, RLS, funções, gatilhos) | sim | `supabase/migrations/` no git |
| Edge functions | sim | `supabase/functions/` no git |
| **Senhas** | **não** | — cada pessoa redefine a sua |
| Arquivos de exame e documentos | só o **inventário** | buckets `medical-documents` e `patient-documents`; os bytes são copiados da origem na restauração (`--com-arquivos`) |
| Segredos de cron e URL base | não, de propósito | recriados por migration |
| Segredos das edge functions | não | painel do Supabase / seu gerenciador de senhas |

As duas ausências em negrito são decisões, não esquecimentos:

- **Senha** — o backup leva identidade, não credencial. Um arquivo em bucket
  com hash de senha é alvo muito mais valioso que um com nome e e-mail, e o
  ganho seria só poupar um "esqueci minha senha" depois de um desastre.
- **Arquivos** — os bytes não são duplicados no bucket toda semana: isso
  multiplicaria o armazenamento sem cobrir perda do projeto, que só uma cópia
  externa cobre. O backup guarda o **inventário** (caminho, tamanho, tipo), e
  `restore.mjs --com-arquivos` copia os arquivos direto da origem — que o
  procedimento já pressupõe de pé. O mesmo inventário alimenta o alarme de
  "documento no prontuário sem arquivo", que chega no resumo semanal.

---

## Passo a passo

### 1. Criar o projeto

Mesma organização, mesma região (`us-east-1`), plano gratuito serve para
começar. Guarde a senha do banco.

### 2. Aplicar as migrations

Todas as migrations de `supabase/migrations/`, **em ordem de nome de arquivo**.
Pela Management API (`POST /v1/projects/<ref>/database/query`) ou pela CLI do
Supabase.

Uma delas falha, e isso é esperado:
`20260428191449_...sql` tenta `ALTER TABLE realtime.messages ENABLE ROW LEVEL
SECURITY` e recebe `must be owner of table messages`. **Falha do mesmo jeito no
projeto de produção** — a permissão não existe pela API. Não bloqueia nada; siga.

Confira ao final: 39 tabelas em `public`, todas com RLS.

### 3. Restaurar os dados

```sh
export SUPABASE_ACCESS_TOKEN=sbp_...      # token da Management API
export ORIGEM_SERVICE_KEY=eyJ...          # service_role de onde está o backup
export ALVO_SERVICE_KEY=eyJ...            # service_role do projeto novo
node scripts/restore.mjs \
  --de <ref-de-origem> --para <ref-novo> --data 2026-08-03 --limpar --com-arquivos
```

`--com-arquivos` copia os exames e documentos da origem para o projeto novo,
usando o inventário gravado no backup. Sem a flag, só os dados voltam.

`--limpar` esvazia o alvo antes de carregar, e é necessário: as migrations
semeiam dado próprio — o catálogo de próteses nasce com 246 linhas só de
aplicar o schema. Sem limpar, o resultado tem 492 e ninguém percebe, porque
"carregou tudo" continua verdadeiro.

O script termina comparando linha a linha com o `_manifest.json` e sai com
código diferente de zero se algo divergir. **Se ele disser "Tudo bateu", bateu
de verdade; se não disser, não considere restaurado.**

#### 3b. Quando o projeto de origem não existe mais

É o cenário que a cópia externa existe para cobrir. Aqui não há
`ORIGEM_SERVICE_KEY` nem `--de`: a fonte é o provedor externo.

```sh
export SUPABASE_ACCESS_TOKEN=sbp_...
export OFFSITE_ENDPOINT=https://s3.<regiao>.backblazeb2.com
export OFFSITE_REGION=<regiao>
export OFFSITE_BUCKET=<bucket>
export OFFSITE_KEY_ID=...
export OFFSITE_SECRET=...
node scripts/restore.mjs --offsite --para <ref-novo> --data 2026-08-03 --limpar
```

O script baixa primeiro o `_offsite_manifest.json` e **confere o SHA-256 de
cada arquivo** enquanto carrega: a cópia já releu tudo no destino na hora de
gravar, e isto cobre o que pode ter acontecido depois. Um NDJSON corrompido
produziria uma restauração parcial com cara de completa, que é o pior desfecho
possível aqui.

`--com-arquivos` **não vale** neste modo: a cópia externa leva os registros do
banco, não os anexos dos exames. O script recusa a combinação em vez de deixar a
restauração parecer completa.

### 4. Publicar as edge functions e os segredos

Publique as functions de `supabase/functions/` (endpoint multipart
`POST /v1/projects/<ref>/functions/deploy?slug=<nome>`) e grave os segredos
listados no README: `GEMINI_API_KEY`, `TURNSTILE_SITE_KEY`, `RESEND_API_KEY`,
`ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM`.

Confira `supabase/config.toml`: as functions listadas ali precisam de
`verify_jwt = false`.

### 5. Recriar o que fica fora do backup de propósito

```sql
insert into public.internal_secrets (key, value) values
  ('functions_base_url', 'https://<ref-novo>.supabase.co/functions/v1'),
  ('export_cron_secret', '<segredo novo>'),
  ('digest_cron_secret', '<segredo novo>');
```

Depois reaplique as migrations de agendamento (as que chamam `cron.schedule`)
para recriar as cinco tarefas: backup, resumo do médico, vigia, varredura de
boas-vindas e resumo do administrador.

### 6. Autenticação

- Captcha: `security_captcha_enabled`, provider `turnstile`, e a secret key do
  Turnstile — em Authentication → Attack Protection.
- SMTP do Resend e os textos em português — em Authentication → Emails. **Não
  use o remetente padrão do Supabase**: ele manda em inglês e limita a 2
  e-mails por hora, o que trava a confirmação de cadastro a partir do terceiro
  usuário da mesma hora.
- Login com Google: client ID e secret no painel.
- URLs de redirecionamento apontando para o domínio.

### 7. Reapontar o frontend

Variáveis `VITE_SUPABASE_*` na Vercel para o projeto novo, e redeploy.

### 8. Avisar as pessoas

Ninguém entra por senha até redefinir. O caminho é "Esqueci minha senha" na
tela de login, que dispara pelo Resend. Quem usa login com Google entra
direto — o vínculo é restaurado junto.

---

## O ensaio de 03/08/2026

Executado num projeto descartável (`valvepath-restore-drill`, apagado ao
final), a partir do export automático daquele dia.

| Etapa | Resultado |
|---|---|
| 55 migrations aplicadas | 54 ok, 1 falha conhecida (`realtime.messages`) |
| Schema resultante | 39 tabelas, 39 com RLS |
| 38 tabelas + contas carregadas | **todas bateram com o manifesto** |
| Login com senha redefinida | funcionou nas duas contas |
| RLS: o médico dono vê o caso dele | sim |
| RLS: outra conta vê o caso | **não** |
| RLS: anônimo vê o caso | **não** |
| Papéis (`medico`, `admin`) | restaurados |

### Três defeitos que só o ensaio encontrou

1. **O caso clínico não carregava.** `symptoms` e `comorbidities` são `text[]`,
   e o script montava os literais à mão como `::jsonb`. A tabela mais
   importante do sistema ficava vazia enquanto o resto carregava. Corrigido
   passando a conversão para o banco (`jsonb_populate_recordset`), o que
   resolveu junto os enums e a coluna `vector` do RAG.
2. **O catálogo de próteses duplicava** (246 → 492), porque as migrations o
   semeiam. Daí a exigência do `--limpar`.
3. **Ninguém conseguia entrar.** Quatro colunas de `auth.users`
   (`confirmation_token`, `recovery_token`, `email_change`,
   `email_change_token_new`) não têm valor padrão, e o GoTrue as lê como texto:
   nulas, toda operação de conta responde `Database error loading user`. Não
   são credenciais — são marcadores de "nada pendente" — e o restore passa a
   gravá-las como vazio.

Nenhum dos três apareceria numa revisão de código. É a diferença entre ter um
backup e saber que ele volta.

---

## A cópia externa

O backup principal mora dentro do mesmo projeto que ele protege — cobre exclusão
acidental de registro, não cobre perda do projeto. A tarefa `offsite-copy` roda
toda segunda 03:45 UTC, espelha a pasta datada mais recente num provedor
S3-compatível e **relê cada arquivo no destino conferindo o hash** antes de dar a
cópia por concluída. Falha gera alerta, e a tarefa está na lista do vigia diário.

Para ligar (ou trocar de provedor), grave nos segredos do projeto Supabase:
`OFFSITE_ENDPOINT`, `OFFSITE_REGION`, `OFFSITE_BUCKET`, `OFFSITE_KEY_ID`,
`OFFSITE_SECRET`, e ponha `watched_jobs.enabled = true` para `offsite-copy`.
Sem as variáveis a função responde `not_configured` e **não registra execução** —
de propósito: alarme sobre recurso desligado é o caminho mais curto para ninguém
mais olhar alarme nenhum.

A credencial deve ser restrita ao bucket e **sem permissão de exclusão**: uma
chave que não apaga não pode ser usada para destruir o backup.

## Limitação que continua valendo

Os anexos dos exames (`medical-documents`, `patient-documents`) **não** vão na
cópia externa — só os registros do banco. O backup guarda o inventário deles
(caminho, tamanho, tipo), então uma restauração sabe o que falta; mas os bytes
dependem do ambiente principal estar de pé.
