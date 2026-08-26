import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  // O CI não tem `.env`, e a máquina de quem desenvolve tem — foi essa diferença
  // que deixou a suíte verde aqui e vermelha lá por seis commits seguidos.
  // Apontando para um diretório sem `.env`, a suíte local roda nas mesmas
  // condições do CI. Ver src/test/sem-env/README.md.
  envDir: path.resolve(import.meta.dirname, "./src/test/sem-env"),
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // As edge functions rodam em Deno e importam com o prefixo `npm:`. O
      // alias deixa o vitest testar o arquivo que de fato é publicado, em vez
      // de uma cópia que divergiria com o tempo.
      "npm:zod@3": "zod",
      "npm:aws4fetch@1.0.20": "aws4fetch",
    },
  },
});
