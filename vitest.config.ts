import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
    },
  },
});
