import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.BASE_PATH || "/umbral-gallery/",
  build: { chunkSizeWarningLimit: 650 },
});
