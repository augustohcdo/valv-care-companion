# ValvePath

Plataforma de apoio a pacientes e médicos no acompanhamento de valvopatias cardíacas: jornada do paciente, gestão de casos clínicos, biblioteca de referência, integrações FHIR com hospitais e apoio de IA clínica baseado em diretrizes (SBC, ACC/AHA, ESC).

## Stack

- [Vite](https://vitejs.dev/) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [React Router](https://reactrouter.com/), [TanStack Query](https://tanstack.com/query), React Hook Form + Zod
- [Supabase](https://supabase.com/) — banco de dados (Postgres + RLS), autenticação, edge functions
- [Vitest](https://vitest.dev/) para testes

## Rodando localmente

Pré-requisitos: **Node.js 20.19+** (exigido por Vite 8, ESLint 10 e React Router 7 — está travado em `engines` no `package.json`).

```sh
# instalar dependências
npm install

# copiar variáveis de ambiente e preencher com os valores do seu projeto Supabase
cp .env.example .env

# subir o servidor de desenvolvimento
npm run dev
```

O gerenciador de pacotes é o **npm** — o `package-lock.json` é a fonte de verdade e é o que o CI valida com `npm ci`.

Scripts disponíveis:

| Comando | Descrição |
| --- | --- |
| `dev` | Servidor de desenvolvimento (Vite) |
| `build` | Build de produção |
| `build:dev` | Build em modo desenvolvimento |
| `preview` | Preview local do build de produção |
| `typecheck` | Checagem de tipos (app + configs de build) |
| `typecheck:strict` | Checagem de tipos em modo `strict` no escopo já migrado (`src/lib/`) |
| `lint` | ESLint |
| `test` | Roda os testes uma vez (Vitest) |
| `test:watch` | Testes em modo watch |
| `types:generate` | Regenera os tipos do Supabase a partir do schema (ver abaixo) |

## Recuperação

O `weekly-export` grava o banco inteiro num bucket privado toda segunda. O
procedimento para transformar aqueles arquivos em um sistema funcionando de
novo está em [RECOVERY.md](RECOVERY.md), junto com o registro do ensaio que o
executou de verdade — e dos três defeitos que só o ensaio encontrou.

## Estrutura

```
src/
  pages/
    public/     páginas públicas (marketing, legal, conteúdo educativo)
    auth/       login, cadastro, recuperação de senha
    app/        área autenticada (paciente, médico, hospital, admin)
  components/   componentes compartilhados (inclui components/ui, shadcn)
  integrations/supabase/  cliente e tipos gerados do Supabase
  lib/          utilitários (validação, exportação, labels clínicos)

supabase/
  migrations/   migrations SQL versionadas
  functions/    edge functions (Deno) — IA clínica, FHIR, integrações
```

## Backend

O backend roda em Supabase: Postgres com Row Level Security em todas as tabelas de dados sensíveis, autenticação nativa (e-mail/senha + OAuth Google), e edge functions para integrações FHIR com hospitais parceiros, geração/consulta de chaves de API, e o assistente de IA clínica (`clinical-ai`), que usa a Gemini API tanto para geração de texto (`gemini-3.5-flash`) quanto para os embeddings da busca RAG na base de conhecimento (`gemini-embedding-001`).

Segredos necessários nas edge functions (Supabase Dashboard → Edge Functions → Secrets):

| Segredo | Usado por |
| --- | --- |
| `GEMINI_API_KEY` | `clinical-ai`, `knowledge-seed` (geração de texto e embeddings) |
| `TURNSTILE_SITE_KEY` | `turnstile-config` (entrega a site key ao frontend) |
| `RESEND_API_KEY` | `_shared/sendEmail.ts` — boas-vindas e alertas operacionais |
| `ALERT_EMAIL_TO` | destinatário dos alertas do `job-watchdog`; também vira o `Reply-To` das mensagens |
| `ALERT_EMAIL_FROM` | remetente (opcional; o padrão é `nao-responda@envio.valvepath.com.br`) |

Além desses, o Supabase já provisiona automaticamente `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_PUBLISHABLE_KEY`.

O `TURNSTILE_SECRET_KEY` **não** é usado por edge function nenhuma: o captcha é validado pelo próprio servidor de autenticação do Supabase, configurado em Authentication → Attack Protection. Validar por conta própria seria impossível de qualquer forma — o token do Turnstile é de uso único, então quem valida primeiro impede o outro de validar.

### E-mail

Duas coisas distintas saem por e-mail, e ambas passam pelo Resend com o domínio `envio.valvepath.com.br`:

- **Autenticação** (confirmação de cadastro, recuperação de senha, link de acesso): enviada pelo próprio Supabase Auth via SMTP do Resend, com os textos em português configurados em Authentication → Emails. O remetente padrão do Supabase **não** serve aqui: além de mandar texto em inglês que não pode ser trocado no plano gratuito, ele limita o envio a 2 e-mails por hora — a partir do terceiro cadastro na mesma hora, ninguém receberia o link de confirmação.
- **Produto** (boas-vindas, alertas de tarefa agendada): enviada pelas edge functions via `_shared/sendEmail.ts`. Sem `RESEND_API_KEY` o envio fica inerte e devolve o motivo, sem lançar — nada quebra, só não sai e-mail.

### Tipos gerados do Supabase

`src/integrations/supabase/types.ts` é **gerado a partir do schema do banco**, não escrito à mão. Sempre que uma migration adicionar ou alterar colunas/tabelas, regenere:

```sh
SUPABASE_ACCESS_TOKEN=sbp_xxx npm run types:generate
```

O token é um [Personal Access Token](https://supabase.com/dashboard/account/tokens) da Management API — não confundir com a anon key nem com a service role key. Como ele tem poder praticamente total sobre o projeto, não deve ser commitado nem guardado como secret de CI. Esquecer esse passo faz o `npm run typecheck` falhar com erros do tipo `'<coluna>' does not exist in type ...`.

## Deploy (Vercel)

O `vercel.json` da raiz existe por um motivo só, e **não pode ser removido**: o
preset de Vite da Vercel não adiciona o *fallback* de SPA sozinho. Sem o
`rewrite` de `/(.*)` para `/index.html`, qualquer caminho que não seja um arquivo
no disco devolve o 404 da própria Vercel, antes de chegar ao React.

Isso não aparece navegando pelo site — o React Router troca a rota no navegador,
sem passar pelo servidor. Quebra só quando o caminho é **pedido** à Vercel:
recarregar a página, abrir um favorito, ou clicar num link de e-mail. Foi assim
que o link de redefinir senha, o retorno do login com Google (`/auth/callback`)
e a confirmação de cadastro ficaram caindo em 404 sem ninguém perceber.

Os *rewrites* são aplicados **depois** da checagem de arquivos, então
`/assets/*`, `/robots.txt` e `/favicon.ico` continuam vindo do disco.

`npm run smoke` pede cada rota do app à URL de produção e falha listando as
quebradas — é a verificação que faltava, já que `npm run dev` tem o fallback
embutido e por isso nunca reproduz esse defeito localmente.

## CI

O workflow em `.github/workflows/ci.yml` roda a cada push e pull request, em Node 22, e falha o build se qualquer etapa quebrar:

`npm ci` → `typecheck` → `typecheck:strict` → `lint` → `test` → `build`

Nenhuma credencial do Supabase é necessária: o build é estático e o cliente só é instanciado em runtime, no navegador.

### TypeScript strict — migração incremental

O `tsconfig.app.json` compartilhado ainda roda com `strict: false` (dívida herdada). Em vez de virar a chave de uma vez, existe um `tsconfig.strict.json` separado que roda como etapa própria do CI (`typecheck:strict`), então uma regressão de tipagem falha de forma específica e isolada.

Hoje ele cobre **todo o `src/`** (exceto arquivos de teste) com `strict` mais `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noImplicitOverride` e `noPropertyAccessFromIndexSignature`.

> **Atenção ao editar esse arquivo:** ele estende o `tsconfig.app.json`, que desliga várias sub-flags de `strict` explicitamente. Uma flag explícita no config pai **vence** o `strict: true` do filho — por isso as quatro precisam ser religadas uma a uma. Confira com `npx tsc -p tsconfig.strict.json --showConfig` se tiver dúvida sobre o que está realmente valendo.

Flags ainda não adotadas, com o custo já medido: `exactOptionalPropertyTypes` (31 erros), `verbatimModuleSyntax` (20) e `noUncheckedIndexedAccess` (16).
