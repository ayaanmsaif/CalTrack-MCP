import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// In production the Express server swaps this placeholder for the real
// address; in dev there is no Express server in front, so do it here.
const devOrigin = {
  name: "caltrack-dev-origin",
  apply: "serve" as const,
  transformIndexHtml: (html: string) => html.replaceAll("__CALTRACK_ORIGIN__", "http://localhost:5173"),
};

export default defineConfig({
  plugins: [react(), tailwindcss(), devOrigin],
  server: {
    port: 5173,
    // Runtime config (Supabase URL + publishable key) is served by the Express
    // server in production; proxy it in dev so both paths behave the same.
    proxy: {
      "/config.js": "http://localhost:8080",
    },
  },
});
