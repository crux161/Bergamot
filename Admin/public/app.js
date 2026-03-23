const API_ORIGIN_KEY = "bergamot_admin_api_origin";
const TOKEN_KEY = "bergamot_admin_token";
const defaultApiOrigin = localStorage.getItem(API_ORIGIN_KEY) || "http://localhost:8000";

let state = {
  apiOrigin: defaultApiOrigin.replace(/\/+$/, ""),
  token: localStorage.getItem(TOKEN_KEY),
  mfaRequired: false,
  lastOverview: null,
};

function getEl(id) {
  return document.getElementById(id);
}

function saveOrigin(origin) {
  state.apiOrigin = origin.replace(/\/+$/, "");
  localStorage.setItem(API_ORIGIN_KEY, state.apiOrigin);
}

function saveToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function setStatus(text, tone = "muted") {
  const el = getEl("auth-status");
  if (!el) return;
  el.textContent = text;
  el.dataset.tone = tone;
}

function renderItems(targetId, entries) {
  const container = getEl(targetId);
  if (!container) return;

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Nothing to show yet.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...entries.map(([label, value]) => {
      const row = document.createElement("div");
      row.className = "item";

      const name = document.createElement("strong");
      name.textContent = label;

      const text = document.createElement(typeof value === "boolean" ? "div" : "span");
      if (typeof value === "boolean") {
        text.className = "pill";
        text.textContent = value ? "Enabled" : "Disabled";
      } else {
        text.textContent = value ?? "n/a";
      }

      row.append(name, text);
      return row;
    }),
  );
}

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Bergamot-Client": "Bergamot Admin",
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(`${state.apiOrigin}${path}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.detail || `HTTP ${response.status}`);
    error.code = body.error_code;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function login(username, password, otpCode) {
  const body = new URLSearchParams({ username, password });
  if (otpCode) {
    body.set("otp_code", otpCode);
  }
  const response = await fetch(`${state.apiOrigin}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Bergamot-Client": "Bergamot Admin",
    },
    body,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.detail || `HTTP ${response.status}`);
    error.code = payload.error_code;
    throw error;
  }
  return response.json();
}

function renderOverview(overview) {
  state.lastOverview = overview;
  renderItems("overview-card", [
    ["Users", String(overview.total_users)],
    ["Servers", String(overview.total_servers)],
    ["Messages", String(overview.total_messages)],
    ["Open Reports", String(overview.open_reports)],
    ["Investigating", String(overview.investigating_reports)],
    ["Suspended Users", String(overview.suspended_users)],
  ]);
}

function renderReports(reports) {
  const container = getEl("reports-card");
  if (!container) return;

  if (!reports.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No reports match this filter.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...reports.map((report) => {
      const card = document.createElement("article");
      card.className = "record";

      const top = document.createElement("div");
      top.className = "record__top";

      const title = document.createElement("div");
      title.className = "record__title";
      const target = report.target_type === "message"
        ? `Message report${report.target_username ? ` for ${report.target_username}` : ""}`
        : report.target_type === "user"
          ? `User report for ${report.target_username || "unknown"}`
          : `Server report for ${report.server_name || "unknown server"}`;
      title.textContent = target;

      const badge = document.createElement("span");
      badge.className = `badge badge--${report.status}`;
      badge.textContent = report.status;
      top.append(title, badge);

      const meta = document.createElement("div");
      meta.className = "record__meta";
      meta.textContent = `Reporter: ${report.reporter_username || report.reporter_user_id} • ${new Date(report.created_at).toLocaleString()}`;

      const reason = document.createElement("div");
      reason.className = "record__body";
      reason.textContent = report.reason;

      const excerpt = document.createElement("div");
      excerpt.className = "record__subtle";
      excerpt.textContent = report.message_excerpt
        ? `Message: ${report.message_excerpt}`
        : report.server_name
          ? `Server: ${report.server_name}`
          : report.target_username
            ? `Target: ${report.target_username}`
            : "No additional context";

      const actions = document.createElement("div");
      actions.className = "record__actions";

      const investigate = document.createElement("button");
      investigate.className = "btn";
      investigate.textContent = "Investigate";
      investigate.disabled = report.status === "investigating";
      investigate.addEventListener("click", async () => {
        await updateReport(report.id, "investigating");
      });

      const resolve = document.createElement("button");
      resolve.className = "btn btn--primary";
      resolve.textContent = "Resolve";
      resolve.disabled = report.status === "resolved";
      resolve.addEventListener("click", async () => {
        const notes = window.prompt("Resolution notes (optional)") || "";
        await updateReport(report.id, "resolved", notes);
      });

      const dismiss = document.createElement("button");
      dismiss.className = "btn";
      dismiss.textContent = "Dismiss";
      dismiss.disabled = report.status === "dismissed";
      dismiss.addEventListener("click", async () => {
        const notes = window.prompt("Dismissal notes (optional)") || "";
        await updateReport(report.id, "dismissed", notes);
      });

      actions.append(investigate, resolve, dismiss);

      if (report.target_message_id) {
        const deleteButton = document.createElement("button");
        deleteButton.className = "btn btn--danger";
        deleteButton.textContent = "Delete Message";
        deleteButton.addEventListener("click", async () => {
          const confirmed = window.confirm("Delete this message from Bergamot?");
          if (!confirmed) return;
          await deleteMessage(report.target_message_id);
        });
        actions.append(deleteButton);
      }

      card.append(top, meta, reason, excerpt, actions);
      return card;
    }),
  );
}

function renderUsers(users) {
  const container = getEl("users-card");
  if (!container) return;

  if (!users.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No users found.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...users.map((user) => {
      const card = document.createElement("article");
      card.className = "record";

      const top = document.createElement("div");
      top.className = "record__top";
      const title = document.createElement("div");
      title.className = "record__title";
      title.textContent = user.display_name ? `${user.display_name} (@${user.username})` : `@${user.username}`;
      const badge = document.createElement("span");
      badge.className = `badge ${user.suspended_at ? "badge--dismissed" : "badge--open"}`;
      badge.textContent = user.suspended_at ? "suspended" : "active";
      top.append(title, badge);

      const meta = document.createElement("div");
      meta.className = "record__meta";
      meta.textContent = `${user.email} • Joined ${new Date(user.created_at).toLocaleDateString()}`;

      const subtle = document.createElement("div");
      subtle.className = "record__subtle";
      subtle.textContent = user.suspended_at
        ? `Suspended ${new Date(user.suspended_at).toLocaleString()} • ${user.suspension_reason || "No reason recorded"}`
        : "No active account suspension.";

      const actions = document.createElement("div");
      actions.className = "record__actions";
      const toggle = document.createElement("button");
      toggle.className = user.suspended_at ? "btn" : "btn btn--danger";
      toggle.textContent = user.suspended_at ? "Unsuspend" : "Suspend";
      toggle.addEventListener("click", async () => {
        if (user.suspended_at) {
          await unsuspendUser(user.id);
          return;
        }
        const reason = window.prompt("Why are you suspending this account?") || "";
        await suspendUser(user.id, reason);
      });
      actions.append(toggle);

      card.append(top, meta, subtle, actions);
      return card;
    }),
  );
}

function renderServers(servers) {
  const container = getEl("servers-card");
  if (!container) return;

  if (!servers.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No servers found.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...servers.map((server) => {
      const card = document.createElement("article");
      card.className = "record";

      const top = document.createElement("div");
      top.className = "record__top";
      const title = document.createElement("div");
      title.className = "record__title";
      title.textContent = server.name;
      const badge = document.createElement("span");
      badge.className = "badge badge--open";
      badge.textContent = `${server.member_count} members`;
      top.append(title, badge);

      const meta = document.createElement("div");
      meta.className = "record__meta";
      meta.textContent = `Owner: ${server.owner_username || server.owner_id} • Created ${new Date(server.created_at).toLocaleDateString()}`;

      card.append(top, meta);
      return card;
    }),
  );
}

function renderAuditLog(entries) {
  const container = getEl("audit-card");
  if (!container) return;

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No audit entries yet.";
    container.replaceChildren(empty);
    return;
  }

  const actionLabels = {
    report_resolved: "Resolved report",
    report_dismissed: "Dismissed report",
    report_investigating: "Began investigation",
    user_suspended: "Suspended user",
  };

  container.replaceChildren(
    ...entries.map((entry) => {
      const card = document.createElement("article");
      card.className = "record";

      const top = document.createElement("div");
      top.className = "record__top";
      const title = document.createElement("div");
      title.className = "record__title";
      title.textContent = actionLabels[entry.action] || entry.action;

      const badge = document.createElement("span");
      const tone = entry.action.includes("suspend") ? "dismissed"
        : entry.action.includes("resolved") ? "resolved"
        : entry.action.includes("investigating") ? "investigating"
        : "open";
      badge.className = `badge badge--${tone}`;
      badge.textContent = entry.action.replace("report_", "").replace("user_", "");
      top.append(title, badge);

      const meta = document.createElement("div");
      meta.className = "record__meta";
      const actor = entry.actor_username ? `by ${entry.actor_username}` : "system";
      const target = entry.target_label ? ` → ${entry.target_label}` : "";
      meta.textContent = `${actor}${target} • ${new Date(entry.created_at).toLocaleString()}`;

      card.append(top, meta);

      if (entry.detail) {
        const detail = document.createElement("div");
        detail.className = "record__subtle";
        detail.textContent = entry.detail;
        card.append(detail);
      }

      return card;
    }),
  );
}

function renderChannels(channels) {
  const container = getEl("channels-card");
  if (!container) return;

  if (!channels.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No channels found.";
    container.replaceChildren(empty);
    return;
  }

  container.replaceChildren(
    ...channels.map((channel) => {
      const card = document.createElement("article");
      card.className = "record";

      const top = document.createElement("div");
      top.className = "record__top";
      const title = document.createElement("div");
      title.className = "record__title";
      title.textContent = `#${channel.name}`;
      const badge = document.createElement("span");
      badge.className = "badge badge--open";
      badge.textContent = `${channel.message_count} messages`;
      top.append(title, badge);

      const meta = document.createElement("div");
      meta.className = "record__meta";
      meta.textContent = `${channel.channel_type} • ${channel.server_name || channel.server_id} • Created ${new Date(channel.created_at).toLocaleDateString()}`;

      card.append(top, meta);
      return card;
    }),
  );
}

function renderInstanceConfig(config) {
  const regEl = getEl("cfg-registration");
  const maxServersEl = getEl("cfg-max-servers");
  const maxChannelsEl = getEl("cfg-max-channels");
  const maxMessageEl = getEl("cfg-max-message");
  if (regEl) regEl.value = String(config.registration_enabled);
  if (maxServersEl) maxServersEl.value = config.max_servers_per_user;
  if (maxChannelsEl) maxChannelsEl.value = config.max_channels_per_server;
  if (maxMessageEl) maxMessageEl.value = config.max_message_length;
}

async function updateReport(reportId, status, resolutionNotes = "") {
  setStatus("Updating report…", "muted");
  try {
    await apiRequest(`/api/v1/admin/reports/${reportId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        resolution_notes: resolutionNotes || null,
      }),
    });
    await loadAdminData();
    setStatus(`Report marked ${status}.`, "success");
  } catch (error) {
    setStatus(error.message || "Failed to update report", "danger");
  }
}

async function deleteMessage(messageId) {
  setStatus("Deleting message…", "muted");
  try {
    await apiRequest(`/api/v1/admin/messages/${messageId}`, {
      method: "DELETE",
    });
    await loadAdminData();
    setStatus("Message deleted.", "success");
  } catch (error) {
    setStatus(error.message || "Failed to delete message", "danger");
  }
}

async function suspendUser(userId, reason) {
  setStatus("Suspending user…", "muted");
  try {
    await apiRequest(`/api/v1/admin/users/${userId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason: reason || null }),
    });
    await loadAdminData();
    setStatus("User suspended.", "success");
  } catch (error) {
    setStatus(error.message || "Failed to suspend user", "danger");
  }
}

async function unsuspendUser(userId) {
  setStatus("Restoring user…", "muted");
  try {
    await apiRequest(`/api/v1/admin/users/${userId}/unsuspend`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await loadAdminData();
    setStatus("User restored.", "success");
  } catch (error) {
    setStatus(error.message || "Failed to unsuspend user", "danger");
  }
}

async function loadPublicData() {
  const [config, features] = await Promise.all([
    fetch(`${state.apiOrigin}/api/v1/instance/config`).then((response) => response.json()),
    fetch(`${state.apiOrigin}/api/v1/instance/features`).then((response) => response.json()),
  ]);

  renderItems("instance-card", [
    ["Product", config.product.name],
    ["Tagline", config.product.tagline],
    ["Manifest", String(config.manifest_version)],
  ]);

  renderItems(
    "capabilities-card",
    Object.entries(features.capabilities).filter(([, enabled]) => Boolean(enabled)),
  );

  renderItems("services-card", Object.entries(config.services));
}

async function loadAdminData() {
  if (!state.token) {
    renderOverview({
      total_users: 0,
      total_servers: 0,
      total_messages: 0,
      open_reports: 0,
      investigating_reports: 0,
      suspended_users: 0,
    });
    renderReports([]);
    renderUsers([]);
    renderServers([]);
    renderAuditLog([]);
    renderChannels([]);
    renderItems("media-card", []);
    return;
  }

  const reportFilter = getEl("report-filter")?.value || "all";
  const userQuery = getEl("user-query")?.value || "";
  const serverQuery = getEl("server-query")?.value || "";
  const channelQuery = getEl("channel-query")?.value || "";

  try {
    const [overview, reports, users, servers, auditLog, channels, mediaStats, instanceConfig] = await Promise.all([
      apiRequest("/api/v1/admin/overview"),
      apiRequest(`/api/v1/admin/reports?status=${encodeURIComponent(reportFilter)}`),
      apiRequest(`/api/v1/admin/users${userQuery ? `?query=${encodeURIComponent(userQuery)}` : ""}`),
      apiRequest(`/api/v1/admin/servers${serverQuery ? `?query=${encodeURIComponent(serverQuery)}` : ""}`),
      apiRequest("/api/v1/admin/audit-log").catch(() => []),
      apiRequest(`/api/v1/admin/channels${channelQuery ? `?query=${encodeURIComponent(channelQuery)}` : ""}`).catch(() => []),
      apiRequest("/api/v1/admin/media-stats").catch(() => null),
      apiRequest("/api/v1/admin/config").catch(() => null),
    ]);
    renderOverview(overview);
    renderReports(reports);
    renderUsers(users);
    renderServers(servers);
    renderAuditLog(auditLog);
    renderChannels(channels);
    if (mediaStats) {
      renderItems("media-card", [
        ["Attachments", String(mediaStats.total_attachments)],
        ["User Avatars", String(mediaStats.total_avatars)],
        ["Server Icons", String(mediaStats.total_server_icons)],
      ]);
    }
    if (instanceConfig) {
      renderInstanceConfig(instanceConfig);
    }
    setStatus("Admin data refreshed.", "success");
  } catch (error) {
    if (error.message.includes("401") || error.message.includes("403")) {
      saveToken(null);
    }
    setStatus(error.message || "Failed to load admin data", "danger");
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = getEl("username").value.trim();
  const password = getEl("password").value;
  const otpCode = getEl("otp-code").value.trim();
  const submit = getEl("login-button");
  submit.disabled = true;
  setStatus("Signing in…", "muted");
  try {
    const token = await login(username, password, otpCode);
    saveToken(token.access_token);
    state.mfaRequired = false;
    getEl("otp-row").hidden = true;
    getEl("password").value = "";
    getEl("otp-code").value = "";
    await loadAdminData();
    setStatus("Signed in to Bergamot Admin.", "success");
  } catch (error) {
    if (error.code === "mfa_required" || error.code === "invalid_mfa_code") {
      state.mfaRequired = true;
      getEl("otp-row").hidden = false;
    }
    setStatus(error.message || "Login failed", "danger");
  } finally {
    submit.disabled = false;
  }
}

function handleLogout() {
  saveToken(null);
  state.mfaRequired = false;
  getEl("otp-row").hidden = true;
  setStatus("Signed out.", "muted");
  void loadAdminData();
}

function bindControls() {
  const apiOriginInput = getEl("api-origin");
  apiOriginInput.value = state.apiOrigin;
  apiOriginInput.addEventListener("change", () => {
    saveOrigin(apiOriginInput.value.trim() || defaultApiOrigin);
    void loadPublicData();
    if (state.token) {
      void loadAdminData();
    }
  });

  getEl("login-form").addEventListener("submit", handleLogin);
  getEl("logout-button").addEventListener("click", handleLogout);
  getEl("refresh-button").addEventListener("click", () => {
    void loadPublicData();
    void loadAdminData();
  });
  getEl("report-filter").addEventListener("change", () => {
    void loadAdminData();
  });
  getEl("user-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void loadAdminData();
  });
  getEl("server-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void loadAdminData();
  });
  getEl("channel-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void loadAdminData();
  });
  getEl("config-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Saving instance limits…", "muted");
    try {
      const payload = {};
      const regVal = getEl("cfg-registration")?.value;
      if (regVal != null) payload.registration_enabled = regVal === "true";
      const maxServers = getEl("cfg-max-servers")?.value;
      if (maxServers) payload.max_servers_per_user = Number(maxServers);
      const maxChannels = getEl("cfg-max-channels")?.value;
      if (maxChannels) payload.max_channels_per_server = Number(maxChannels);
      const maxMsg = getEl("cfg-max-message")?.value;
      if (maxMsg) payload.max_message_length = Number(maxMsg);
      await apiRequest("/api/v1/admin/config", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setStatus("Instance limits saved.", "success");
    } catch (error) {
      setStatus(error.message || "Failed to save limits", "danger");
    }
  });
}

async function load() {
  bindControls();
  await loadPublicData();
  await loadAdminData();
  setStatus(state.token ? "Ready." : "Sign in with an admin account to review reports.", "muted");
}

load().catch((error) => {
  setStatus(error instanceof Error ? error.message : "Failed to load Bergamot Admin", "danger");
});
