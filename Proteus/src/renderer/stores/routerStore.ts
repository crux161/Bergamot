import { createStore, type ReadableStore } from "./createStore";

export type AppRoute =
  | { kind: "dmHome" }
  | { kind: "dmConversation"; conversationId: string; messageId?: string }
  | { kind: "notifications" }
  | { kind: "favorites" }
  | { kind: "bookmarks" }
  | { kind: "mentions" }
  | { kind: "you" }
  | { kind: "forgotPassword" }
  | { kind: "resetPassword"; token: string }
  | { kind: "verifyEmail"; token: string }
  | { kind: "pendingAccount"; email?: string | null }
  | { kind: "authorizeIp"; token: string }
  | { kind: "inviteAuth"; token: string | null }
  | { kind: "giftAuth"; token: string | null }
  | { kind: "themeEntry"; theme: string | null }
  | { kind: "ssoCallback"; provider: string; code: string; state?: string | null }
  | { kind: "oauthAuthorize"; clientId: string; redirectUri: string; scope: string[]; state?: string | null }
  | { kind: "guildHome"; guildId: string }
  | { kind: "channel"; guildId: string; channelId: string; messageId?: string };

export function isAuthRoute(route: AppRoute): boolean {
  return (
    route.kind === "forgotPassword"
    || route.kind === "resetPassword"
    || route.kind === "verifyEmail"
    || route.kind === "pendingAccount"
    || route.kind === "authorizeIp"
    || route.kind === "inviteAuth"
    || route.kind === "giftAuth"
    || route.kind === "themeEntry"
    || route.kind === "ssoCallback"
    || route.kind === "oauthAuthorize"
  );
}

const DEFAULT_ROUTE: AppRoute = { kind: "dmHome" };
const POST_AUTH_ROUTE_KEY = "bergamot_post_auth_route";

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseRoute(hash: string): AppRoute {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = normalized || "/channels/@me";
  const pathname = path.split("?")[0];
  const parts = pathname.split("/").filter(Boolean).map(safeDecode);

  if (parts[0] === "notifications") return { kind: "notifications" };
  if (parts[0] === "favorites") return { kind: "favorites" };
  if (parts[0] === "bookmarks") return { kind: "bookmarks" };
  if (parts[0] === "mentions") return { kind: "mentions" };
  if (parts[0] === "you") return { kind: "you" };
  if (parts[0] === "forgot") return { kind: "forgotPassword" };
  if (parts[0] === "reset") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "resetPassword", token: hashParams.get("token") || "" };
  }
  if (parts[0] === "verify") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "verifyEmail", token: hashParams.get("token") || "" };
  }
  if (parts[0] === "pending-account") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "pendingAccount", email: hashParams.get("email") };
  }
  if (parts[0] === "authorize-ip") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "authorizeIp", token: hashParams.get("token") || "" };
  }
  if (parts[0] === "invite") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "inviteAuth", token: hashParams.get("token") };
  }
  if (parts[0] === "gift") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "giftAuth", token: hashParams.get("token") };
  }
  if (parts[0] === "theme-entry") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return { kind: "themeEntry", theme: hashParams.get("theme") };
  }
  if (parts[0] === "sso" && parts[1] === "callback") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return {
      kind: "ssoCallback",
      provider: hashParams.get("provider") || "",
      code: hashParams.get("code") || "",
      state: hashParams.get("state"),
    };
  }
  if (parts[0] === "oauth" && parts[1] === "authorize") {
    const hashParams = new URLSearchParams(path.split("?")[1] || "");
    return {
      kind: "oauthAuthorize",
      clientId: hashParams.get("client_id") || "",
      redirectUri: hashParams.get("redirect_uri") || "",
      scope: (hashParams.get("scope") || "").split(/\s+/).filter(Boolean),
      state: hashParams.get("state"),
    };
  }

  if (parts[0] === "channels" && parts[1] === "@me") {
    if (parts[2] && parts[3]) {
      return { kind: "dmConversation", conversationId: parts[2], messageId: parts[3] };
    }
    if (parts[2]) {
      return { kind: "dmConversation", conversationId: parts[2] };
    }
    return { kind: "dmHome" };
  }

  if (parts[0] === "channels" && parts[1] && parts[2]) {
    if (parts[3]) {
      return { kind: "channel", guildId: parts[1], channelId: parts[2], messageId: parts[3] };
    }
    return { kind: "channel", guildId: parts[1], channelId: parts[2] };
  }

  if (parts[0] === "channels" && parts[1]) {
    return { kind: "guildHome", guildId: parts[1] };
  }

  return DEFAULT_ROUTE;
}

export function serializeRoute(route: AppRoute): string {
  switch (route.kind) {
    case "dmHome":
      return "#/channels/@me";
    case "dmConversation": {
      const base = `#/channels/@me/${encodeURIComponent(route.conversationId)}`;
      return route.messageId ? `${base}/${encodeURIComponent(route.messageId)}` : base;
    }
    case "notifications":
      return "#/notifications";
    case "favorites":
      return "#/favorites";
    case "bookmarks":
      return "#/bookmarks";
    case "mentions":
      return "#/mentions";
    case "you":
      return "#/you";
    case "forgotPassword":
      return "#/forgot";
    case "resetPassword":
      return `#/reset?token=${encodeURIComponent(route.token)}`;
    case "verifyEmail":
      return `#/verify?token=${encodeURIComponent(route.token)}`;
    case "pendingAccount":
      return route.email ? `#/pending-account?email=${encodeURIComponent(route.email)}` : "#/pending-account";
    case "authorizeIp":
      return `#/authorize-ip?token=${encodeURIComponent(route.token)}`;
    case "inviteAuth":
      return route.token ? `#/invite?token=${encodeURIComponent(route.token)}` : "#/invite";
    case "giftAuth":
      return route.token ? `#/gift?token=${encodeURIComponent(route.token)}` : "#/gift";
    case "themeEntry":
      return route.theme ? `#/theme-entry?theme=${encodeURIComponent(route.theme)}` : "#/theme-entry";
    case "ssoCallback": {
      const params = new URLSearchParams({
        provider: route.provider,
        code: route.code,
      });
      if (route.state) params.set("state", route.state);
      return `#/sso/callback?${params.toString()}`;
    }
    case "oauthAuthorize": {
      const params = new URLSearchParams({
        client_id: route.clientId,
        redirect_uri: route.redirectUri,
      });
      if (route.scope.length > 0) params.set("scope", route.scope.join(" "));
      if (route.state) params.set("state", route.state);
      return `#/oauth/authorize?${params.toString()}`;
    }
    case "guildHome":
      return `#/channels/${encodeURIComponent(route.guildId)}`;
    case "channel": {
      const base = `#/channels/${encodeURIComponent(route.guildId)}/${encodeURIComponent(route.channelId)}`;
      return route.messageId ? `${base}/${encodeURIComponent(route.messageId)}` : base;
    }
  }
}

type RouteStoreSnapshot = {
  route: AppRoute;
};

const internalStore = createStore<RouteStoreSnapshot>({
  route: typeof window === "undefined" ? DEFAULT_ROUTE : parseRoute(window.location.hash),
});

function syncHash(route: AppRoute, mode: "push" | "replace" = "push") {
  if (typeof window === "undefined") return;
  const nextHash = serializeRoute(route);
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
  if (nextHash === window.location.hash) return;
  if (mode === "replace") {
    window.history.replaceState(null, "", nextUrl);
  } else {
    window.history.pushState(null, "", nextUrl);
  }
  internalStore.setState((prev) => ({ ...prev, route }));
}

function readStoredPostAuthRoute(): AppRoute | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(POST_AUTH_ROUTE_KEY);
  if (!stored) return null;
  try {
    return parseRoute(stored);
  } catch {
    return null;
  }
}

function writeStoredPostAuthRoute(route: AppRoute | null) {
  if (typeof window === "undefined") return;
  if (route == null) {
    window.localStorage.removeItem(POST_AUTH_ROUTE_KEY);
    return;
  }
  window.localStorage.setItem(POST_AUTH_ROUTE_KEY, serializeRoute(route));
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    internalStore.setState((prev) => ({
      ...prev,
      route: parseRoute(window.location.hash),
    }));
  });
}

export const routerStore: ReadableStore<RouteStoreSnapshot> & {
  openDmHome: () => void;
  openDm: (conversationId: string, messageId?: string) => void;
  openNotifications: () => void;
  openFavorites: () => void;
  openBookmarks: () => void;
  openMentions: () => void;
  openYou: () => void;
  openForgotPassword: () => void;
  openResetPassword: (token: string) => void;
  openVerifyEmail: (token: string) => void;
  openPendingAccount: (email?: string | null) => void;
  openAuthorizeIp: (token: string) => void;
  openInviteAuth: (token?: string | null) => void;
  openGiftAuth: (token?: string | null) => void;
  openThemeEntry: (theme?: string | null) => void;
  openSsoCallback: (provider: string, code: string, state?: string | null) => void;
  openOAuthAuthorize: (clientId: string, redirectUri: string, scope?: string[], state?: string | null) => void;
  openLogin: () => void;
  beginLoginFlow: (resumeRoute?: AppRoute) => void;
  resumePostAuthRoute: () => AppRoute | null;
  clearPostAuthRoute: () => void;
  openGuild: (guildId: string) => void;
  openChannel: (guildId: string, channelId: string, mode?: "push" | "replace") => void;
  openChannelMessage: (guildId: string, channelId: string, messageId: string) => void;
  openDmMessage: (conversationId: string, messageId: string) => void;
  isRouteActive: (candidate: AppRoute) => boolean;
} = {
  getSnapshot: internalStore.getSnapshot,
  subscribe: internalStore.subscribe,
  openDmHome: () => syncHash({ kind: "dmHome" }),
  openDm: (conversationId: string, messageId?: string) =>
    syncHash({ kind: "dmConversation", conversationId, messageId }),
  openNotifications: () => syncHash({ kind: "notifications" }),
  openFavorites: () => syncHash({ kind: "favorites" }),
  openBookmarks: () => syncHash({ kind: "bookmarks" }),
  openMentions: () => syncHash({ kind: "mentions" }),
  openYou: () => syncHash({ kind: "you" }),
  openForgotPassword: () => syncHash({ kind: "forgotPassword" }),
  openResetPassword: (token: string) => syncHash({ kind: "resetPassword", token }),
  openVerifyEmail: (token: string) => syncHash({ kind: "verifyEmail", token }),
  openPendingAccount: (email?: string | null) => syncHash({ kind: "pendingAccount", email: email || null }),
  openAuthorizeIp: (token: string) => syncHash({ kind: "authorizeIp", token }),
  openInviteAuth: (token?: string | null) => syncHash({ kind: "inviteAuth", token: token || null }),
  openGiftAuth: (token?: string | null) => syncHash({ kind: "giftAuth", token: token || null }),
  openThemeEntry: (theme?: string | null) => syncHash({ kind: "themeEntry", theme: theme || null }),
  openSsoCallback: (provider: string, code: string, state?: string | null) =>
    syncHash({ kind: "ssoCallback", provider, code, state }),
  openOAuthAuthorize: (clientId: string, redirectUri: string, scope: string[] = [], state?: string | null) =>
    syncHash({ kind: "oauthAuthorize", clientId, redirectUri, scope, state }),
  openLogin: () => syncHash({ kind: "dmHome" }),
  beginLoginFlow: (resumeRoute?: AppRoute) => {
    writeStoredPostAuthRoute(resumeRoute ?? internalStore.getSnapshot().route);
    syncHash({ kind: "dmHome" });
  },
  resumePostAuthRoute: () => {
    const route = readStoredPostAuthRoute();
    writeStoredPostAuthRoute(null);
    if (route) {
      syncHash(route, "replace");
    }
    return route;
  },
  clearPostAuthRoute: () => writeStoredPostAuthRoute(null),
  openGuild: (guildId: string) => syncHash({ kind: "guildHome", guildId }),
  openChannel: (guildId: string, channelId: string, mode: "push" | "replace" = "push") =>
    syncHash({ kind: "channel", guildId, channelId }, mode),
  openChannelMessage: (guildId: string, channelId: string, messageId: string) =>
    syncHash({ kind: "channel", guildId, channelId, messageId }),
  openDmMessage: (conversationId: string, messageId: string) =>
    syncHash({ kind: "dmConversation", conversationId, messageId }),
  isRouteActive: (candidate: AppRoute) =>
    serializeRoute(candidate) === serializeRoute(internalStore.getSnapshot().route),
};
