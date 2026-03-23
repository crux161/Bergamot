import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  publicDir: path.resolve(__dirname, "public"),

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer"),
      "@bergamot/contracts": path.resolve(__dirname, "../packages/contracts/src"),
      "@bergamot/config": path.resolve(__dirname, "../packages/config/src"),
      "@bergamot/ui-tokens": path.resolve(__dirname, "../packages/ui-tokens/src"),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        // Dart Sass modern API
        api: "modern-compiler",
      },
    },
  },

  build: {
    outDir: path.resolve(__dirname, "dist-web"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/renderer/web.html"),
    },
  },

  server: {
    port: 3001,
    open: true,
  },
});
