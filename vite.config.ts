import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/react-router|\/react\/|\/react-dom\//.test(id)) return "react-vendor";
          if (id.includes("@tanstack/react-query") || id.includes("@tanstack/query-core")) return "query-vendor";
          if (id.includes("@supabase/supabase-js")) return "supabase-vendor";
          if (id.includes("@radix-ui") || id.includes("lucide-react")) return "ui-vendor";
          if (id.includes("react-hook-form") || id.includes("/zod/") || id.includes("@hookform/resolvers")) return "form-vendor";
          return undefined;
        },
      },
    },
  },
}));
