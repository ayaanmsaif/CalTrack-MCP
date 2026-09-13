import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Runtime config (Supabase URL + publishable key) is served by the Express
    // server in production; proxy it in dev so both paths behave the same.
    proxy: {
      "/config.js": "http://localhost:8080",
    },
  },
});
