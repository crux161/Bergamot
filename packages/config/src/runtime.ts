import type { BergamotServiceEndpoints } from "@bergamot/contracts";

const DEFAULT_API_PREFIX = "/api/v1";
const DEFAULT_HERMES_SOCKET_PATH = "/socket";

export function normalizeServerBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function buildRootUrl(serverUrl: string): string {
  return normalizeServerBaseUrl(serverUrl);
}

export function buildApiBaseUrl(serverUrl: string): string {
  return `${buildRootUrl(serverUrl)}${DEFAULT_API_PREFIX}`;
}

export function buildHermesSocketUrl(serverUrl: string, socketPath = DEFAULT_HERMES_SOCKET_PATH): string {
  const api = new URL(buildRootUrl(serverUrl));
  const protocol = api.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${api.hostname}:4000${socketPath}`;
}

export function buildUploadsBaseUrl(serverUrl: string): string {
  return `${buildRootUrl(serverUrl)}/uploads`;
}

export function buildDefaultServiceEndpoints(serverUrl: string): BergamotServiceEndpoints {
  return {
    httpBaseUrl: buildRootUrl(serverUrl),
    apiBaseUrl: buildApiBaseUrl(serverUrl),
    websocketBaseUrl: buildHermesSocketUrl(serverUrl),
    uploadsBaseUrl: buildUploadsBaseUrl(serverUrl),
    mediaBaseUrl: null,
    adminBaseUrl: null,
    livekitBaseUrl: null,
  };
}
