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
  return `${getServerUrl()}/api/v1`;
}

function getRootUrl(): string {
  return getServerUrl();
}

let accessToken: string | null = localStorage.getItem('bergamot_token');

export function setToken(token: string) {
  accessToken = token;
  localStorage.setItem('bergamot_token', token);
}

export function getToken(): string | null {
  return accessToken || localStorage.getItem('bergamot_token');
}

// ── Types ──

export interface UserRead {
  id: string;
  username: string;
  email: string;
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

export async function login(username: string, password: string): Promise<Token> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${getBaseUrl()}/auth/login`, {
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

export async function register(payload: any): Promise<UserRead> {
  return request("/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export async function getMe(): Promise<UserRead> {
  return request("/auth/me");
}

export async function updateProfile(data: UserUpdate): Promise<UserRead> {
  return request("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ── Servers & Channels ──

export async function listServers(): Promise<ServerRead[]> {
  return request("/servers/");
}

export async function createServer(name: string): Promise<ServerRead> {
  return request("/servers/", { method: "POST", body: JSON.stringify({ name }) });
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

export interface MessageRead {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  nonce: string | null;
  attachments: Array<{ id: string; filename: string; content_type: string; url: string }> | null;
  created_at: string;
}

export async function listMessages(channelId: string, limit = 50): Promise<MessageRead[]> {
  const messages = await request<MessageRead[]>(`/channels/${channelId}/messages/?limit=${limit}`);
  // Resolve relative attachment URLs to absolute
  for (const msg of messages) {
    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (att.url && att.url.startsWith("/")) {
          att.url = `${getRootUrl()}${att.url}`;
        }
      }
    }
  }
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
