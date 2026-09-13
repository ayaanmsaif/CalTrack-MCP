type CalTrackConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

declare global {
  interface Window {
    __CALTRACK__?: Partial<CalTrackConfig>;
  }
}

// In production the Express server injects these via /config.js, so the
// same build works on any deployment without baking keys in at build time.
export const config: CalTrackConfig = {
  supabaseUrl: window.__CALTRACK__?.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: window.__CALTRACK__?.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
};

export const mcpUrl = `${window.location.origin}/mcp`;
