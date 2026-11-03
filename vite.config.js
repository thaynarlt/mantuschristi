import { defineConfig } from "vite";

export default defineConfig({
  // caminhos relativos: o site funciona na raiz de um domínio ou numa subpasta (ex.: GitHub Pages)
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
  server: {
    host: true,
    port: 5173,
  },
});
