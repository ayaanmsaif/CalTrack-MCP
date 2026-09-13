import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "@supabase/supabase-js";
import { registerTools } from "./tools.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const USER_ID = process.env.CALTRACK_USER_ID;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !USER_ID) {
  console.error(
    `[caltrack] Missing config — SUPABASE_URL: ${!!SUPABASE_URL}, SUPABASE_SECRET_KEY: ${!!SUPABASE_SECRET_KEY}, CALTRACK_USER_ID: ${!!USER_ID}`
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const server = new McpServer({
  name: "caltrack",
  version: "0.1.0",
});

// Local/stdio mode is single-user: every tool call resolves to the same
// fixed CALTRACK_USER_ID from env, regardless of any auth info on the
// request (there is none — stdio has no OAuth layer).
registerTools(server, supabase, () => USER_ID);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
