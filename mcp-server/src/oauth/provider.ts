import type { Response } from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuthServerProvider, AuthorizationParams } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { InvalidGrantError, InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { CalTrackClientsStore } from "./clientsStore.js";
import { randomToken, sha256Hex, signValue } from "./crypto.js";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1h
const REFRESH_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60; // 90d

export class CalTrackOAuthProvider implements OAuthServerProvider {
  private clients: CalTrackClientsStore;
  // We issue our own authorization codes rather than proxying an upstream
  // OAuth server that would validate PKCE itself — so the SDK's built-in
  // token handler should validate PKCE locally, hence this stays falsy.
  skipLocalPkceValidation = false;

  constructor(
    private supabase: SupabaseClient,
    private opts: { baseUrl: string; sessionSecret: string }
  ) {
    this.clients = new CalTrackClientsStore(supabase);
  }

  get clientsStore(): CalTrackClientsStore {
    return this.clients;
  }

  async authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void> {
    const txnId = randomToken(32);

    const { error } = await this.supabase.from("oauth_login_transactions").insert({
      id: txnId,
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      scopes: params.scopes ?? [],
      state: params.state ?? null,
      resource: params.resource?.toString() ?? null,
    });

    if (error) {
      const url = new URL(params.redirectUri);
      url.searchParams.set("error", "server_error");
      if (params.state) url.searchParams.set("state", params.state);
      res.redirect(url.toString());
      return;
    }

    res.cookie("ct_txn", signValue(txnId, this.opts.sessionSecret), {
      httpOnly: true,
      secure: true,
      // Must be Lax, not Strict — this cookie has to survive the top-level
      // navigation back from Google/Supabase to /auth/google/callback.
      // Strict would silently drop it there and break the whole flow.
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/",
    });

    res.redirect(303, `/login?txn=${encodeURIComponent(txnId)}`);
  }

  async challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string> {
    const { data } = await this.supabase
      .from("oauth_authorization_codes")
      .select("code_challenge, client_id, used, expires_at")
      .eq("code", authorizationCode)
      .maybeSingle();

    if (!data || data.client_id !== client.client_id || data.used || new Date(data.expires_at) < new Date()) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }

    return data.code_challenge;
  }

  // Note: codeVerifier is intentionally unused. The SDK's own token handler
  // already validates PKCE (via challengeForAuthorizationCode + its own
  // verifyChallenge call) before this is ever invoked, and passes
  // codeVerifier=undefined here when skipLocalPkceValidation is false.
  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string
  ): Promise<OAuthTokens> {
    const { data: row } = await this.supabase
      .from("oauth_authorization_codes")
      .select("*")
      .eq("code", authorizationCode)
      .maybeSingle();

    if (!row || row.client_id !== client.client_id || row.used || new Date(row.expires_at) < new Date()) {
      throw new InvalidGrantError("Invalid or expired authorization code");
    }
    if (redirectUri && redirectUri !== row.redirect_uri) {
      throw new InvalidGrantError("redirect_uri mismatch");
    }

    // Atomic single-use claim — guards against a retried/duplicated token
    // request double-spending the same code.
    const { data: claimed } = await this.supabase
      .from("oauth_authorization_codes")
      .update({ used: true })
      .eq("code", authorizationCode)
      .eq("used", false)
      .select()
      .maybeSingle();

    if (!claimed) {
      throw new InvalidGrantError("Authorization code already used");
    }

    return this.issueTokens(client.client_id, row.user_id, row.scopes, row.resource ?? undefined);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
    resource?: URL
  ): Promise<OAuthTokens> {
    const hash = sha256Hex(refreshToken);
    const { data: row } = await this.supabase
      .from("oauth_tokens")
      .select("*")
      .eq("refresh_token_hash", hash)
      .eq("client_id", client.client_id)
      .maybeSingle();

    if (
      !row ||
      row.revoked_at ||
      !row.refresh_token_expires_at ||
      new Date(row.refresh_token_expires_at) < new Date()
    ) {
      throw new InvalidGrantError("Invalid or expired refresh token");
    }

    const nextScopes = scopes && scopes.length > 0 ? scopes : row.scopes;
    // Rotate in place (same row id) rather than insert+revoke-old — keeps one
    // row per live (user, client) connection, matching the "each
    // independently revocable" connected-apps model from spec §10.
    return this.issueTokens(client.client_id, row.user_id, nextScopes, resource?.toString() ?? row.resource ?? undefined, row.id);
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const hash = sha256Hex(token);
    const { data: row } = await this.supabase.from("oauth_tokens").select("*").eq("access_token_hash", hash).maybeSingle();

    if (!row || row.revoked_at || new Date(row.access_token_expires_at) < new Date()) {
      throw new InvalidTokenError("Invalid or expired access token");
    }

    return {
      token,
      clientId: row.client_id,
      scopes: row.scopes,
      expiresAt: Math.floor(new Date(row.access_token_expires_at).getTime() / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { userId: row.user_id },
    };
  }

  async revokeToken(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void> {
    const hash = sha256Hex(request.token);
    // No error if nothing matched — required by RFC 7009 / the provider contract.
    await this.supabase
      .from("oauth_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", client.client_id)
      .or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`);
  }

  private async issueTokens(
    clientId: string,
    userId: string,
    scopes: string[],
    resource: string | undefined,
    rotateRowId?: string
  ): Promise<OAuthTokens> {
    const accessToken = `ct_at_${randomToken(32)}`;
    const refreshToken = `ct_rt_${randomToken(32)}`;
    const now = Date.now();

    const row = {
      client_id: clientId,
      user_id: userId,
      access_token_hash: sha256Hex(accessToken),
      refresh_token_hash: sha256Hex(refreshToken),
      scopes,
      resource: resource ?? null,
      access_token_expires_at: new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
      revoked_at: null,
    };

    if (rotateRowId) {
      await this.supabase.from("oauth_tokens").update(row).eq("id", rotateRowId);
    } else {
      await this.supabase.from("oauth_tokens").insert(row);
    }

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: scopes.join(" "),
    };
  }
}
