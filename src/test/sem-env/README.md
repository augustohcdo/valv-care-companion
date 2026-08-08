Diretório propositalmente vazio de `.env`.

`vitest.config.ts` aponta `envDir` para cá. O motivo é concreto: o CI ficou
vermelho por seis commits porque um teste importava, por tabela, o cliente do
Supabase — que exige `VITE_SUPABASE_URL` no momento do import. Na máquina de
quem desenvolve o `.env` existe e o teste passa; no CI não existe e o arquivo
quebra antes de rodar.

Com o `envDir` apontando para um diretório sem `.env`, a suíte local roda nas
mesmas condições do CI, e esse tipo de divergência aparece aqui em vez de só lá.
Teste que precise de variável deve declará-la explicitamente (`vi.stubEnv`).
