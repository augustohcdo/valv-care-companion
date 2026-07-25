# ValvePath

Plataforma de apoio a pacientes e médicos no acompanhamento de valvopatias cardíacas: jornada do paciente, gestão de casos clínicos, biblioteca de referência, integrações FHIR com hospitais e apoio de IA clínica baseado em diretrizes (SBC, ACC/AHA, ESC).

## Stack

- [Vite](https://vitejs.dev/) + React 18 + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- [React Router](https://reactrouter.com/), [TanStack Query](https://tanstack.com/query), React Hook Form + Zod
- [Supabase](https://supabase.com/) — banco de dados (Postgres + RLS), autenticação, edge functions
- [Vitest](https://vitest.dev/) para testes

## Rodando localmente

Pré-requisitos: Node.js 18+ (ou [Bun](https://bun.sh/)).

```sh
# instalar dependências
npm install   # ou: bun install

# copiar variáveis de ambiente e preencher com os valores do seu projeto Supabase
cp .env.example .env

# subir o servidor de desenvolvimento
npm run dev   # ou: bun run dev
```

Scripts disponíveis:

| Comando | Descrição |
| --- | --- |
| `dev` | Servidor de desenvolvimento (Vite) |
| `build` | Build de produção |
| `build:dev` | Build em modo desenvolvimento |
| `preview` | Preview local do build de produção |
| `lint` | ESLint |
| `test` | Roda os testes uma vez (Vitest) |
| `test:watch` | Testes em modo watch |

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

O backend roda em Supabase: Postgres com Row Level Security em todas as tabelas de dados sensíveis, autenticação nativa (e-mail/senha + OAuth Google), e edge functions para integrações FHIR com hospitais parceiros, geração/consulta de chaves de API, e o assistente de IA clínica (`clinical-ai`), que usa a Anthropic Messages API para geração de texto e a OpenAI Embeddings API para a busca RAG na base de conhecimento.

Segredos necessários nas edge functions (Supabase Dashboard → Edge Functions → Secrets): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, além dos já provisionados pelo Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc).
