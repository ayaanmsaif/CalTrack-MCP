import { Router, urlencoded, type Request, type Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import pkceChallenge from "pkce-challenge";
import { randomToken, verifySignedValue } from "./crypto.js";

export type LoginRouterOptions = {
  baseUrl: string;
  sessionSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type LoginTransactionRow = {
  id: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scopes: string[];
  state: string | null;
  resource: string | null;
  google_code_verifier: string | null;
  user_id: string | null;
  status: "pending" | "authenticated";
  expires_at: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LOGO = `<img src="/logo.png" alt="" width="26" height="31" style="height:31px;width:auto;display:block">`;

const GOOGLE = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.27 14.27A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.55.37-2.27V6.62H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.11Z"/><path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.26 6.62l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"/></svg>`;

const GITHUB = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;

const TICK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;

const CSS = `
:root{--paper:#fafbf7;--ink:#0d2a1e;--ink2:#43594e;--ink3:#7d8e85;--line:#e3e9e2;--leaf:#17914f;--leaf50:#f1f8f3;--leaf100:#ddf2e4}
*{box-sizing:border-box}
html,body{margin:0}
body{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;background-color:var(--paper);background-image:radial-gradient(circle at 1px 1px,rgb(13 42 30/.07) 1px,transparent 0);background-size:24px 24px;color:var(--ink);font-family:"Geist",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.card{width:100%;max-width:420px;background:#fff;border-radius:28px;padding:32px;box-shadow:0 0 0 1px var(--line),0 40px 80px -40px rgb(13 42 30/.3);animation:rise .6s cubic-bezier(.22,1,.36,1) both}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.card{animation:none}}
.brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-weight:600;font-size:17px;letter-spacing:-.02em}
h1{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:42px;line-height:1;letter-spacing:-.02em;margin:28px 0 10px;text-wrap:balance}
h1 em{font-style:italic;color:var(--leaf)}
.sub{color:var(--ink2);font-size:15px;line-height:1.55;margin:0 0 24px}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:48px;border-radius:999px;border:0;font:inherit;font-size:15px;font-weight:500;cursor:pointer;text-decoration:none;transition:background-color .2s,box-shadow .2s,transform .1s}
.btn:active{transform:scale(.985)}
.btn-provider,.btn-secondary{background:#fff;color:var(--ink);box-shadow:0 0 0 1px var(--line)}
.btn-provider:hover,.btn-secondary:hover{box-shadow:0 0 0 1px #c5cfc6}
.providers{display:grid;gap:10px}
.btn-primary{background:var(--ink);color:#fff}
.btn-primary:hover{background:#0c4d2b}
form{display:grid;gap:10px}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.msg{padding:12px 14px;border-radius:16px;font-size:14px;line-height:1.45;margin:0 0 16px}
.msg-error{background:#fdf0ea}
.hint{margin:14px 0 0;color:var(--ink3);font-size:13px;line-height:1.5}
.hint a{color:var(--leaf);font-weight:500;text-decoration:underline;text-underline-offset:2px}
.account{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:var(--paper);font-size:14px;color:var(--ink2);margin:0 0 20px;overflow:hidden}
.account span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.avatar{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:var(--leaf100);color:#0c4d2b;font-weight:600;font-size:13px;flex-shrink:0}
ul.scopes{list-style:none;padding:0;margin:0 0 24px;display:grid;gap:12px}
ul.scopes li{display:flex;gap:10px;align-items:flex-start;font-size:15px;line-height:1.45;color:var(--ink)}
.tick{display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:var(--leaf);color:#fff;flex-shrink:0;margin-top:1px}
.fine{margin:20px 0 0;font-size:12.5px;color:var(--ink3);text-align:center}
@media (max-width:480px){.card{padding:24px;border-radius:24px}h1{font-size:36px}}
`;

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#fafbf7">
<title>${escapeHtml(title)} · CalTrack</title>
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<main class="card">
<a class="brand" href="/">${LOGO}<span>CalTrack</span></a>
${body}
</main>
<p class="fine">Nutrition figures are estimates, not medical advice.</p>
</body>
</html>`;
}

const expiredPage = () =>
  page(
    "Link expired",
    `<h1>That link has <em>expired</em>.</h1><p class="sub">Sign-in links only last a few minutes. Head back to your AI app and connect again.</p>`
  );

const errorPage = (message: string) =>
  page("Something went wrong", `<h1>Something went <em>wrong</em>.</h1><p class="sub">${escapeHtml(message)}</p>`);

// Sign-in providers offered on the login page. Each must also be enabled in
// Supabase (Authentication → Sign In / Providers).
const PROVIDERS = { google: "Google", github: "GitHub" } as const;
type ProviderId = keyof typeof PROVIDERS;
const isProvider = (value: string): value is ProviderId => value === "google" || value === "github";

async function getPendingTxn(req: Request, supabase: SupabaseClient, sessionSecret: string): Promise<LoginTransactionRow | null> {
  const cookie = req.cookies?.ct_txn as string | undefined;
  if (!cookie) return null;

  const txnId = verifySignedValue(cookie, sessionSecret);
  if (!txnId) return null;

  const { data } = await supabase.from("oauth_login_transactions").select("*").eq("id", txnId).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;

  return data as LoginTransactionRow;
}

async function finishAuthorization(supabase: SupabaseClient, txn: LoginTransactionRow, res: Response): Promise<void> {
  if (!txn.user_id) {
    res.status(500).send(errorPage("No signed-in account was found for this request. Please try connecting again."));
    return;
  }

  const code = randomToken(32);
  const { error } = await supabase.from("oauth_authorization_codes").insert({
    code,
    client_id: txn.client_id,
    user_id: txn.user_id,
    redirect_uri: txn.redirect_uri,
    code_challenge: txn.code_challenge,
    scopes: txn.scopes,
    resource: txn.resource,
  });

  await supabase.from("oauth_login_transactions").delete().eq("id", txn.id);
  res.clearCookie("ct_txn", { path: "/" });

  if (error) {
    res.status(500).send(errorPage("We couldn't finish connecting your account. Please try again from your AI app."));
    return;
  }

  const redirect = new URL(txn.redirect_uri);
  redirect.searchParams.set("code", code);
  if (txn.state) redirect.searchParams.set("state", txn.state);
  res.redirect(redirect.toString());
}

export function createLoginRouter(supabase: SupabaseClient, opts: LoginRouterOptions): Router {
  const router = Router();
  // Scoped to this router only — the SDK's own auth handlers (register/token/etc.)
  // apply their own express.json() internally, so a body-parser at the app root
  // would try to re-read an already-consumed request stream on those routes.
  router.use(urlencoded({ extended: true }));

  router.get("/login", async (req, res) => {
    const txn = await getPendingTxn(req, supabase, opts.sessionSecret);
    if (!txn) {
      res.status(400).send(expiredPage());
      return;
    }

    const error = typeof req.query.error === "string" ? req.query.error : null;
    const txnParam = encodeURIComponent(txn.id);

    res.send(
      page(
        "Sign in",
        `<h1>Sign in to <em>CalTrack</em></h1>
<p class="sub">Your AI app wants to connect. Use the same account as your CalTrack dashboard. New here? Signing in creates your account.</p>
${error ? `<div class="msg msg-error" role="alert">${escapeHtml(error)}</div>` : ""}
<div class="providers">
<a class="btn btn-provider" href="/auth/google/start?txn=${txnParam}">${GOOGLE}Continue with Google</a>
<a class="btn btn-provider" href="/auth/github/start?txn=${txnParam}">${GITHUB}Continue with GitHub</a>
</div>
<p class="hint">CalTrack never sees your Google or GitHub password.</p>`
      )
    );
  });

  router.get("/auth/:provider/start", async (req, res) => {
    const provider = req.params.provider;
    if (!isProvider(provider)) {
      res.status(404).send(errorPage("That sign-in option isn't available."));
      return;
    }

    const txn = await getPendingTxn(req, supabase, opts.sessionSecret);
    if (!txn) {
      res.status(400).send(expiredPage());
      return;
    }

    // Our own PKCE pair for the CalTrack <-> Supabase leg. The column is named
    // after Google (the first provider) but holds the verifier for any provider.
    const { code_verifier, code_challenge } = await pkceChallenge();
    await supabase.from("oauth_login_transactions").update({ google_code_verifier: code_verifier }).eq("id", txn.id);

    const authorizeUrl = new URL(`${opts.supabaseUrl}/auth/v1/authorize`);
    authorizeUrl.searchParams.set("provider", provider);
    authorizeUrl.searchParams.set("redirect_to", `${opts.baseUrl}/auth/${provider}/callback`);
    authorizeUrl.searchParams.set("code_challenge", code_challenge);
    authorizeUrl.searchParams.set("code_challenge_method", "s256");
    // Supabase forwards this to the provider, which then always shows its
    // account chooser rather than silently reusing the browser's signed-in account.
    authorizeUrl.searchParams.set("prompt", "select_account");

    res.redirect(authorizeUrl.toString());
  });

  router.get("/auth/:provider/callback", async (req, res) => {
    const provider = req.params.provider;
    const txn = await getPendingTxn(req, supabase, opts.sessionSecret);
    if (!isProvider(provider) || !txn) {
      res.status(400).send(expiredPage());
      return;
    }

    // No code means the person cancelled at Google/GitHub or the provider
    // refused. Either way, send them back to pick a sign-in option again.
    const retry = `/login?txn=${encodeURIComponent(txn.id)}&error=${encodeURIComponent(`${PROVIDERS[provider]} sign-in didn't go through. Please try again.`)}`;
    const code = typeof req.query.code === "string" ? req.query.code : null;
    if (!code || !txn.google_code_verifier) {
      res.redirect(retry);
      return;
    }

    const tokenRes = await fetch(`${opts.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: opts.supabaseAnonKey },
      body: JSON.stringify({ auth_code: code, code_verifier: txn.google_code_verifier }),
    });

    if (!tokenRes.ok) {
      res.redirect(retry);
      return;
    }

    const session = (await tokenRes.json()) as { user?: { id: string } };
    if (!session.user?.id) {
      res.redirect(retry);
      return;
    }

    await supabase.from("oauth_login_transactions").update({ user_id: session.user.id, status: "authenticated" }).eq("id", txn.id);
    res.redirect(`/consent?txn=${encodeURIComponent(txn.id)}`);
  });

  router.get("/consent", async (req, res) => {
    const txn = await getPendingTxn(req, supabase, opts.sessionSecret);
    if (!txn || txn.status !== "authenticated" || !txn.user_id) {
      res.status(400).send(expiredPage());
      return;
    }

    const { data: consent } = await supabase
      .from("oauth_consents")
      .select("scopes")
      .eq("user_id", txn.user_id)
      .eq("client_id", txn.client_id)
      .maybeSingle();

    const alreadyGranted = consent && txn.scopes.every((s) => consent.scopes.includes(s));
    if (alreadyGranted) {
      await finishAuthorization(supabase, txn, res);
      return;
    }

    const { data: client } = await supabase.from("oauth_clients").select("client_name").eq("client_id", txn.client_id).maybeSingle();
    const { data: userData } = await supabase.auth.admin.getUserById(txn.user_id);
    const clientName = client?.client_name || "This app";
    const email = userData?.user?.email ?? null;

    res.send(
      page(
        "Allow access",
        `<h1>Allow <em>${escapeHtml(clientName)}</em> to use CalTrack?</h1>
<p class="sub">You'll only need to approve this once.</p>
${email ? `<div class="account"><span class="avatar">${escapeHtml(email.charAt(0).toUpperCase())}</span><span>${escapeHtml(email)}</span></div>` : ""}
<ul class="scopes">
<li><span class="tick">${TICK}</span>Log, edit and read your meals</li>
<li><span class="tick">${TICK}</span>Read and update your weight, water and goals</li>
<li><span class="tick">${TICK}</span>Access is limited to this account</li>
</ul>
<form method="post" action="/consent">
<input type="hidden" name="txn" value="${escapeHtml(txn.id)}">
<div class="row">
<button class="btn btn-secondary" type="submit" name="decision" value="deny">Deny</button>
<button class="btn btn-primary" type="submit" name="decision" value="approve">Allow</button>
</div>
</form>
<p class="hint">Not you? <a href="/login?txn=${encodeURIComponent(txn.id)}">Use a different account</a></p>`
      )
    );
  });

  router.post("/consent", async (req, res) => {
    const { txn: txnParam, decision } = req.body as { txn?: string; decision?: string };
    const txn = await getPendingTxn(req, supabase, opts.sessionSecret);

    if (!txn || txn.id !== txnParam || txn.status !== "authenticated" || !txn.user_id) {
      res.status(400).send(expiredPage());
      return;
    }

    if (decision !== "approve") {
      await supabase.from("oauth_login_transactions").delete().eq("id", txn.id);
      res.clearCookie("ct_txn", { path: "/" });
      const redirect = new URL(txn.redirect_uri);
      redirect.searchParams.set("error", "access_denied");
      if (txn.state) redirect.searchParams.set("state", txn.state);
      res.redirect(redirect.toString());
      return;
    }

    await supabase.from("oauth_consents").upsert({ user_id: txn.user_id, client_id: txn.client_id, scopes: txn.scopes });
    await finishAuthorization(supabase, txn, res);
  });

  return router;
}
