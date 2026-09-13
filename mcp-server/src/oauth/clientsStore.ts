import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";

type OAuthClientRow = {
  client_id: string;
  client_secret: string | null;
  client_secret_expires_at: number | null;
  client_id_issued_at: number;
  redirect_uris: string[];
  token_endpoint_auth_method: string | null;
  grant_types: string[] | null;
  response_types: string[] | null;
  client_name: string | null;
  client_uri: string | null;
  logo_uri: string | null;
  scope: string | null;
  contacts: string[] | null;
  tos_uri: string | null;
  policy_uri: string | null;
  jwks_uri: string | null;
  jwks: unknown;
  software_id: string | null;
  software_version: string | null;
};

function rowToClientInfo(row: OAuthClientRow): OAuthClientInformationFull {
  return {
    client_id: row.client_id,
    client_secret: row.client_secret ?? undefined,
    client_id_issued_at: row.client_id_issued_at,
    client_secret_expires_at: row.client_secret_expires_at ?? undefined,
    redirect_uris: row.redirect_uris,
    token_endpoint_auth_method: row.token_endpoint_auth_method ?? undefined,
    grant_types: row.grant_types ?? undefined,
    response_types: row.response_types ?? undefined,
    client_name: row.client_name ?? undefined,
    client_uri: row.client_uri ?? undefined,
    logo_uri: row.logo_uri ?? undefined,
    scope: row.scope ?? undefined,
    contacts: row.contacts ?? undefined,
    tos_uri: row.tos_uri ?? undefined,
    policy_uri: row.policy_uri ?? undefined,
    jwks_uri: row.jwks_uri ?? undefined,
    jwks: (row.jwks as OAuthClientInformationFull["jwks"]) ?? undefined,
    software_id: row.software_id ?? undefined,
    software_version: row.software_version ?? undefined,
  };
}

function clientInfoToRow(client: OAuthClientInformationFull) {
  return {
    client_id: client.client_id,
    client_secret: client.client_secret ?? null,
    client_id_issued_at: client.client_id_issued_at ?? Math.floor(Date.now() / 1000),
    client_secret_expires_at: client.client_secret_expires_at ?? null,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: client.token_endpoint_auth_method ?? "client_secret_post",
    grant_types: client.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: client.response_types ?? ["code"],
    client_name: client.client_name ?? null,
    client_uri: client.client_uri ?? null,
    logo_uri: client.logo_uri ?? null,
    scope: client.scope ?? null,
    contacts: client.contacts ?? null,
    tos_uri: client.tos_uri ?? null,
    policy_uri: client.policy_uri ?? null,
    jwks_uri: client.jwks_uri ?? null,
    jwks: client.jwks ?? null,
    software_id: client.software_id ?? null,
    software_version: client.software_version ?? null,
  };
}

export class CalTrackClientsStore implements OAuthRegisteredClientsStore {
  constructor(private supabase: SupabaseClient) {}

  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const { data } = await this.supabase.from("oauth_clients").select("*").eq("client_id", clientId).maybeSingle();
    return data ? rowToClientInfo(data as OAuthClientRow) : undefined;
  }

  // The interface contract (per the SDK's clients.d.ts) omits client_id/
  // client_id_issued_at from the input type — the store is responsible for
  // them if the router doesn't generate them itself. In practice, with the
  // router's default `clientIdGeneration: true` (which is what we use),
  // both are already populated by the time this is called; the fallback
  // below only matters if that default is ever changed.
  async registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at"> &
      Partial<Pick<OAuthClientInformationFull, "client_id" | "client_id_issued_at">>
  ): Promise<OAuthClientInformationFull> {
    const fullClient: OAuthClientInformationFull = {
      ...client,
      client_id: client.client_id ?? randomUUID(),
      client_id_issued_at: client.client_id_issued_at ?? Math.floor(Date.now() / 1000),
    };

    const { error } = await this.supabase.from("oauth_clients").insert(clientInfoToRow(fullClient));
    if (error) {
      throw new Error(`Failed to persist client registration: ${error.message}`);
    }
    return fullClient;
  }
}
