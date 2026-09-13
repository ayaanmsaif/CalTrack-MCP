import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { createClient } from "@supabase/supabase-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { registerTools, type ToolExtra } from "./tools.js";
import { CalTrackOAuthProvider } from "./oauth/provider.js";
import { createLoginRouter } from "./oauth/login.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const BASE_URL = process.env.BASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = Number(process.env.PORT ?? 8080);

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SUPABASE_ANON_KEY || !BASE_URL || !SESSION_SECRET) {
  console.error(
    `[caltrack-http] Missing config — SUPABASE_URL: ${!!SUPABASE_URL}, SUPABASE_SECRET_KEY: ${!!SUPABASE_SECRET_KEY}, SUPABASE_ANON_KEY: ${!!SUPABASE_ANON_KEY}, BASE_URL: ${!!BASE_URL}, SESSION_SECRET: ${!!SESSION_SECRET}`
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
const provider = new CalTrackOAuthProvider(supabase, { baseUrl: BASE_URL, sessionSecret: SESSION_SECRET });

const app = express();
// Render (and most PaaS) terminate TLS in front of the app — without this,
// req.protocol reads "http", which silently breaks the `secure` cookie flag
// on ct_txn and any self-referential metadata URLs the auth router builds.
app.set("trust proxy", 1);
app.use(cookieParser());

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

// Full OAuth 2.1 authorization server: .well-known metadata, DCR /register,
// /authorize, /token, /revoke — all driven by our CalTrackOAuthProvider.
app.use(
  mcpAuthRouter({
    provider,
    issuerUrl: new URL(BASE_URL),
    resourceServerUrl: new URL(`${BASE_URL}/mcp`),
    resourceName: "CalTrack",
    scopesSupported: ["caltrack"],
  })
);

// The login/consent page and its routes (Google + email/password).
app.use(createLoginRouter(supabase, { baseUrl: BASE_URL, sessionSecret: SESSION_SECRET, supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }));

function resolveHttpUserId(extra: ToolExtra): string {
  const userId = extra.authInfo?.extra?.userId;
  if (typeof userId !== "string") {
    throw new Error("Unauthenticated tool call — no userId on authInfo");
  }
  return userId;
}

// The actual MCP endpoint, protected by a valid bearer token. Stateless: a
// fresh McpServer + transport per request, no in-memory session state to
// lose on a restart or across multiple instances. Construction is cheap
// (just synchronous registerTool calls, no I/O).
app.post(
  "/mcp",
  express.json(),
  requireBearerAuth({
    verifier: provider,
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(`${BASE_URL}/mcp`)),
  }),
  async (req, res) => {
    const server = new McpServer({ name: "caltrack", version: "0.1.0" });
    registerTools(server, supabase, resolveHttpUserId);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
);

// Runtime config for the web app. The Supabase URL and publishable key are
// public by design (row-level security does the access control), so the same
// web build works on any deployment.
app.get("/config.js", (_req, res) => {
  const payload = JSON.stringify({ supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY }).replace(/</g, "\\u003c");
  res.type("application/javascript").set("Cache-Control", "no-store").send(`window.__CALTRACK__=${payload};`);
});

// Landing page + dashboard (the Vite build in ../../web/dist).
const WEB_DIST = process.env.WEB_DIST_DIR ?? path.resolve(__dirname, "../../web/dist");
const WEB_INDEX = path.join(WEB_DIST, "index.html");
if (fs.existsSync(WEB_INDEX)) {
  app.use("/assets", express.static(path.join(WEB_DIST, "assets"), { immutable: true, maxAge: "1y", index: false }));
  app.use(express.static(WEB_DIST, { index: false, maxAge: "1h" }));
  app.get(["/", "/app", "/app/*splat"], (_req, res) => {
    res.set("Cache-Control", "no-cache").sendFile(WEB_INDEX);
  });
} else {
  console.warn(`[caltrack-http] No web build found at ${WEB_DIST}; the landing page and dashboard won't be served.`);
}

// Catch-all error handler — without one, an unexpected error thrown/rejected
// from an async login/consent route would otherwise leak a default Express
// stack-trace page instead of a plain message.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[caltrack-http] Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).send("Something went wrong. Please try again from your AI client.");
  }
});

app.listen(PORT, () => {
  console.log(`[caltrack-http] Listening on port ${PORT}`);
});
