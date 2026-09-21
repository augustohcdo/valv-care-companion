import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      // Regras do React Compiler, novas no eslint-plugin-react-hooks v7.
      // Apontam 29 ocorrências espalhadas por 28 arquivos (quase todas o
      // padrão `useEffect(() => { load() })` que preenche estado na montagem).
      // São sinais legítimos, mas corrigi-los é um refactor à parte — ficam
      // como warning (visíveis em todo run de CI) em vez de travar o build.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    /**
     * Todo `.mjs` do repositório — 30 arquivos que o lint nunca tinha visto.
     *
     * O glob é `**\/*.mjs`, e não `scripts/**\/*.mjs`, porque regra amarrada ao
     * diretório onde o defeito apareceu é o próprio defeito. Havia um
     * `.shot-tmp.mjs` versionado na raiz — script descartável de captura de tela,
     * commitado sem querer, que ninguém chama e que cravava
     * `/opt/pw-browsers/chromium`. Nem o lint nem a guarda de Chromium o viam:
     * os dois olhavam só para dentro de `scripts/`. Ele foi apagado; o glob
     * largo é o que impede o próximo.
     *
     * ## Como isto apareceu
     *
     * O bloco acima vale para `**\/*.{ts,tsx}`. Nada mais. `npm run lint` é
     * `eslint .`, roda em toda CI e dizia "0 erros" — verdade sobre os arquivos
     * que ele olhava, e silêncio sobre 29 que ele não olhava. É a mesma família
     * de defeito que esta sessão persegue, dentro do próprio linter: relatar
     * sucesso sem ter feito o trabalho.
     *
     * O que estava escondido ali: `ferramentas-verificar.mjs`, `mobile.mjs` e
     * `rotas-renderizam.mjs` chamavam `opcoesDoChromium()` **sem importar**.
     * `node --check` passava (a referência só falha em tempo de execução) e o
     * teste que eu tinha escrito passava também, porque ele conferia a AUSÊNCIA
     * de `executablePath:` — e um arquivo que nem carrega também não tem
     * `executablePath:`. Guarda que só sabe dizer "não vi a coisa errada"
     * aprova o arquivo que não faz nada.
     *
     * A agenda diária acusou `ReferenceError: opcoesDoChromium is not defined`.
     * `no-undef` pega essa classe inteira — em todo script, para todo nome,
     * para sempre — e não custa uma regra nova a cada defeito novo.
     *
     * ## Por que os globais do navegador entram
     *
     * Estes scripts passam funções para `page.evaluate()`, que roda DENTRO da
     * página: `document`, `window` e `location` são legítimos ali. Sem eles,
     * `no-undef` acusaria 17 linhas corretas. Falso vermelho importa tanto
     * quanto falso verde — guarda que pune quem fez certo é guarda que alguém
     * desliga.
     */
    files: ["**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Não usado é estilo; não definido é um script que não roda. Ligar só o
      // segundo mantém o sinal com significado — e foi o segundo que quebrou a
      // agenda diária.
      "no-unused-vars": "off",
      // `catch { /* tenta o próximo */ }` é intencional em todo carregador de
      // Playwright daqui, e o comentário diz por quê.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
);
