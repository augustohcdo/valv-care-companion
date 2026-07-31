#!/usr/bin/env node
/**
 * Regenera src/integrations/supabase/types.ts a partir do schema real do
 * projeto Supabase.
 *
 * Rode isso sempre que uma migration adicionar/alterar/remover coluna ou
 * tabela. Sem isso, o `tsc` quebra com erros do tipo "'deleted_at' does not
 * exist in type ..." — os tipos são gerados, não escritos à mão.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx npm run types:generate
 *
 * O token é o Personal Access Token da Management API
 * (https://supabase.com/dashboard/account/tokens). Ele NÃO é o mesmo que a
 * anon key nem a service role key, e por ser praticamente root do projeto
 * não deve ser commitado nem guardado como secret de CI num repo público.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "src/integrations/supabase/types.ts");

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error(
    "Erro: SUPABASE_ACCESS_TOKEN não está definida.\n" +
      "Gere um token em https://supabase.com/dashboard/account/tokens e rode:\n" +
      "  SUPABASE_ACCESS_TOKEN=sbp_xxx npm run types:generate",
  );
  process.exit(1);
}

// O project ref já está versionado no config.toml — não precisa ser passado.
const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
const ref = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if (!ref) {
  console.error("Erro: não achei project_id em supabase/config.toml.");
  process.exit(1);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!res.ok) {
  console.error(`Erro ${res.status} ao consultar a Management API: ${await res.text()}`);
  process.exit(1);
}

const { types } = await res.json();
if (!types) {
  console.error("Erro: a resposta da API não trouxe o campo 'types'.");
  process.exit(1);
}

const previous = (() => {
  try {
    return readFileSync(OUT, "utf8");
  } catch {
    return null;
  }
})();

writeFileSync(OUT, types);

if (previous === types) {
  console.log(`Tipos já estavam atualizados (projeto ${ref}) — nada mudou.`);
} else {
  console.log(`Tipos regenerados do projeto ${ref} -> src/integrations/supabase/types.ts`);
  console.log("Rode `npm run typecheck` e commite o arquivo junto com a migration.");
}
