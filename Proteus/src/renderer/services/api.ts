/**
 * REST API client for Janus (Core API & Identity Service).
 */

const BASE_URL =
  (window as any).__BERGAMOT_API_URL__ || "http://localhost:8000/api/v1";

let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
}

export function getToken(): string | null {
  return accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Auth ──

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface UserRead {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export async function register(payload: RegisterPayload): Promise<UserRead> {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(
  username: string,
  password: string
): Promise<Token> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const token: Token = await res.json();
  setToken(token.access_token);
  return token;
}

export async function getMe(): Promise<UserRead> {
  return request("/auth/me");
}

// ── Servers ──

export interface ServerRead {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: string;
}

export async function listServers(): Promise<ServerRead[]> {
  return request("/servers/");
}

export async function createServer(name: string): Promise<ServerRead> {
  return request("/servers/", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

// ── Channels ──

export interface ChannelRead {
  id: string;
  name: string;
  topic: string | null;
  channel_type: "text" | "voice";
  position: number;
  server_id: string;
  created_at: string;
}

export async function listChannels(
  serverId: string
): Promise<ChannelRead[]> {
  return request(`/servers/${serverId}/channels/`);
}

export async function createChannel(
  serverId: string,
  name: string,
  channelType: "text" | "voice" = "text"
): Promise<ChannelRead> {
  return request(`/servers/${serverId}/channels/`, {
    method: "POST",
    body: JSON.stringify({ name, channel_type: channelType }),
  });
}
