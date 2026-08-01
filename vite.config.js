import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev local, redirige les appels /api vers le Worker lancé par `wrangler dev`
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
