import type { BergamotFeatureManifest, BergamotRuntimeConfig } from "@bergamot/contracts";
import { buildApiBaseUrl, buildRootUrl } from "@bergamot/config";
import {
  activateStoredAccount,
  clearActiveSessionToken,
  listStoredAccounts,
  rememberStoredAccount,
  removeActiveStoredAccount,
  removeStoredAccount,
  type StoredAccount,
} from "./accountStore";

// ── Configurable backend URL ──
// Priority: localStorage override → window global → default localhost
const SERVER_URL_KEY = "bergamot_server_url";
const DEFAULT_SERVER = "http://localhost:8000";

function getServerUrl(): string {
  return localStorage.getItem(SERVER_URL_KEY) || (window as any).__BERGAMOT_API_URL__?.replace(/\/api\/v1$/, "") || DEFAULT_SERVER;
}

export function setServerUrl(url: string) {
  const clean = url.replace(/\/+$/, ""); // strip trailing slashes
  localStorage.setItem(SERVER_URL_KEY, clean);
  // Reload to re-initialize all connections with the new URL
  window.location.reload();
}

export function getConfiguredServerUrl(): string {
  return getServerUrl();
}

function getBaseUrl(): string {
  return buildApiBaseUrl(getServerUrl());
}

function getRootUrl(): string {
  return buildRootUrl(getServerUrl());
}

export async function getInstanceConfig(): Promise<BergamotRuntimeConfig> {
  return request("/instance/config");
}

export async function getInstanceFeatures(): Promise<BergamotFeatureManifest> {
  return request("/instance/features");
}

let accessToken: string | null = localStorage.getItem('bergamot_token');

function getClientHeaderValue(): string {
  return (window as any).bergamot ? "Proteus Desktop" : "Proteus Web";
}

export function setToken(token: string) {
  accessToken = token;
  localStorage.setItem('bergamot_token', token);
}

export function clearToken() {
  accessToken = null;
  clearActiveSessionToken();
}

export function getToken(): string | null {
  return accessToken || localStorage.getItem('bergamot_token');
}

export type { StoredAccount };

// ── Types ──

export interface UserRead {
  id: string;
  username: string;
  email: string;
  email_verified?: boolean;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  status_message: string | null;
  created_at: string;
}

export interface UserUpdate {
  display_name?: string | null;
  avatar_url?: string | null;
  banner_url?: string | null;
  status?: "online" | "idle" | "dnd" | "offline";
  status_message?: string | null;
}

export interface ServerRead {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: string;
}

export interface ServerInviteRead {
  id: string;
  server_id: string;
  inviter_user_id: string;
  inviter_username: string | null;
  server_name: string;
  code: string;
  label: string | null;
  notes: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  invite_url: string;
}

export interface ServerInvitePreviewRead {
  code: string;
  valid: boolean;
  server_id: string | null;
  server_name: string | null;
  inviter_username: string | null;
  inviter_display_name: string | null;
  label: string | null;
  notes: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  member_count: number;
}

export interface ServerInviteAcceptRead {
  ok: boolean;
  already_member: boolean;
  server_id: string;
  server_name: string;
}

export interface GiftCodeRead {
  id: string;
  code: string;
  title: string;
  description: string | null;
  claim_message: string | null;
  theme: string | null;
  expires_at: string | null;
  claimed_at: string | null;
  created_at: string;
  claimed_by_user_id: string | null;
  gift_url: string;
}

export interface GiftCodePreviewRead {
  code: string;
  valid: boolean;
  title: string;
  description: string | null;
  claim_message: string | null;
  theme: string | null;
  expires_at: string | null;
  claimed: boolean;
  claimed_by_user_id: string | null;
}

export interface GiftClaimRead {
  ok: boolean;
  already_claimed: boolean;
  title: string;
  description: string | null;
  claim_message: string | null;
  theme: string | null;
}

export interface ChannelRead {
  id: string;
  name: string;
  topic: string | null;
  channel_type: "text" | "voice";
  position: number;
  server_id: string;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
  session_id?: string | null;
  expires_at?: string | null;
}

export const RelationshipType = {
  FRIEND: 1,
  BLOCKED: 2,
  INCOMING_REQUEST: 3,
  OUTGOING_REQUEST: 4,
} as const;

export interface FriendshipRead {
  id: string;
  peer_id: string;
  relationship_type: number;
  nickname: string | null;
  created_at: string;
  peer_username: string | null;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  peer_banner_url: string | null;
  peer_status: string | null;
  peer_status_message: string | null;
}

export interface MutualServerRead {
  id: string;
  name: string;
  icon_url: string | null;
}

export interface MfaStatusRead {
  enabled: boolean;
  pending_setup: boolean;
  enabled_at: string | null;
}

export interface TotpSetupRead extends MfaStatusRead {
  secret: string;
  otpauth_uri: string;
  issuer: string;
  account_name: string;
}

export interface PasskeyRead {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  transports: string[];
}

export interface PasskeyChallengeRead {
  challenge_id: string;
  public_key: Record<string, any>;
}

export interface AuthSessionRead {
  id: string;
  client_name: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
  current: boolean;
}

export interface RevokeOtherSessionsRead {
  revoked_count: number;
}

export interface PendingAccountStatusRead {
  email: string | null;
  email_verified: boolean;
  verification_required: boolean;
}

export interface AuthEntryPreviewRead {
  flow: "invite" | "gift" | "theme";
  valid: boolean;
  title: string;
  description: string;
  token: string | null;
  theme: string | null;
  expires_at: string | null;
  payload: Record<string, any> | null;
}

export interface ExternalConnectionRead {
  id: string;
  provider: string;
  provider_label?: string | null;
  provider_account_id: string;
  username: string | null;
  display_name: string | null;
  profile_url: string | null;
  connection_metadata?: Record<string, any> | null;
  linked_at: string;
  last_used_at: string | null;
}

export interface ExternalConnectionCreate {
  provider_account_id: string;
  username?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
}

export interface ExternalConnectionProviderRead {
  id: string;
  label: string;
  description: string;
  default_scopes: string[];
  profile_url_template: string | null;
  supports_login: boolean;
  supports_linking: boolean;
}

export interface ExternalConnectionLinkStartRead {
  challenge_id: string;
  provider: string;
  provider_label: string;
  provider_account_id: string;
  username: string | null;
  display_name: string | null;
  profile_url: string | null;
  description: string;
  default_scopes: string[];
  expires_at: string;
}

export interface ExternalConnectionLinkComplete {
  challenge_id: string;
  provider_account_id?: string | null;
  username?: string | null;
  display_name?: string | null;
  profile_url?: string | null;
}

export interface OAuthApplicationRead {
  id: string;
  name: string;
  description: string | null;
  redirect_uri: string;
  client_id: string;
  client_secret: string | null;
  scopes: string[];
  bot_user_id?: string | null;
  bot_username?: string | null;
  has_bot?: boolean;
  created_at: string;
}

export interface OAuthApplicationCreate {
  name: string;
  description?: string | null;
  redirect_uri: string;
  scopes: string[];
}

export interface OAuthApplicationUpdate {
  name?: string;
  description?: string | null;
  redirect_uri?: string;
  scopes?: string[];
}

export interface OAuthAuthorizedAppRead {
  id: string;
  application_id: string;
  application_name: string;
  description: string | null;
  redirect_uri: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

export interface OAuthAuthorizePreviewRead {
  application_id: string;
  client_id: string;
  application_name: string;
  description: string | null;
  redirect_uri: string;
  requested_scopes: string[];
  state: string | null;
  already_authorized: boolean;
}

export interface OAuthAuthorizationResult {
  redirect_uri: string;
  code: string;
  state: string | null;
}

export interface OAuthBotProvisionRead {
  bot_user_id: string;
  bot_username: string;
  token: string;
}

export interface ReportRead {
  id: string;
  reporter_user_id: string;
  reporter_username: string | null;
  target_type: "message" | "user" | "server";
  target_user_id: string | null;
  target_message_id: string | null;
  target_server_id: string | null;
  target_username: string | null;
  server_name: string | null;
  message_excerpt: string | null;
  reason: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  resolution_notes: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_username: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AttachmentRead {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  url: string;
  created_at: string;
}

// ── Request Helper ──

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Bergamot-Client": getClientHeaderValue(),
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getBaseUrl()}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ──

export async function login(username: string, password: string, otpCode?: string): Promise<Token> {
  const body = new URLSearchParams({ username, password });
  if (otpCode) body.set("otp_code", otpCode);
  const res = await fetch(`${getBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Bergamot-Client": getClientHeaderValue(),
    },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const wrapped = new Error(err.detail || `HTTP ${res.status}`) as Error & {
      code?: string;
      mfaRequired?: boolean;
      pendingEmail?: string;
    };
    wrapped.code = err.error_code;
    wrapped.mfaRequired = err.error_code === "mfa_required";
    wrapped.pendingEmail = err.email;
    throw wrapped;
  }
  const token: Token = await res.json();
  setToken(token.access_token);
  return token;
}

export async function register(payload: any): Promise<UserRead> {
  return request("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export async function getMe(): Promise<UserRead> {
  return request("/auth/me");
}

export async function forgotPassword(email: string): Promise<{ ok: boolean; reset_token?: string }> {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: boolean }> {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
  return request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function verifyEmail(token: string): Promise<{ ok: boolean }> {
  return request("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(): Promise<{ ok: boolean; already_verified?: boolean }> {
  return request("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function resendVerificationByEmail(email: string): Promise<{ ok: boolean }> {
  return request("/auth/resend-verification-email", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function getPendingAccountStatus(): Promise<PendingAccountStatusRead> {
  return request("/auth/pending-account/status");
}

export async function authorizeIp(token: string): Promise<{ ok: boolean; ip_address: string | null }> {
  return request("/auth/authorize-ip", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function finishSsoCallback(
  provider: string,
  code: string,
  state?: string | null,
): Promise<Token> {
  const token = await request<Token>("/auth/sso/callback", {
    method: "POST",
    body: JSON.stringify({ provider, code, state: state || null }),
  });
  setToken(token.access_token);
  return token;
}

export async function getAuthEntryPreview(
  kind: "invite" | "gift" | "theme",
  options: { token?: string | null; theme?: string | null } = {},
): Promise<AuthEntryPreviewRead> {
  const params = new URLSearchParams();
  if (options.token) params.set("token", options.token);
  if (options.theme) params.set("theme", options.theme);
  const query = params.toString();
  return request(`/auth/entry/${kind}${query ? `?${query}` : ""}`);
}

// ── Friends ──

export async function listFriends(): Promise<FriendshipRead[]> {
  return request("/friends/");
}

export async function sendFriendRequest(username: string): Promise<FriendshipRead> {
  return request("/friends/request", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function acceptFriendRequest(userId: string): Promise<FriendshipRead> {
  return request(`/friends/${userId}/accept`, { method: "PUT" });
}

export async function removeFriend(userId: string): Promise<void> {
  return request(`/friends/${userId}`, { method: "DELETE" });
}

export async function updateFriendNickname(userId: string, nickname: string | null): Promise<FriendshipRead> {
  return request(`/friends/${userId}/nickname`, {
    method: "PATCH",
    body: JSON.stringify({ nickname }),
  });
}

export async function blockUser(userId: string): Promise<FriendshipRead> {
  return request(`/friends/${userId}/block`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
}

export async function blockUserByUsername(username: string): Promise<FriendshipRead> {
  return request("/friends/block", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export async function getMutualServers(userId: string): Promise<MutualServerRead[]> {
  return request(`/friends/${userId}/mutual-servers`);
}

// ── User Notes ──

export interface UserNoteRead {
  target_id: string;
  content: string;
  updated_at: string | null;
}

export async function getUserNote(userId: string): Promise<UserNoteRead> {
  return request(`/notes/${userId}`);
}

export async function setUserNote(userId: string, content: string): Promise<UserNoteRead> {
  return request(`/notes/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function listConnections(): Promise<ExternalConnectionRead[]> {
  return request("/connections/");
}

export async function listConnectionProviders(): Promise<ExternalConnectionProviderRead[]> {
  return request("/connections/providers");
}

export async function linkConnection(provider: string, payload: ExternalConnectionCreate): Promise<ExternalConnectionRead> {
  return request(`/connections/${encodeURIComponent(provider)}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function beginConnectionLink(
  provider: string,
  payload: { account_hint?: string | null; display_name?: string | null } = {},
): Promise<ExternalConnectionLinkStartRead> {
  return request(`/connections/${encodeURIComponent(provider)}/start`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function completeConnectionLink(
  provider: string,
  payload: ExternalConnectionLinkComplete,
): Promise<ExternalConnectionRead> {
  return request(`/connections/${encodeURIComponent(provider)}/complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removeConnection(connectionId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-Bergamot-Client": getClientHeaderValue(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}/connections/${connectionId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Connection remove failed: HTTP ${res.status}`);
  }
}

export async function listOAuthApplications(): Promise<OAuthApplicationRead[]> {
  return request("/oauth2/apps");
}

export async function createOAuthApplication(payload: OAuthApplicationCreate): Promise<OAuthApplicationRead> {
  return request("/oauth2/apps", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateOAuthApplication(applicationId: string, payload: OAuthApplicationUpdate): Promise<OAuthApplicationRead> {
  return request(`/oauth2/apps/${applicationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function rotateOAuthApplicationSecret(applicationId: string): Promise<{ client_secret: string }> {
  return request(`/oauth2/apps/${applicationId}/rotate-secret`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function provisionOAuthBot(applicationId: string): Promise<OAuthBotProvisionRead> {
  return request(`/oauth2/apps/${applicationId}/bot`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function deleteOAuthApplication(applicationId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-Bergamot-Client": getClientHeaderValue(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}/oauth2/apps/${applicationId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Application delete failed: HTTP ${res.status}`);
  }
}

export async function listAuthorizedApps(): Promise<OAuthAuthorizedAppRead[]> {
  return request("/oauth2/authorized-apps");
}

export async function revokeAuthorizedApp(grantId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-Bergamot-Client": getClientHeaderValue(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}/oauth2/authorized-apps/${grantId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Authorized app revoke failed: HTTP ${res.status}`);
  }
}

export async function previewOAuthAuthorization(
  clientId: string,
  redirectUri: string,
  scopes: string[],
  state?: string | null,
): Promise<OAuthAuthorizePreviewRead> {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
  });
  if (scopes.length > 0) params.set("scope", scopes.join(" "));
  if (state) params.set("state", state);
  return request(`/oauth2/authorize?${params.toString()}`);
}

export async function approveOAuthAuthorization(payload: {
  client_id: string;
  redirect_uri: string;
  scopes: string[];
  state?: string | null;
  approve: boolean;
}): Promise<OAuthAuthorizationResult> {
  return request("/oauth2/authorize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Profile ──

export async function updateProfile(data: UserUpdate): Promise<UserRead> {
  return request("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function listSessions(): Promise<AuthSessionRead[]> {
  return request("/sessions/");
}

export async function revokeSession(sessionId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-Bergamot-Client": getClientHeaderValue(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/sessions/${sessionId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Session revoke failed: HTTP ${res.status}`);
  }
}

export async function revokeOtherSessions(): Promise<RevokeOtherSessionsRead> {
  return request("/sessions/revoke-others", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getMfaStatus(): Promise<MfaStatusRead> {
  return request("/mfa/totp/status");
}

export async function beginTotpSetup(): Promise<TotpSetupRead> {
  return request("/mfa/totp/setup", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function enableTotp(code: string): Promise<MfaStatusRead> {
  return request("/mfa/totp/enable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function disableTotp(code: string): Promise<MfaStatusRead> {
  return request("/mfa/totp/disable", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function listPasskeys(): Promise<PasskeyRead[]> {
  return request("/passkeys/");
}

export async function beginPasskeyRegistration(label?: string): Promise<PasskeyChallengeRead> {
  return request("/passkeys/registration/options", {
    method: "POST",
    body: JSON.stringify({ label: label || null }),
  });
}

export async function finishPasskeyRegistration(
  challengeId: string,
  credential: Record<string, any>,
): Promise<PasskeyRead> {
  return request("/passkeys/registration/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, credential }),
  });
}

export async function deletePasskey(passkeyId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "X-Bergamot-Client": getClientHeaderValue(),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}/passkeys/${passkeyId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Passkey delete failed: HTTP ${res.status}`);
  }
}

export async function beginPasskeyAuthentication(username?: string): Promise<PasskeyChallengeRead> {
  return request("/passkeys/authentication/options", {
    method: "POST",
    body: JSON.stringify({ username: username || null }),
  });
}

export async function finishPasskeyAuthentication(
  challengeId: string,
  credential: Record<string, any>,
): Promise<Token> {
  const token = await request<Token>("/passkeys/authentication/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, credential }),
  });
  setToken(token.access_token);
  return token;
}

export function listSavedAccounts(): StoredAccount[] {
  return listStoredAccounts();
}

export function rememberAuthenticatedAccount(user: UserRead) {
  const token = getToken();
  if (!token) return null;
  return rememberStoredAccount(
    {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    },
    getConfiguredServerUrl(),
    token,
  );
}

export function switchToSavedAccount(accountKey: string) {
  const account = activateStoredAccount(accountKey);
  if (!account) {
    throw new Error("Saved account not found");
  }
  accessToken = account.token;
}

export function removeSavedAccount(accountKey: string): StoredAccount[] {
  return removeStoredAccount(accountKey);
}

export function forgetCurrentAccount() {
  removeActiveStoredAccount();
  accessToken = null;
}

// ── Servers & Channels ──

export async function listServers(): Promise<ServerRead[]> {
  return request("/servers/");
}

export async function createServer(name: string): Promise<ServerRead> {
  return request("/servers/", { method: "POST", body: JSON.stringify({ name }) });
}

export async function listServerInvites(serverId: string): Promise<ServerInviteRead[]> {
  return request(`/servers/${serverId}/invites`);
}

export async function createServerInvite(serverId: string, payload: {
  label?: string | null;
  notes?: string | null;
  max_uses?: number | null;
  expires_in_hours?: number | null;
}): Promise<ServerInviteRead> {
  return request(`/servers/${serverId}/invites`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function revokeServerInvite(serverId: string, inviteId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}/servers/${serverId}/invites/${inviteId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Invite revoke failed: HTTP ${res.status}`);
  }
}

export async function previewServerInvite(code: string): Promise<ServerInvitePreviewRead> {
  return request(`/invites/${encodeURIComponent(code)}`);
}

export async function acceptServerInvite(code: string): Promise<ServerInviteAcceptRead> {
  return request(`/invites/${encodeURIComponent(code)}/accept`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listCreatedGifts(): Promise<GiftCodeRead[]> {
  return request("/gifts/created");
}

export async function listClaimedGifts(): Promise<GiftCodeRead[]> {
  return request("/gifts/claimed");
}

export async function createGift(payload: {
  title: string;
  description?: string | null;
  claim_message?: string | null;
  theme?: string | null;
  expires_in_hours?: number | null;
}): Promise<GiftCodeRead> {
  return request("/gifts/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function previewGift(code: string): Promise<GiftCodePreviewRead> {
  return request(`/gifts/${encodeURIComponent(code)}`);
}

export async function claimGift(code: string): Promise<GiftClaimRead> {
  return request(`/gifts/${encodeURIComponent(code)}/claim`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function listChannels(serverId: string): Promise<ChannelRead[]> {
  return request(`/servers/${serverId}/channels/`);
}

export async function createChannel(
  serverId: string,
  name: string,
  channelType: "text" | "voice" = "text",
  topic?: string
): Promise<ChannelRead> {
  return request(`/servers/${serverId}/channels/`, {
    method: "POST",
    body: JSON.stringify({ name, channel_type: channelType, topic: topic || null }),
  });
}

// ── Messages ──

export interface MessageReferenceRead {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ReactionCount {
  emoji: string;
  count: number;
  me: boolean;
}

export interface MessageRead {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  nonce: string | null;
  attachments: Array<{ id: string; filename: string; content_type: string; url: string }> | null;
  created_at: string;
  // Reply
  reply_to_id: string | null;
  reply_to: MessageReferenceRead | null;
  // Edit
  edited_at: string | null;
  // Pin
  pinned: boolean;
  pinned_at: string | null;
  pinned_by: string | null;
  // Reactions
  reaction_counts: ReactionCount[];
}

export interface StreamContextRead {
  stream_kind: "channel" | "dm";
  stream_id: string;
  server_id: string | null;
  server_name: string | null;
  channel_name: string | null;
  peer_display_name: string | null;
}

export interface ActorRead {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface NotificationRead {
  id: string;
  notification_type: "mention" | "reply" | "dm_unread_summary";
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
  actor: ActorRead | null;
  message_id: string | null;
  message: MessageRead | null;
  stream: StreamContextRead;
  unread_count: number | null;
}

export interface NotificationSummaryRead {
  total_unread: number;
  unread_notifications: number;
  unread_mentions: number;
  unread_replies: number;
  unread_dm_conversations: number;
  unread_dm_messages: number;
}

export interface MentionRead {
  id: string;
  created_at: string;
  read_at: string | null;
  actor: ActorRead | null;
  message_id: string;
  message: MessageRead;
  stream: StreamContextRead;
}

export interface SavedItemRead {
  id: string;
  kind: "channel" | "dm" | "message";
  target_id: string;
  label: string;
  subtitle: string;
  route_hash: string;
  icon: string;
  created_at: string;
}

export interface MessageSearchResultRead {
  id: string;
  cursor: string;
  snippet: string;
  message: MessageRead;
  stream: StreamContextRead;
}

export interface SearchResultsPageRead {
  items: MessageSearchResultRead[];
  next_cursor: string | null;
}

function resolveRelativeAttachmentUrls(messages: Array<{ attachments: MessageRead["attachments"] }>) {
  for (const msg of messages) {
    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (att.url && att.url.startsWith("/")) {
          att.url = `${getRootUrl()}${att.url}`;
        }
      }
    }
  }
}

export async function listMessages(channelId: string, limit = 50): Promise<MessageRead[]> {
  const messages = await request<MessageRead[]>(`/channels/${channelId}/messages/?limit=${limit}`);
  resolveRelativeAttachmentUrls(messages);
  return messages;
}

export async function createMessage(
  channelId: string,
  content: string,
  nonce?: string,
  attachments?: Array<{ id: string; filename: string; content_type: string; url: string }>
): Promise<MessageRead> {
  return request(`/channels/${channelId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ content, nonce, attachments: attachments || null }),
  });
}

export async function createMessageWithReply(
  channelId: string,
  content: string,
  replyToId: string,
  nonce?: string,
  attachments?: Array<{ id: string; filename: string; content_type: string; url: string }>
): Promise<MessageRead> {
  return request(`/channels/${channelId}/messages/`, {
    method: "POST",
    body: JSON.stringify({ content, nonce, attachments: attachments || null, reply_to_id: replyToId }),
  });
}

export async function editMessage(channelId: string, messageId: string, content: string): Promise<MessageRead> {
  return request(`/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  });
}

export async function deleteMessage(channelId: string, messageId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/channels/${channelId}/messages/${messageId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed: HTTP ${res.status}`);
  }
}

// ── Reactions ──

export async function addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `${getBaseUrl()}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "PUT", headers }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Reaction failed: HTTP ${res.status}`);
  }
}

export async function removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(
    `${getBaseUrl()}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    { method: "DELETE", headers }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Remove reaction failed: HTTP ${res.status}`);
  }
}

// ── Pins ──

export async function pinMessage(channelId: string, messageId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/channels/${channelId}/messages/${messageId}/pin`, {
    method: "PUT",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Pin failed: HTTP ${res.status}`);
  }
}

export async function unpinMessage(channelId: string, messageId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/channels/${channelId}/messages/${messageId}/pin`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Unpin failed: HTTP ${res.status}`);
  }
}

export async function listPinnedMessages(channelId: string): Promise<MessageRead[]> {
  return request(`/channels/${channelId}/messages/pins`);
}

// ── Roles & Permissions ──

export const Permissions = {
  ADMINISTRATOR: 0x1,
  MANAGE_CHANNELS: 0x2,
  MANAGE_ROLES: 0x4,
  MANAGE_MESSAGES: 0x8,
  MANAGE_SERVER: 0x10,
  KICK_MEMBERS: 0x20,
  SEND_MESSAGES: 0x40,
  VIEW_CHANNELS: 0x80,
} as const;

export function hasPermission(userPerms: number, perm: number): boolean {
  if (userPerms & Permissions.ADMINISTRATOR) return true;
  return (userPerms & perm) === perm;
}

export interface RoleRead {
  id: string;
  name: string;
  color: string | null;
  permissions: number;
  position: number;
  is_default: boolean;
  server_id: string;
  created_at: string;
}

export interface MemberWithRoles {
  id: string;
  user_id: string;
  server_id: string;
  nickname: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: "online" | "idle" | "dnd" | "offline";
  status_message: string | null;
  role_ids: string[];
}

export async function listRoles(serverId: string): Promise<RoleRead[]> {
  return request(`/servers/${serverId}/roles/`);
}

export async function createRole(
  serverId: string,
  data: { name: string; color?: string; permissions?: number }
): Promise<RoleRead> {
  return request(`/servers/${serverId}/roles/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRole(
  serverId: string,
  roleId: string,
  data: { name?: string; color?: string; permissions?: number; position?: number }
): Promise<RoleRead> {
  return request(`/servers/${serverId}/roles/${roleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteRole(serverId: string, roleId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/servers/${serverId}/roles/${roleId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed: HTTP ${res.status}`);
  }
}

export async function assignRole(serverId: string, roleId: string, memberId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/servers/${serverId}/roles/${roleId}/members/${memberId}`, {
    method: "PUT",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Assign failed: HTTP ${res.status}`);
  }
}

export async function removeRole(serverId: string, roleId: string, memberId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/servers/${serverId}/roles/${roleId}/members/${memberId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Remove failed: HTTP ${res.status}`);
  }
}

export async function listMembers(serverId: string): Promise<MemberWithRoles[]> {
  return request(`/servers/${serverId}/members`);
}

export async function getMyPermissions(serverId: string): Promise<number> {
  const data = await request<{ permissions: number }>(`/servers/${serverId}/my-permissions`);
  return data.permissions;
}

// ── Server Bans ──

export interface ServerBanRead {
  id: string;
  server_id: string;
  user_id: string;
  banned_by_id: string | null;
  reason: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  banned_by_name: string | null;
  created_at: string;
}

export async function listServerBans(serverId: string): Promise<ServerBanRead[]> {
  return request(`/servers/${serverId}/bans`);
}

export async function banServerMember(serverId: string, userId: string, reason?: string): Promise<ServerBanRead> {
  return request(`/servers/${serverId}/bans`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, reason: reason || null }),
  });
}

export async function unbanServerMember(serverId: string, banId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${getBaseUrl()}/servers/${serverId}/bans/${banId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Failed to unban");
}

// ── Server Audit Log ──

export interface AuditLogEntryRead {
  id: string;
  action_type: number;
  action_label: string;
  user_id: string | null;
  user_name: string | null;
  target_id: string | null;
  reason: string | null;
  extra: string | null;
  created_at: string;
}

export async function listAuditLog(serverId: string, actionType?: number): Promise<AuditLogEntryRead[]> {
  const params = new URLSearchParams();
  if (actionType !== undefined) params.set("action_type", String(actionType));
  const qs = params.toString();
  return request(`/servers/${serverId}/audit-log${qs ? `?${qs}` : ""}`);
}

export async function deleteChannel(serverId: string, channelId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/servers/${serverId}/channels/${channelId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed: HTTP ${res.status}`);
  }
}

// ── Direct Messages ──

export interface DMConversationRead {
  id: string;
  user_a_id: string;
  user_b_id: string;
  peer_id: string;
  peer_username: string;
  peer_display_name: string | null;
  peer_avatar_url: string | null;
  peer_status: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
}

export async function listDMConversations(): Promise<DMConversationRead[]> {
  return request("/dm/conversations");
}

export async function createDMConversation(userId: string): Promise<DMConversationRead> {
  return request("/dm/conversations", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function listDMMessages(conversationId: string, limit = 50): Promise<MessageRead[]> {
  const messages = await request<MessageRead[]>(
    `/dm/conversations/${conversationId}/messages?limit=${limit}`
  );
  resolveRelativeAttachmentUrls(messages);
  return messages;
}

export async function createDMMessage(
  conversationId: string,
  content: string,
  nonce?: string,
  attachments?: Array<{ id: string; filename: string; content_type: string; url: string }>,
  replyToId?: string,
): Promise<MessageRead> {
  return request(`/dm/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content,
      nonce,
      attachments: attachments || null,
      reply_to_id: replyToId || null,
    }),
  });
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  return request(`/dm/users/search?q=${encodeURIComponent(query)}`);
}

export type ReadStateTarget = "channel" | "dm";

export interface ReadStateRead {
  id: string;
  user_id: string;
  target_kind: ReadStateTarget;
  target_id: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
  unread_count: number;
  updated_at: string;
}

export async function markReadState(
  targetKind: ReadStateTarget,
  targetId: string,
  lastReadMessageId?: string,
): Promise<ReadStateRead> {
  return request(`/read-states/${targetKind}/${targetId}`, {
    method: "PUT",
    body: JSON.stringify({
      last_read_message_id: lastReadMessageId || null,
    }),
  });
}

// ── Inbox, Mentions, Saved Items, and Search ──

export async function listNotifications(): Promise<NotificationRead[]> {
  const notifications = await request<NotificationRead[]>("/notifications");
  for (const item of notifications) {
    if (item.message) resolveRelativeAttachmentUrls([item.message]);
  }
  return notifications;
}

export async function getNotificationSummary(): Promise<NotificationSummaryRead> {
  return request("/notifications/summary");
}

export async function markNotificationRead(notificationId: string): Promise<NotificationRead> {
  const notification = await request<NotificationRead>(`/notifications/${notificationId}/read`, {
    method: "PUT",
  });
  if (notification.message) resolveRelativeAttachmentUrls([notification.message]);
  return notification;
}

export async function markAllNotificationsRead(): Promise<NotificationSummaryRead> {
  return request("/notifications/read-all", {
    method: "POST",
  });
}

export async function listMentions(): Promise<MentionRead[]> {
  const mentions = await request<MentionRead[]>("/mentions");
  for (const item of mentions) {
    resolveRelativeAttachmentUrls([item.message]);
  }
  return mentions;
}

export async function listSavedItems(): Promise<SavedItemRead[]> {
  return request("/saved");
}

export async function saveItem(kind: "channel" | "dm" | "message", targetId: string): Promise<SavedItemRead> {
  return request(`/saved/${kind}/${targetId}`, {
    method: "PUT",
  });
}

export async function unsaveItem(kind: "channel" | "dm" | "message", targetId: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getBaseUrl()}/saved/${kind}/${targetId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Delete failed: HTTP ${res.status}`);
  }
}

export interface SearchFilters {
  authorId?: string;
  hasAttachment?: boolean;
  before?: string;
  after?: string;
}

export async function searchMessages(
  query: string,
  scope: "channel" | "server" | "dm" | "global",
  targetId?: string | null,
  cursor?: string | null,
  filters?: SearchFilters,
): Promise<SearchResultsPageRead> {
  const params = new URLSearchParams({
    q: query,
    scope,
  });
  if (targetId) params.set("target_id", targetId);
  if (cursor) params.set("cursor", cursor);
  if (filters?.authorId) params.set("author_id", filters.authorId);
  if (filters?.hasAttachment !== undefined) params.set("has_attachment", String(filters.hasAttachment));
  if (filters?.before) params.set("before", filters.before);
  if (filters?.after) params.set("after", filters.after);
  const page = await request<SearchResultsPageRead>(`/search/messages?${params.toString()}`);
  for (const item of page.items) {
    resolveRelativeAttachmentUrls([item.message]);
  }
  return page;
}

export async function createReport(payload: {
  reason: string;
  message_id?: string;
  user_id?: string;
  server_id?: string;
}): Promise<ReportRead> {
  return request("/reports/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── File Uploads ──

export async function uploadFile(file: File): Promise<AttachmentRead> {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${getBaseUrl()}/uploads/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Upload failed: HTTP ${res.status}`);
  }

  const data: AttachmentRead = await res.json();
  // Convert relative URL to absolute URL
  if (data.url.startsWith("/")) {
    data.url = `${getRootUrl()}${data.url}`;
  }
  return data;
}
