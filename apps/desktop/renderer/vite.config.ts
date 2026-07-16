import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, "public"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    target: "chrome130",
    assetsDir: "assets",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
