import { createClient } from "@supabase/supabase-js";
import { config } from "../config";

export const supabase = createClient(config.supabaseUrl || "http://localhost", config.supabaseAnonKey || "missing", {
  auth: {
    flowType: "pkce",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const isConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
