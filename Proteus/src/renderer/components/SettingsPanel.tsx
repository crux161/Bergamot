import React, { useState, useRef, useCallback } from "react";
import { Avatar, Button, Switch, Toast, Input } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { AuthSessionRead, MfaStatusRead, PasskeyRead, TotpSetupRead, UserRead, UserUpdate } from "../services/api";
import * as api from "../services/api";
import { getConfiguredServerUrl, setServerUrl } from "../services/api";
import { createPasskey, isPasskeySupported } from "../services/passkeys";
import {
  getAvailableThemes as getRuntimeThemes,
  getStoredBaseTheme,
  getThemeRuntimeState,
  getThemePreviewContract,
  hasThemeBridge,
  initializeThemeRuntime,
  refreshThemeCatalog,
  selectTheme as selectRuntimeTheme,
  setBaseTheme as setRuntimeBaseTheme,
  subscribeThemeCatalog,
  subscribeThemeState,
} from "../theme/runtime";
import type { BaseTheme, ProteusThemeContract } from "../theme/runtime";
import { isWebPlatform } from "../services/webBridge";
import { capabilityStore } from "../stores/capabilityStore";
import { useStoreSnapshot } from "../stores/createStore";

// ── Settings navigation structure ──

interface SettingsSection {
  label: string;
  items: { key: string; label: string; icon: string }[];
}

const SECTIONS: SettingsSection[] = [
  {
    label: "User Settings",
    items: [
      { key: "account", label: "My Account", icon: "user-circle" },
      { key: "profile", label: "User Profile", icon: "eye" },
      { key: "privacy", label: "Privacy & Safety", icon: "shield" },
      { key: "sessions", label: "Devices & Sessions", icon: "devices" },
      { key: "connections", label: "Connections", icon: "link" },
      { key: "authorized-apps", label: "Authorized Apps", icon: "app-window" },
      { key: "gift-links", label: "Gift Links", icon: "gift" },
    ],
  },
  {
    label: "App Settings",
    items: [
      { key: "appearance", label: "Appearance", icon: "paint-brush" },
      { key: "accessibility", label: "Accessibility", icon: "hand-pointing" },
      { key: "voice-video", label: "Voice & Video", icon: "microphone" },
      { key: "connection", label: "Connection", icon: "network" },
      { key: "notifications", label: "Notifications", icon: "bell" },
      { key: "keybinds", label: "Keybinds", icon: "keyboard" },
      { key: "language", label: "Language", icon: "translate" },
    ],
  },
  {
    label: "Data & Privacy",
    items: [
      { key: "data-export", label: "Request Data", icon: "download-simple" },
    ],
  },
];

interface Props {
  currentUser: UserRead;
  onClose: () => void;
  onLogout: () => void;
  onUserUpdated?: (user: UserRead) => void;
}

export const SettingsPanel: React.FC<Props> = ({ currentUser, onClose, onLogout, onUserUpdated }) => {
  const [activeKey, setActiveKey] = useState("account");
  const { flags } = useStoreSnapshot(capabilityStore);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="settings-overlay">
      {/* Left sidebar navigation */}
      <nav className="settings-nav">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="settings-nav__section">{section.label}</div>
            {section.items.map((item) => (
              <div
                key={item.key}
                className={`settings-nav__item ${activeKey === item.key ? "settings-nav__item--active" : ""}`}
                onClick={() => setActiveKey(item.key)}
              >
                <PhIcon name={item.icon} size={18} className="settings-nav__item-icon" />
                <span className="settings-nav__item-label">{item.label}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="settings-nav__divider" />
        <div
          className="settings-nav__item settings-nav__item--danger"
          onClick={onLogout}
        >
          <PhIcon name="sign-out" size={18} className="settings-nav__item-icon" />
          <span className="settings-nav__item-label">Log Out</span>
        </div>
      </nav>

      {/* Content area */}
      <div className="settings-content">
        <div className="settings-content__header">
          <h2 className="settings-content__title">
            {SECTIONS.flatMap((s) => s.items).find((i) => i.key === activeKey)?.label}
          </h2>
          <div className="settings-content__close" onClick={onClose}>
            <PhIcon name="x" size={24} />
            <span className="settings-content__close-label">ESC</span>
          </div>
        </div>

        <div className="settings-content__body">
          {(activeKey === "account" || activeKey === "sessions") && (
            <AccountSettings
              currentUser={currentUser}
              onLogout={onLogout}
              sessionsEnabled={flags.sessions}
              accountSwitchingEnabled={flags.accountSwitching}
            />
          )}
          {activeKey === "profile" && (
            <ProfileSettings currentUser={currentUser} onUserUpdated={onUserUpdated} />
          )}
          {activeKey === "appearance" && <AppearanceSettings />}
          {activeKey === "connection" && <ConnectionSettings />}
          {activeKey === "notifications" && <NotificationSettings />}
          {activeKey === "privacy" && <PrivacySettings mfaEnabled={flags.mfa} passkeysEnabled={flags.passkeys} />}
          {activeKey === "connections" && <ConnectionsPane />}
          {activeKey === "keybinds" && <PlaceholderPane title="Keybinds" description="Record and customize keyboard shortcuts for navigation, messaging, and media controls." />}
          {activeKey === "language" && <PlaceholderPane title="Language" description="Select your preferred language. Bergamot will use this for all UI text and date formatting." />}
          {activeKey === "authorized-apps" && <AuthorizedAppsPane oauthEnabled={flags.oauth} />}
          {activeKey === "gift-links" && <GiftLinksPane />}
          {activeKey === "accessibility" && <PlaceholderPane title="Accessibility" description="Configure reduced motion, high contrast mode, font scaling, and screen reader optimizations to make Bergamot comfortable for everyone." />}
          {activeKey === "voice-video" && <PlaceholderPane title="Voice & Video" description="Select your input and output devices, adjust sensitivity, configure echo cancellation, noise suppression, and video quality settings." />}
          {activeKey === "data-export" && <PlaceholderPane title="Request Your Data" description="Request a copy of all data associated with your account. This includes messages, attachments, and account information. The export will be prepared and made available for download." />}
        </div>
      </div>
    </div>
  );
};

// ── Helpers ──

function parseDeviceInfo(ua: string | null, clientName: string): { icon: string; label: string } {
  if (!ua) return { icon: "device-mobile", label: clientName || "Unknown device" };
  const lower = ua.toLowerCase();
  let os = "Unknown OS";
  let icon = "desktop";
  if (lower.includes("windows")) { os = "Windows"; icon = "desktop"; }
  else if (lower.includes("macintosh") || lower.includes("mac os")) { os = "macOS"; icon = "desktop"; }
  else if (lower.includes("linux") && !lower.includes("android")) { os = "Linux"; icon = "desktop"; }
  else if (lower.includes("android")) { os = "Android"; icon = "device-mobile"; }
  else if (lower.includes("iphone") || lower.includes("ipad")) { os = "iOS"; icon = "device-mobile"; }
  let browser = "";
  if (lower.includes("firefox")) browser = "Firefox";
  else if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome") && !lower.includes("edg/")) browser = "Chrome";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "Safari";
  const label = [clientName, browser, os].filter(Boolean).join(" · ");
  return { icon, label };
}

// ── Sub-panes ──

function resolveUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${getConfiguredServerUrl()}${url}` : url;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: "Online", color: "var(--status-positive)" },
  idle: { label: "Idle", color: "var(--status-warning)" },
  dnd: { label: "Do Not Disturb", color: "var(--status-danger)" },
  offline: { label: "Invisible", color: "var(--text-muted)" },
};

interface ThemePreviewOption {
  filename: string | null;
  label: string;
  theme: ProteusThemeContract;
}

function formatThemeWord(word: string): string {
  if (!word) return word;
  if (word.toLowerCase() === "amoled") return "AMOLED";
  if (/^[A-Z0-9]+$/.test(word)) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatThemeLabel(filename: string | null): string {
  if (!filename) return "Proteus Default";

  const withoutExtension = filename
    .replace(/\.theme\.css$/i, "")
    .replace(/\.css$/i, "");
  const spaced = withoutExtension
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return spaced
    .split(" ")
    .map(formatThemeWord)
    .join(" ");
}

function buildThemePreviewStyle(theme: ProteusThemeContract): React.CSSProperties {
  const { colors, ui } = theme;
  return {
    ["--theme-preview-bg-0" as "--theme-preview-bg-0"]: colors["bg-0"],
    ["--theme-preview-bg-1" as "--theme-preview-bg-1"]: colors["bg-1"],
    ["--theme-preview-bg-2" as "--theme-preview-bg-2"]: colors["bg-2"],
    ["--theme-preview-bg-3" as "--theme-preview-bg-3"]: colors["bg-3"],
    ["--theme-preview-accent" as "--theme-preview-accent"]: colors.accent,
    ["--theme-preview-accent-soft" as "--theme-preview-accent-soft"]: colors["accent-subtle"],
    ["--theme-preview-text" as "--theme-preview-text"]: colors["text-0"],
    ["--theme-preview-muted" as "--theme-preview-muted"]: colors["text-2"],
    ["--theme-preview-border" as "--theme-preview-border"]: colors.border,
    ["--theme-preview-selected" as "--theme-preview-selected"]: colors.selected,
    ["--theme-preview-radius" as "--theme-preview-radius"]: ui["radius-card"],
    ["--theme-preview-shadow" as "--theme-preview-shadow"]: ui["shadow-card"],
    ["--theme-preview-density" as "--theme-preview-density"]: ui["density-scale"],
  } as React.CSSProperties;
}

const AccountSettings: React.FC<{
  currentUser: UserRead;
  onLogout: () => void;
  sessionsEnabled: boolean;
  accountSwitchingEnabled: boolean;
}> = ({ currentUser, onLogout, sessionsEnabled, accountSwitchingEnabled }) => {
  const bannerUrl = resolveUrl(currentUser.banner_url);
  const avatarUrl = resolveUrl(currentUser.avatar_url);
  const [sessions, setSessions] = useState<AuthSessionRead[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<api.StoredAccount[]>(() => api.listSavedAccounts());
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);

  const handleChangePassword = useCallback(async () => {
    if (!currentPw.trim() || !newPw.trim()) {
      Toast.warning({ content: "Please fill in all fields", duration: 2 });
      return;
    }
    if (newPw !== confirmPw) {
      Toast.error({ content: "New passwords do not match", duration: 2 });
      return;
    }
    if (newPw.length < 8) {
      Toast.error({ content: "New password must be at least 8 characters", duration: 2 });
      return;
    }
    setChangingPw(true);
    try {
      await api.changePassword(currentPw, newPw);
      Toast.success({ content: "Password changed successfully", duration: 1.5 });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setShowPwForm(false);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to change password", duration: 2 });
    } finally {
      setChangingPw(false);
    }
  }, [currentPw, newPw, confirmPw]);

  const loadSessions = useCallback(async () => {
    if (!sessionsEnabled) return;
    setLoadingSessions(true);
    try {
      setSessions(await api.listSessions());
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load sessions", duration: 2 });
    } finally {
      setLoadingSessions(false);
    }
  }, [sessionsEnabled]);

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevokeSession = useCallback(async (authSession: AuthSessionRead) => {
    setRevokingId(authSession.id);
    try {
      await api.revokeSession(authSession.id);
      Toast.success({ content: authSession.current ? "Current session revoked" : "Session revoked", duration: 1.5 });
      if (authSession.current) {
        onLogout();
        return;
      }
      await loadSessions();
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to revoke session", duration: 2 });
    } finally {
      setRevokingId(null);
    }
  }, [loadSessions, onLogout]);

  const handleRevokeOthers = useCallback(async () => {
    setRevokingOthers(true);
    try {
      const result = await api.revokeOtherSessions();
      Toast.success({ content: `Revoked ${result.revoked_count} other session${result.revoked_count === 1 ? "" : "s"}`, duration: 1.5 });
      await loadSessions();
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to revoke other sessions", duration: 2 });
    } finally {
      setRevokingOthers(false);
    }
  }, [loadSessions]);

  const refreshSavedAccounts = useCallback(() => {
    setSavedAccounts(api.listSavedAccounts());
  }, []);

  const handleSwitchAccount = useCallback((accountKey: string) => {
    try {
      api.switchToSavedAccount(accountKey);
      window.location.reload();
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to switch accounts", duration: 2 });
      refreshSavedAccounts();
    }
  }, [refreshSavedAccounts]);

  const handleRemoveAccount = useCallback((accountKey: string) => {
    const remaining = api.removeSavedAccount(accountKey);
    refreshSavedAccounts();
    Toast.success({ content: "Saved account removed", duration: 1.5 });

    if (!remaining.some((account) => account.id === currentUser.id && account.server_url === getConfiguredServerUrl())) {
      onLogout();
    }
  }, [currentUser.id, onLogout, refreshSavedAccounts]);

  const handleAddAnotherAccount = useCallback(() => {
    api.clearToken();
    window.location.reload();
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card">
        <div
          className="settings-card__banner"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="settings-card__body">
          <div className="settings-card__user-row">
            {avatarUrl ? (
              <Avatar size="large" src={avatarUrl} style={{ width: 56, height: 56 }} />
            ) : (
              <Avatar size="large" style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)", width: 56, height: 56, fontSize: 22 }}>
                {currentUser.username[0].toUpperCase()}
              </Avatar>
            )}
            <div>
              <div className="settings-card__username">{currentUser.display_name || currentUser.username}</div>
              <div className="settings-card__email">{currentUser.email}</div>
            </div>
          </div>

          <div className="settings-card__info-grid">
            <div className="settings-card__info-row">
              <div>
                <div className="settings-card__label">Username</div>
                <div className="settings-card__value">{currentUser.username}</div>
              </div>
              <Button size="small" theme="light">Edit</Button>
            </div>
            <div className="settings-card__info-row">
              <div>
                <div className="settings-card__label">Email</div>
                <div className="settings-card__value">{currentUser.email}</div>
              </div>
              <Button size="small" theme="light">Edit</Button>
            </div>
            <div className="settings-card__info-row">
              <div>
                <div className="settings-card__label">Status</div>
                <div className="settings-card__value" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: STATUS_LABELS[currentUser.status]?.color || "var(--status-positive)", display: "inline-block" }} />
                  {STATUS_LABELS[currentUser.status]?.label || "Online"}
                  {currentUser.status_message && (
                    <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>- {currentUser.status_message}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="settings-card__info-row">
              <div>
                <div className="settings-card__label">Member Since</div>
                <div className="settings-card__value">
                  {new Date(currentUser.created_at).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ color: "var(--header-primary)", marginBottom: 4 }}>Password</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              Change the password used to sign into your account.
            </p>
          </div>
          {!showPwForm && (
            <Button size="small" theme="light" onClick={() => setShowPwForm(true)}>
              Change Password
            </Button>
          )}
        </div>
        {showPwForm && (
          <div style={{ display: "grid", gap: 10, maxWidth: 360 }}>
            <div>
              <div className="settings-card__label">Current Password</div>
              <Input
                type="password"
                value={currentPw}
                onChange={setCurrentPw}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <div className="settings-card__label">New Password</div>
              <Input
                type="password"
                value={newPw}
                onChange={setNewPw}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <div className="settings-card__label">Confirm New Password</div>
              <Input
                type="password"
                value={confirmPw}
                onChange={setConfirmPw}
                placeholder="Confirm new password"
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                theme="solid"
                loading={changingPw}
                style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                onClick={() => { void handleChangePassword(); }}
              >
                Update Password
              </Button>
              <Button theme="borderless" onClick={() => { setShowPwForm(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div>
            <h3 style={{ color: "var(--header-primary)", marginBottom: 6 }}>Sessions</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Review where your account is signed in and revoke devices you no longer trust.
            </p>
          </div>
          {sessionsEnabled && (
            <Button
              size="small"
              theme="light"
              loading={revokingOthers}
              disabled={loadingSessions || sessions.filter((item) => !item.current).length === 0}
              onClick={handleRevokeOthers}
            >
              Log Out Other Sessions
            </Button>
          )}
        </div>

        {!sessionsEnabled ? (
          <p style={{ color: "var(--text-muted)" }}>Session management is not enabled on this Bergamot instance yet.</p>
        ) : loadingSessions ? (
          <p style={{ color: "var(--text-muted)" }}>Loading your active sessions...</p>
        ) : sessions.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No session-backed logins were found. Sign in again to start tracking this device.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {sessions.map((authSession) => (
              <div
                key={authSession.id}
                style={{
                  border: "1px solid var(--background-modifier-accent)",
                  borderRadius: 12,
                  padding: 14,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <PhIcon name={parseDeviceInfo(authSession.user_agent, authSession.client_name).icon} size={24} />
                    <div>
                      <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>
                        {parseDeviceInfo(authSession.user_agent, authSession.client_name).label}
                        {authSession.current ? (
                          <span style={{ marginLeft: 8, color: "var(--brand-experiment)" }}>(Current)</span>
                        ) : null}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        {authSession.ip_address || "IP unavailable"}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="small"
                    theme={authSession.current ? "solid" : "light"}
                    type={authSession.current ? "danger" : "primary"}
                    loading={revokingId === authSession.id}
                    onClick={() => { void handleRevokeSession(authSession); }}
                  >
                    {authSession.current ? "Log Out" : "Revoke"}
                  </Button>
                </div>
                <div style={{ color: "var(--text-normal)", fontSize: 13 }}>
                  Last active {new Date(authSession.last_seen_at).toLocaleString()}
                </div>
                <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                  Signed in {new Date(authSession.created_at).toLocaleString()} · Expires {new Date(authSession.expires_at).toLocaleString()}
                </div>
                {authSession.user_agent ? (
                  <div style={{ color: "var(--interactive-muted)", fontSize: 12, wordBreak: "break-word" }}>
                    {authSession.user_agent}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {accountSwitchingEnabled && (
        <div className="settings-card" style={{ padding: 24 }}>
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            <h3 style={{ color: "var(--header-primary)", marginBottom: 0 }}>Account Switching</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
              Keep multiple Bergamot accounts on this device and move between them without re-entering every password.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Button
              theme="solid"
              style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
              onClick={handleAddAnotherAccount}
            >
              Add Another Account
            </Button>
          </div>

          {savedAccounts.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No saved accounts yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {savedAccounts.map((account) => {
                const isCurrent = account.id === currentUser.id && account.server_url === getConfiguredServerUrl();
                const accountAvatarUrl = account.avatar_url
                  ? (account.avatar_url.startsWith("/") ? `${account.server_url}${account.avatar_url}` : account.avatar_url)
                  : null;
                return (
                  <div
                    key={account.key}
                    style={{
                      border: "1px solid var(--background-modifier-accent)",
                      borderRadius: 12,
                      padding: 14,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {accountAvatarUrl ? (
                          <Avatar src={accountAvatarUrl} style={{ width: 42, height: 42 }} />
                        ) : (
                          <Avatar style={{ width: 42, height: 42, backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)" }}>
                            {(account.display_name || account.username)[0].toUpperCase()}
                          </Avatar>
                        )}
                        <div>
                          <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>
                            {account.display_name || account.username}
                            {isCurrent ? <span style={{ marginLeft: 8, color: "var(--brand-experiment)" }}>(Current)</span> : null}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                            @{account.username} · {account.server_url.replace(/^https?:\/\//, "")}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {!isCurrent ? (
                          <Button size="small" theme="light" onClick={() => handleSwitchAccount(account.key)}>
                            Switch
                          </Button>
                        ) : null}
                        <Button size="small" theme="borderless" type="danger" onClick={() => handleRemoveAccount(account.key)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                      Last used {new Date(account.last_used_at).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PrivacySettings: React.FC<{ mfaEnabled: boolean; passkeysEnabled: boolean }> = ({ mfaEnabled, passkeysEnabled }) => {
  const [status, setStatus] = useState<MfaStatusRead | null>(null);
  const [setup, setSetup] = useState<TotpSetupRead | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRead[]>([]);
  const [relationships, setRelationships] = useState<api.FriendshipRead[]>([]);
  const [blockingUsername, setBlockingUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [creatingPasskey, setCreatingPasskey] = useState(false);
  const [newPasskeyLabel, setNewPasskeyLabel] = useState("");
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  const loadStatus = useCallback(async () => {
    if (!mfaEnabled) {
      setStatus(null);
      return;
    }
    setLoading(true);
    try {
      setStatus(await api.getMfaStatus());
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load MFA settings", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [mfaEnabled]);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const loadPasskeys = useCallback(async () => {
    if (!passkeysEnabled) {
      setPasskeys([]);
      return;
    }
    setPasskeyLoading(true);
    try {
      setPasskeys(await api.listPasskeys());
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load passkeys", duration: 2 });
    } finally {
      setPasskeyLoading(false);
    }
  }, [passkeysEnabled]);

  React.useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

  const loadRelationships = useCallback(async () => {
    setBlockedLoading(true);
    try {
      setRelationships(await api.listFriends());
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load relationships", duration: 2 });
    } finally {
      setBlockedLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadRelationships();
  }, [loadRelationships]);

  const blockedUsers = relationships.filter((relationship) => relationship.relationship_type === api.RelationshipType.BLOCKED);

  const handleBeginSetup = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.beginTotpSetup();
      setSetup(next);
      setStatus({ enabled: next.enabled, pending_setup: next.pending_setup, enabled_at: next.enabled_at });
      setCode("");
      Toast.success({ content: "Authenticator setup started", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to begin setup", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEnable = useCallback(async () => {
    if (code.trim().length < 6) {
      Toast.warning({ content: "Enter the 6-digit code from your authenticator app", duration: 2 });
      return;
    }
    setLoading(true);
    try {
      const next = await api.enableTotp(code.trim());
      setStatus(next);
      setSetup(null);
      setCode("");
      Toast.success({ content: "Two-factor authentication enabled", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to enable MFA", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [code]);

  const handleDisable = useCallback(async () => {
    if (disableCode.trim().length < 6) {
      Toast.warning({ content: "Enter the current 6-digit code to disable MFA", duration: 2 });
      return;
    }
    setLoading(true);
    try {
      const next = await api.disableTotp(disableCode.trim());
      setStatus(next);
      setSetup(null);
      setDisableCode("");
      Toast.success({ content: "Two-factor authentication disabled", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to disable MFA", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [disableCode]);

  const handleCreatePasskey = useCallback(async () => {
    if (!passkeysEnabled) return;
    if (!isPasskeySupported()) {
      Toast.warning({ content: "Passkeys need a secure browser context such as https or localhost.", duration: 2 });
      return;
    }
    setCreatingPasskey(true);
    try {
      const challenge = await api.beginPasskeyRegistration(newPasskeyLabel.trim() || undefined);
      const credential = await createPasskey(challenge.public_key);
      await api.finishPasskeyRegistration(challenge.challenge_id, credential);
      setNewPasskeyLabel("");
      await loadPasskeys();
      Toast.success({ content: "Passkey added", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to create passkey", duration: 2 });
    } finally {
      setCreatingPasskey(false);
    }
  }, [loadPasskeys, newPasskeyLabel, passkeysEnabled]);

  const handleDeletePasskey = useCallback(async (passkeyId: string) => {
    setPasskeyLoading(true);
    try {
      await api.deletePasskey(passkeyId);
      await loadPasskeys();
      Toast.success({ content: "Passkey removed", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to remove passkey", duration: 2 });
    } finally {
      setPasskeyLoading(false);
    }
  }, [loadPasskeys]);

  const handleBlockUsername = useCallback(async () => {
    const username = blockingUsername.trim();
    if (!username) {
      Toast.warning({ content: "Enter a username to block", duration: 2 });
      return;
    }
    setBlockedLoading(true);
    try {
      await api.blockUserByUsername(username);
      setBlockingUsername("");
      await loadRelationships();
      Toast.success({ content: `Blocked ${username}`, duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to block user", duration: 2 });
      setBlockedLoading(false);
    }
  }, [blockingUsername, loadRelationships]);

  const handleUnblock = useCallback(async (userId: string) => {
    setBlockedLoading(true);
    try {
      await api.removeFriend(userId);
      await loadRelationships();
      Toast.success({ content: "User unblocked", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to unblock user", duration: 2 });
      setBlockedLoading(false);
    }
  }, [loadRelationships]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 16 }}>
        <div>
          <h3 style={{ color: "var(--header-primary)", marginBottom: 6 }}>Two-Factor Authentication</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Protect your Bergamot account with a time-based code from an authenticator app.
          </p>
        </div>

        {!mfaEnabled ? (
          <p style={{ color: "var(--text-muted)" }}>
            This Bergamot instance has not enabled MFA yet.
          </p>
        ) : loading && !status && !setup ? (
          <p style={{ color: "var(--text-muted)" }}>Loading your MFA status...</p>
        ) : status?.enabled ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 12,
                padding: 14,
                background: "rgba(80, 200, 120, 0.08)",
              }}
            >
              <div style={{ color: "var(--header-primary)", fontWeight: 600, marginBottom: 6 }}>
                MFA is enabled
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                {status.enabled_at
                  ? `Enabled on ${new Date(status.enabled_at).toLocaleString()}`
                  : "Your account now requires an authenticator code when signing in."}
              </div>
            </div>
            <div style={{ display: "grid", gap: 8, maxWidth: 320 }}>
              <div className="settings-card__label">Disable MFA</div>
              <Input
                value={disableCode}
                onChange={setDisableCode}
                placeholder="123456"
                maxLength={6}
              />
              <Button
                theme="solid"
                type="danger"
                loading={loading}
                onClick={() => { void handleDisable(); }}
              >
                Disable Two-Factor Authentication
              </Button>
            </div>
          </div>
        ) : setup ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 10,
              }}
            >
              <div>
                <div className="settings-card__label">Secret</div>
                <div className="settings-card__value" style={{ fontFamily: "monospace", letterSpacing: "0.08em" }}>
                  {setup.secret}
                </div>
              </div>
              <div>
                <div className="settings-card__label">Authenticator URI</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12, wordBreak: "break-all" }}>
                  {setup.otpauth_uri}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  size="small"
                  theme="light"
                  onClick={() => {
                    navigator.clipboard.writeText(setup.secret).then(() => {
                      Toast.success({ content: "Secret copied", duration: 1.5 });
                    }).catch(() => {
                      Toast.error({ content: "Failed to copy secret", duration: 2 });
                    });
                  }}
                >
                  Copy Secret
                </Button>
                <Button
                  size="small"
                  theme="light"
                  onClick={() => {
                    navigator.clipboard.writeText(setup.otpauth_uri).then(() => {
                      Toast.success({ content: "Authenticator URI copied", duration: 1.5 });
                    }).catch(() => {
                      Toast.error({ content: "Failed to copy URI", duration: 2 });
                    });
                  }}
                >
                  Copy URI
                </Button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, maxWidth: 320 }}>
              <div className="settings-card__label">Confirm Setup</div>
              <Input
                value={code}
                onChange={setCode}
                placeholder="Enter the 6-digit code"
                maxLength={6}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  theme="solid"
                  loading={loading}
                  style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                  onClick={() => { void handleEnable(); }}
                >
                  Enable MFA
                </Button>
                <Button
                  theme="light"
                  disabled={loading}
                  onClick={() => { void handleBeginSetup(); }}
                >
                  Regenerate Secret
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              Add Bergamot to your authenticator app, then confirm a code to require MFA on future logins.
            </p>
            <div>
              <Button
                theme="solid"
                loading={loading}
                style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                onClick={() => { void handleBeginSetup(); }}
              >
                Set Up Authenticator App
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 16 }}>
        <div>
          <h3 style={{ color: "var(--header-primary)", marginBottom: 6 }}>Passkeys</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Sign in with Touch ID, Face ID, Windows Hello, or a hardware security key without typing your password.
          </p>
        </div>

        {!passkeysEnabled ? (
          <p style={{ color: "var(--text-muted)" }}>
            This Bergamot instance has not enabled passkeys yet.
          </p>
        ) : !isPasskeySupported() ? (
          <p style={{ color: "var(--text-muted)" }}>
            This client is not running in a secure WebAuthn context. Use `https` or `localhost` in a supported browser to enroll a passkey.
          </p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Input
                value={newPasskeyLabel}
                onChange={setNewPasskeyLabel}
                placeholder="Optional label, like MacBook Touch ID"
                style={{ maxWidth: 320 }}
              />
              <Button
                theme="solid"
                loading={creatingPasskey}
                style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                onClick={() => { void handleCreatePasskey(); }}
              >
                Add Passkey
              </Button>
            </div>

            {passkeyLoading ? (
              <p style={{ color: "var(--text-muted)" }}>Loading your passkeys...</p>
            ) : passkeys.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No passkeys enrolled yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    style={{
                      border: "1px solid var(--background-modifier-accent)",
                      borderRadius: 12,
                      padding: 14,
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>
                          {passkey.label}
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                          Added {new Date(passkey.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        size="small"
                        theme="light"
                        type="danger"
                        disabled={passkeyLoading}
                        onClick={() => { void handleDeletePasskey(passkey.id); }}
                      >
                        Remove
                      </Button>
                    </div>
                    <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                      {passkey.last_used_at
                        ? `Last used ${new Date(passkey.last_used_at).toLocaleString()}`
                        : "Not used for sign-in yet"}
                    </div>
                    {passkey.transports.length > 0 ? (
                      <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                        {passkey.transports.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 16 }}>
        <div>
          <h3 style={{ color: "var(--header-primary)", marginBottom: 6 }}>Blocked Users</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Prevent specific people from sending friend requests or appearing in your social surfaces.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Input
            value={blockingUsername}
            onChange={setBlockingUsername}
            placeholder="Block by username"
            style={{ maxWidth: 320 }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleBlockUsername();
              }
            }}
          />
          <Button
            theme="solid"
            loading={blockedLoading}
            style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
            onClick={() => { void handleBlockUsername(); }}
          >
            Block User
          </Button>
        </div>

        {blockedLoading && blockedUsers.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Loading blocked users...</p>
        ) : blockedUsers.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>You have not blocked anyone yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {blockedUsers.map((relationship) => (
              <div
                key={relationship.id}
                style={{
                  border: "1px solid var(--background-modifier-accent)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>
                    {relationship.peer_display_name || relationship.peer_username || "Unknown user"}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    @{relationship.peer_username || "unknown"}
                  </div>
                </div>
                <Button
                  size="small"
                  theme="light"
                  disabled={blockedLoading}
                  onClick={() => { void handleUnblock(relationship.peer_id); }}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ProfileSettings: React.FC<{ currentUser: UserRead; onUserUpdated?: (user: UserRead) => void }> = ({ currentUser, onUserUpdated }) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(currentUser.display_name || "");
  const [editingName, setEditingName] = useState(false);
  const [status, setStatus] = useState<string>(currentUser.status || "online");
  const [statusMessage, setStatusMessage] = useState(currentUser.status_message || "");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  const avatarUrl = avatarPreview || resolveUrl(currentUser.avatar_url);
  const bannerUrl = bannerPreview || resolveUrl(currentUser.banner_url);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Show local preview
      setAvatarPreview(URL.createObjectURL(file));
      const att = await api.uploadFile(file);
      const updated = await api.updateProfile({ avatar_url: att.url.replace(getConfiguredServerUrl(), "") });
      if (onUserUpdated) onUserUpdated(updated);
      Toast.success({ content: "Avatar updated", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to upload avatar", duration: 2 });
      setAvatarPreview(null);
    }
  }, [onUserUpdated]);

  const handleBannerUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBannerPreview(URL.createObjectURL(file));
      const att = await api.uploadFile(file);
      const updated = await api.updateProfile({ banner_url: att.url.replace(getConfiguredServerUrl(), "") });
      if (onUserUpdated) onUserUpdated(updated);
      Toast.success({ content: "Banner updated", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to upload banner", duration: 2 });
      setBannerPreview(null);
    }
  }, [onUserUpdated]);

  const handleSaveDisplayName = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ display_name: displayName || null });
      if (onUserUpdated) onUserUpdated(updated);
      setEditingName(false);
      Toast.success({ content: "Display name updated", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to update", duration: 2 });
    }
    setSaving(false);
  }, [displayName, onUserUpdated]);

  const handleSaveStatus = useCallback(async () => {
    setSaving(true);
    try {
      const data: UserUpdate = { status: status as any };
      // DND doesn't support status message
      if (status === "dnd" || status === "offline") {
        data.status_message = null;
      } else {
        data.status_message = statusMessage || null;
      }
      const updated = await api.updateProfile(data);
      if (onUserUpdated) onUserUpdated(updated);
      Toast.success({ content: "Status updated", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to update status", duration: 2 });
    }
    setSaving(false);
  }, [status, statusMessage, onUserUpdated]);

  const handleRemoveAvatar = useCallback(async () => {
    try {
      const updated = await api.updateProfile({ avatar_url: null });
      if (onUserUpdated) onUserUpdated(updated);
      setAvatarPreview(null);
      Toast.success({ content: "Avatar removed", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message, duration: 2 });
    }
  }, [onUserUpdated]);

  const handleRemoveBanner = useCallback(async () => {
    try {
      const updated = await api.updateProfile({ banner_url: null });
      if (onUserUpdated) onUserUpdated(updated);
      setBannerPreview(null);
      Toast.success({ content: "Banner removed", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message, duration: 2 });
    }
  }, [onUserUpdated]);

  const previewName = displayName || currentUser.display_name || currentUser.username;
  const previewStatus = STATUS_LABELS[status] || STATUS_LABELS.online;

  return (
    <div className="profile-settings-layout">
      {/* Left column — editor fields */}
      <div className="profile-settings-layout__editor">
        {/* Hidden file inputs */}
        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
        <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerUpload} />

        {/* Display Name */}
        <div className="settings-card" style={{ padding: 24 }}>
          <div className="settings-card__label" style={{ marginBottom: 8 }}>Display Name</div>
          {editingName ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Input
                value={displayName}
                onChange={setDisplayName}
                style={{ flex: 1 }}
                maxLength={64}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveDisplayName()}
              />
              <Button
                size="small"
                style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                loading={saving}
                onClick={handleSaveDisplayName}
              >
                Save
              </Button>
              <Button size="small" theme="borderless" style={{ color: "var(--text-normal)" }} onClick={() => { setEditingName(false); setDisplayName(currentUser.display_name || ""); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="settings-card__info-row" style={{ padding: 0, border: "none" }}>
              <div className="settings-card__value">{currentUser.display_name || currentUser.username}</div>
              <Button size="small" theme="light" onClick={() => setEditingName(true)}>Edit</Button>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="settings-card" style={{ padding: 24 }}>
          <div className="settings-card__label" style={{ marginBottom: 12 }}>Avatar</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button
              size="small"
              style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
              onClick={() => avatarInputRef.current?.click()}
            >
              Change Avatar
            </Button>
            {(currentUser.avatar_url || avatarPreview) && (
              <Button size="small" theme="borderless" style={{ color: "var(--status-danger)" }} onClick={handleRemoveAvatar}>
                Remove Avatar
              </Button>
            )}
          </div>
        </div>

        {/* Banner */}
        <div className="settings-card" style={{ padding: 24 }}>
          <div className="settings-card__label" style={{ marginBottom: 12 }}>Banner</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Button
              size="small"
              style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
              onClick={() => bannerInputRef.current?.click()}
            >
              Change Banner
            </Button>
            {(currentUser.banner_url || bannerPreview) && (
              <Button size="small" theme="borderless" style={{ color: "var(--status-danger)" }} onClick={handleRemoveBanner}>
                Remove Banner
              </Button>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="settings-card" style={{ padding: 24 }}>
          <div className="settings-card__label" style={{ marginBottom: 12 }}>Status</div>
          <div className="profile-status-options">
            {(["online", "idle", "dnd", "offline"] as const).map((s) => (
              <div
                key={s}
                className={`profile-status-option ${status === s ? "profile-status-option--active" : ""}`}
                onClick={() => setStatus(s)}
              >
                <span className="profile-status-option__dot" style={{ backgroundColor: STATUS_LABELS[s].color }} />
                <span className="profile-status-option__label">{STATUS_LABELS[s].label}</span>
              </div>
            ))}
          </div>

          {/* Status message (not for DND/offline) */}
          {(status === "online" || status === "idle") && (
            <div style={{ marginTop: 16 }}>
              <div className="settings-card__label" style={{ marginBottom: 8 }}>Custom Status Message</div>
              <Input
                value={statusMessage}
                onChange={setStatusMessage}
                placeholder="What are you up to?"
                maxLength={128}
              />
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Button
              style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
              loading={saving}
              onClick={handleSaveStatus}
            >
              Save Status
            </Button>
          </div>
        </div>
      </div>

      {/* Right column — live preview */}
      <div className="profile-settings-layout__preview">
        <div className="settings-card__label" style={{ marginBottom: 12 }}>Preview</div>
        <div className="profile-preview-card">
          <div
            className="profile-preview-card__banner"
            style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          />
          <div className="profile-preview-card__body">
            <div className="profile-preview-card__avatar-row">
              {avatarUrl ? (
                <Avatar src={avatarUrl} style={{ width: 56, height: 56 }} />
              ) : (
                <Avatar style={{ backgroundColor: "var(--semi-color-primary-light-default)", color: "var(--header-primary)", width: 56, height: 56, fontSize: 22 }}>
                  {currentUser.username[0].toUpperCase()}
                </Avatar>
              )}
              <span className="profile-preview-card__status-dot" style={{ backgroundColor: previewStatus.color }} />
            </div>
            <div className="profile-preview-card__name">{previewName}</div>
            <div className="profile-preview-card__username">{currentUser.username}</div>
            {statusMessage && (status === "online" || status === "idle") && (
              <div className="profile-preview-card__status-msg">{statusMessage}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AppearanceSettings: React.FC = () => {
  const [themes, setThemes] = useState<string[]>(getRuntimeThemes());
  const [activeTheme, setActiveTheme] = useState<string | null>(getThemeRuntimeState().activeTheme);
  const [baseTheme, setBaseThemeState] = useState<BaseTheme>(getStoredBaseTheme);
  const [themePreviews, setThemePreviews] = useState<ThemePreviewOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [themesPath, setThemesPath] = useState(hasThemeBridge() ? "Loading path..." : "Not available outside Electron");

  const handleBaseTheme = useCallback((t: BaseTheme) => {
    setBaseThemeState(t);
    void setRuntimeBaseTheme(t).catch((err: Error) => {
      Toast.error({ content: err.message || "Failed to update theme mode", duration: 2 });
    });
  }, []);

  const fetchThemes = useCallback(async () => {
    if (!hasThemeBridge()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      await initializeThemeRuntime();
      const list = await refreshThemeCatalog();
      setThemes(list);
    } catch {
      setThemes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const stopCatalog = subscribeThemeCatalog((nextThemes) => {
      setThemes(nextThemes);
    });
    const stopState = subscribeThemeState((state) => {
      setActiveTheme(state.activeTheme);
      setBaseThemeState(state.baseTheme);
    });

    void initializeThemeRuntime()
      .then(() => refreshThemeCatalog())
      .catch(() => setThemes([]))
      .finally(() => setLoading(false));

    if (hasThemeBridge()) {
      window.bergamot?.getThemesPath().then(setThemesPath).catch(() => {});
    }

    return () => {
      stopCatalog();
      stopState();
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    if (!hasThemeBridge()) {
      setThemePreviews([]);
      setPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setPreviewLoading(true);

    void (async () => {
      try {
        const fallbackTheme = await getThemePreviewContract(null, baseTheme);
        const previewEntries = await Promise.all(
          [null, ...themes].map(async (filename) => {
            try {
              const theme = await getThemePreviewContract(filename, baseTheme);
              return {
                filename,
                label: formatThemeLabel(filename),
                theme,
              };
            } catch {
              return {
                filename,
                label: formatThemeLabel(filename),
                theme: fallbackTheme,
              };
            }
          }),
        );

        if (!cancelled) {
          setThemePreviews(previewEntries);
        }
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [baseTheme, themes]);

  const selectTheme = useCallback(async (filename: string | null) => {
    if (!hasThemeBridge()) return;
    try {
      await selectRuntimeTheme(filename);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load theme", duration: 2 });
    }
  }, []);

  return (
    <div>
      {/* Theme section */}
      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 4 }}>Theme</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          Adjust the color of the interface for better visibility.
        </p>
        <div className="theme-swatches">
          <div
            className={`theme-swatch ${baseTheme === "dark" ? "theme-swatch--active" : ""}`}
            onClick={() => handleBaseTheme("dark")}
          >
            <div className="theme-swatch__preview theme-swatch__preview--dark" />
            <span className="theme-swatch__label">Dark</span>
          </div>
          <div
            className={`theme-swatch ${baseTheme === "light" ? "theme-swatch--active" : ""}`}
            onClick={() => handleBaseTheme("light")}
          >
            <div className="theme-swatch__preview theme-swatch__preview--light" />
            <span className="theme-swatch__label">Light</span>
          </div>
        </div>
      </div>

      {/* Custom theme selector */}
      <div className="settings-card" style={{ padding: 24 }}>
        <div className="theme-gallery__header">
          <div>
            <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Custom Themes</h3>
            <p className="theme-gallery__description">
              Pick a bundled Proteus or BetterDiscord theme from its preview. Proteus will hot reload if the selected file changes.
            </p>
          </div>
          {hasThemeBridge() && (
            <div className="theme-gallery__actions">
              <Button size="small" theme="borderless" style={{ color: "var(--text-normal)" }} onClick={fetchThemes}>
                Refresh
              </Button>
              {!isWebPlatform() && (
                <Button
                  size="small"
                  style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                  onClick={() => window.bergamot?.openThemesFolder()}
                >
                  Open Themes Folder
                </Button>
              )}
            </div>
          )}
        </div>

        {!hasThemeBridge() ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Custom BetterDiscord themes are only available in the Proteus desktop app.
          </p>
        ) : (
          <>
            <div className="settings-card__label" style={{ marginBottom: 10 }}>Choose Theme</div>
            <div className="theme-gallery">
              <div className="theme-gallery__grid">
                {themePreviews.map((preview) => {
                  const isActive = (preview.filename ?? null) === (activeTheme ?? null);

                  return (
                    <button
                      key={preview.filename ?? "__proteus_default__"}
                      type="button"
                      className={`theme-thumbnail ${isActive ? "theme-thumbnail--active" : ""}`}
                      style={buildThemePreviewStyle(preview.theme)}
                      onClick={() => { void selectTheme(preview.filename); }}
                      aria-pressed={isActive}
                      disabled={loading}
                      title={preview.label}
                    >
                      <div className="theme-thumbnail__preview">
                        <span className="theme-thumbnail__glow" />
                        <span className="theme-thumbnail__topbar" />
                        <span className="theme-thumbnail__panel" />
                        <span className="theme-thumbnail__accent" />
                        <span className="theme-thumbnail__line theme-thumbnail__line--primary" />
                        <span className="theme-thumbnail__line theme-thumbnail__line--secondary" />
                        <span className="theme-thumbnail__indicator" />
                      </div>
                      <span className="theme-thumbnail__label">{preview.label}</span>
                    </button>
                  );
                })}
              </div>

              {previewLoading && (
                <p className="theme-gallery__status">Refreshing theme previews…</p>
              )}
            </div>

            {themes.length === 0 && !loading && !previewLoading && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
                No custom themes found yet. Proteus Default is still available above.
              </p>
            )}

            <p style={{ color: "var(--interactive-muted)", fontSize: 12, marginTop: 12 }}>
              Themes directory: <code style={{ color: "var(--text-muted)" }}>{themesPath}</code>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const ConnectionSettings: React.FC = () => {
  const [serverUrl, setUrl] = useState(getConfiguredServerUrl());
  const [saved, setSaved] = useState(true);

  const currentUrl = getConfiguredServerUrl();
  const isDirty = serverUrl.replace(/\/+$/, "") !== currentUrl;

  const handleSave = useCallback(() => {
    const cleaned = serverUrl.replace(/\/+$/, "").trim();
    if (!cleaned) {
      Toast.error({ content: "Server URL cannot be empty", duration: 2 });
      return;
    }
    try {
      new URL(cleaned); // validate
    } catch {
      Toast.error({ content: "Invalid URL format", duration: 2 });
      return;
    }
    setSaved(true);
    Toast.info({ content: "Reconnecting to new server…", duration: 2 });
    // setServerUrl triggers a page reload
    setTimeout(() => setServerUrl(cleaned), 300);
  }, [serverUrl]);

  const handleReset = useCallback(() => {
    localStorage.removeItem("bergamot_server_url");
    Toast.info({ content: "Reset to default. Reloading…", duration: 2 });
    setTimeout(() => window.location.reload(), 300);
  }, []);

  return (
    <div>
      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Server Connection</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
          Configure which Bergamot backend server to connect to. The app will reload after changing.
        </p>

        <div className="settings-card__label" style={{ marginBottom: 8 }}>Server URL</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            value={serverUrl}
            onChange={(v) => { setUrl(v); setSaved(false); }}
            placeholder="http://localhost:8000"
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === "Enter" && isDirty && handleSave()}
          />
          <Button
            size="small"
            style={isDirty ? { background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" } : {}}
            disabled={!isDirty}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <Button size="small" theme="borderless" style={{ color: "var(--text-normal)" }} onClick={handleReset}>
            Reset to Default (localhost:8000)
          </Button>
        </div>

        <p style={{ color: "var(--interactive-muted)", fontSize: 12, marginTop: 16 }}>
          API endpoint: <code style={{ color: "var(--text-muted)" }}>{currentUrl}/api/v1</code>
          <br />
          WebSocket: <code style={{ color: "var(--text-muted)" }}>ws://{(() => { try { return new URL(currentUrl).hostname; } catch { return "localhost"; } })()}:4000/socket</code>
        </p>
      </div>
    </div>
  );
};

const NOTIF_PREFS_KEY = "bergamot_notification_prefs";

interface NotifPrefs {
  desktop: boolean;
  sounds: boolean;
  badge: boolean;
  mentionsOnly: boolean;
  mutedServers: string[];
  suppressDms: boolean;
}

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (raw) return { ...defaultNotifPrefs, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...defaultNotifPrefs };
}

const defaultNotifPrefs: NotifPrefs = {
  desktop: true,
  sounds: true,
  badge: true,
  mentionsOnly: false,
  mutedServers: [],
  suppressDms: false,
};

function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
}

const NotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const [servers, setServers] = useState<api.ServerRead[]>([]);

  React.useEffect(() => {
    api.listServers().then(setServers).catch(() => {});
  }, []);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveNotifPrefs(next);
      return next;
    });
  };

  const toggleMuteServer = (serverId: string) => {
    setPrefs((prev) => {
      const muted = prev.mutedServers.includes(serverId)
        ? prev.mutedServers.filter((id) => id !== serverId)
        : [...prev.mutedServers, serverId];
      const next = { ...prev, mutedServers: muted };
      saveNotifPrefs(next);
      return next;
    });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 16 }}>Notification Preferences</h3>
        {([
          { key: "desktop" as const, label: "Enable Desktop Notifications" },
          { key: "sounds" as const, label: "Enable Message Sounds" },
          { key: "badge" as const, label: "Show Unread Message Badge" },
          { key: "mentionsOnly" as const, label: "Notify on Mentions Only" },
          { key: "suppressDms" as const, label: "Suppress DM Notifications" },
        ]).map((opt) => (
          <div key={opt.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--background-modifier-accent)" }}>
            <span style={{ color: "var(--text-normal)" }}>{opt.label}</span>
            <Switch checked={!!prefs[opt.key]} onChange={() => toggle(opt.key)} />
          </div>
        ))}
      </div>

      {servers.length > 0 && (
        <div className="settings-card" style={{ padding: 24 }}>
          <h3 style={{ color: "var(--header-primary)", marginBottom: 6 }}>Per-Server Notification Overrides</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
            Mute notifications for specific servers. Muted servers will not produce desktop alerts or sounds.
          </p>
          {servers.map((server) => (
            <div key={server.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--background-modifier-accent)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {server.icon_url ? (
                  <img src={server.icon_url} alt="" style={{ width: 24, height: 24, borderRadius: "50%" }} />
                ) : (
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--background-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                    {server.name[0]}
                  </div>
                )}
                <span style={{ color: "var(--text-normal)", fontSize: 14 }}>{server.name}</span>
              </div>
              <Switch
                checked={!prefs.mutedServers.includes(server.id)}
                onChange={() => toggleMuteServer(server.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ConnectionsPane: React.FC = () => {
  const [connections, setConnections] = useState<api.ExternalConnectionRead[]>([]);
  const [providers, setProviders] = useState<api.ExternalConnectionProviderRead[]>([]);
  const [provider, setProvider] = useState("github");
  const [accountHint, setAccountHint] = useState("");
  const [providerAccountId, setProviderAccountId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [linkPreview, setLinkPreview] = useState<api.ExternalConnectionLinkStartRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guidedLinking, setGuidedLinking] = useState(false);

  const loadConnections = useCallback(async () => {
    setLoading(true);
    try {
      const [nextProviders, nextConnections] = await Promise.all([
        api.listConnectionProviders(),
        api.listConnections(),
      ]);
      setProviders(nextProviders);
      setConnections(nextConnections);
      if (nextProviders.length > 0 && !nextProviders.some((entry) => entry.id === provider)) {
        setProvider(nextProviders[0].id);
      }
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load linked accounts", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [provider]);

  React.useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  const currentProviderMeta = providers.find((entry) => entry.id === provider) || null;
  const currentProviderConnection = connections.find((entry) => entry.provider === provider) || null;

  const resetDrafts = useCallback(() => {
    setLinkPreview(null);
    setProviderAccountId("");
    setUsername("");
    setDisplayName("");
    setProfileUrl("");
  }, []);

  const handleStartGuidedLink = useCallback(async () => {
    setSaving(true);
    try {
      const preview = await api.beginConnectionLink(provider, {
        account_hint: accountHint.trim() || null,
        display_name: displayName.trim() || null,
      });
      setLinkPreview(preview);
      setProviderAccountId(preview.provider_account_id);
      setUsername(preview.username || "");
      setDisplayName(preview.display_name || "");
      setProfileUrl(preview.profile_url || "");
      Toast.success({ content: `${preview.provider_label} connection ready`, duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to prepare linked account flow", duration: 2 });
    } finally {
      setSaving(false);
    }
  }, [accountHint, displayName, provider]);

  const handleLink = useCallback(async () => {
    if (!providerAccountId.trim()) {
      Toast.warning({ content: "Enter the external account id or handle", duration: 2 });
      return;
    }
    setSaving(true);
    try {
      await api.linkConnection(provider, {
        provider_account_id: providerAccountId.trim(),
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        profile_url: profileUrl.trim() || null,
      });
      resetDrafts();
      setAccountHint("");
      await loadConnections();
      Toast.success({ content: `${provider} account linked`, duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to link account", duration: 2 });
    } finally {
      setSaving(false);
    }
  }, [displayName, loadConnections, profileUrl, provider, providerAccountId, resetDrafts, username]);

  const handleCompleteGuided = useCallback(async () => {
    if (!linkPreview) return;
    setGuidedLinking(true);
    try {
      await api.completeConnectionLink(provider, {
        challenge_id: linkPreview.challenge_id,
        provider_account_id: providerAccountId.trim() || null,
        username: username.trim() || null,
        display_name: displayName.trim() || null,
        profile_url: profileUrl.trim() || null,
      });
      setAccountHint("");
      resetDrafts();
      await loadConnections();
      Toast.success({ content: `${linkPreview.provider_label} account linked`, duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to finish linked account flow", duration: 2 });
    } finally {
      setGuidedLinking(false);
    }
  }, [displayName, linkPreview, loadConnections, profileUrl, provider, providerAccountId, resetDrafts, username]);

  const handleRemove = useCallback(async (connectionId: string) => {
    try {
      await api.removeConnection(connectionId);
      if (connections.some((entry) => entry.id === connectionId && entry.provider === provider)) {
        resetDrafts();
      }
      await loadConnections();
      Toast.success({ content: "Linked account removed", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to remove linked account", duration: 2 });
    }
  }, [connections, loadConnections, provider, resetDrafts]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 14 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Linked Accounts</h3>
        <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
          Connect external identities for profile presence, future SSO, and richer account integrations.
        </p>

        <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
          <label style={{ color: "var(--text-muted)", fontSize: 12 }}>Provider</label>
          <select
            value={provider}
            onChange={(event) => {
              setProvider(event.target.value);
              resetDrafts();
            }}
            style={{
              background: "var(--background-secondary)",
              color: "var(--text-normal)",
              border: "1px solid var(--background-modifier-accent)",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            {providers.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
          {currentProviderMeta ? (
            <div
              style={{
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 6,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{currentProviderMeta.label}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{currentProviderMeta.description}</div>
              {currentProviderMeta.default_scopes.length > 0 ? (
                <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                  Default scopes: {currentProviderMeta.default_scopes.join(", ")}
                </div>
              ) : null}
              {currentProviderConnection ? (
                <div style={{ color: "var(--brand-experiment)", fontSize: 12 }}>
                  Currently linked as @{currentProviderConnection.username || currentProviderConnection.provider_account_id}
                </div>
              ) : null}
            </div>
          ) : null}

          <Input value={accountHint} onChange={setAccountHint} placeholder="Account handle to prefill, like bergamot-dev" />
          <Input value={providerAccountId} onChange={setProviderAccountId} placeholder="Provider account id" />
          <Input value={username} onChange={setUsername} placeholder="Public username (optional)" />
          <Input value={displayName} onChange={setDisplayName} placeholder="Display name (optional)" />
          <Input value={profileUrl} onChange={setProfileUrl} placeholder="Profile URL (optional)" />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              theme="solid"
              loading={saving}
              style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
              onClick={() => { void handleStartGuidedLink(); }}
            >
              Start Guided Link
            </Button>
            <Button
              theme="light"
              loading={saving}
              onClick={() => { void handleLink(); }}
            >
              Save Manual Link
            </Button>
            {(linkPreview || providerAccountId || username || displayName || profileUrl) ? (
              <Button theme="borderless" onClick={resetDrafts}>
                Clear Draft
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {linkPreview ? (
        <div className="settings-card" style={{ padding: 24, display: "grid", gap: 12 }}>
          <h3 style={{ color: "var(--header-primary)", marginBottom: 0 }}>Finish Guided Link</h3>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Bergamot prepared a {linkPreview.provider_label} authorization preview for this account. Review it, adjust any fields you want, and finish linking before it expires.
          </p>
          <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
            Expires {new Date(linkPreview.expires_at).toLocaleString()}
          </div>
          <div style={{ color: "var(--text-normal)", fontSize: 13 }}>{linkPreview.description}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button
              theme="solid"
              loading={guidedLinking}
              style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
              onClick={() => { void handleCompleteGuided(); }}
            >
              Complete Guided Link
            </Button>
            <Button theme="light" onClick={resetDrafts}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Connected Providers</h3>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading linked accounts...</p>
        ) : connections.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No linked accounts yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {connections.map((connection) => (
              <div
                key={connection.id}
                style={{
                  border: "1px solid var(--background-modifier-accent)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>
                    {connection.display_name || connection.username || connection.provider_account_id}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                    {connection.provider_label || connection.provider} · {connection.username || connection.provider_account_id}
                  </div>
                  {connection.connection_metadata?.default_scopes?.length ? (
                    <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                      {connection.connection_metadata.default_scopes.join(", ")}
                    </div>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {connection.profile_url ? (
                    <Button size="small" theme="light" onClick={() => window.open(connection.profile_url || "", "_blank", "noopener,noreferrer")}>
                      Open
                    </Button>
                  ) : null}
                  <Button size="small" theme="borderless" type="danger" onClick={() => { void handleRemove(connection.id); }}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const GiftLinksPane: React.FC = () => {
  const [created, setCreated] = useState<api.GiftCodeRead[]>([]);
  const [claimed, setClaimed] = useState<api.GiftCodeRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [claimMessage, setClaimMessage] = useState("");
  const [theme, setTheme] = useState("");
  const [expiresHours, setExpiresHours] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [createdGifts, claimedGifts] = await Promise.all([
        api.listCreatedGifts(),
        api.listClaimedGifts(),
      ]);
      setCreated(createdGifts);
      setClaimed(claimedGifts);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load gift links", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) {
      Toast.warning({ content: "A gift title is required", duration: 2 });
      return;
    }
    setCreating(true);
    try {
      const gift = await api.createGift({
        title: title.trim(),
        description: description.trim() || null,
        claim_message: claimMessage.trim() || null,
        theme: theme.trim() || null,
        expires_in_hours: expiresHours.trim() ? Number(expiresHours) : null,
      });
      setCreated((prev) => [gift, ...prev]);
      setTitle("");
      setDescription("");
      setClaimMessage("");
      setTheme("");
      setExpiresHours("");
      Toast.success({ content: "Gift link created", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to create gift link", duration: 2 });
    } finally {
      setCreating(false);
    }
  }, [claimMessage, description, expiresHours, theme, title]);

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      Toast.success({ content: "Gift link copied", duration: 1.5 });
    } catch {
      Toast.warning({ content: url, duration: 3 });
    }
  }, []);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 10 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 4 }}>Create Gift Link</h3>
        <Input value={title} onChange={setTitle} placeholder="Gift title" />
        <Input value={description} onChange={setDescription} placeholder="Description (optional)" />
        <Input value={claimMessage} onChange={setClaimMessage} placeholder="Message shown after claim (optional)" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input value={theme} onChange={setTheme} placeholder="Theme slug (optional)" />
          <Input value={expiresHours} onChange={setExpiresHours} placeholder="Expires in hours" />
        </div>
        <Button
          theme="solid"
          loading={creating}
          style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
          onClick={() => { void handleCreate(); }}
        >
          Create Gift Link
        </Button>
      </div>

      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Created Gift Links</h3>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading gifts...</p>
        ) : created.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>You have not created any gift links yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {created.map((gift) => (
              <div key={gift.id} style={{ border: "1px solid var(--background-modifier-accent)", borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{gift.title}</div>
                  <Button size="small" theme="light" onClick={() => { void handleCopy(gift.gift_url); }}>
                    Copy
                  </Button>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{gift.gift_url}</div>
                {gift.description ? <div style={{ color: "var(--text-normal)", fontSize: 13 }}>{gift.description}</div> : null}
                <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                  {gift.theme ? `Theme: ${gift.theme} · ` : ""}Created {new Date(gift.created_at).toLocaleString()}
                </div>
                {gift.claimed_at ? (
                  <div style={{ color: "var(--status-positive)", fontSize: 12 }}>
                    Claimed {new Date(gift.claimed_at).toLocaleString()}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Claimed Gifts</h3>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading claimed gifts...</p>
        ) : claimed.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No gifts claimed on this account yet.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {claimed.map((gift) => (
              <div key={gift.id} style={{ border: "1px solid var(--background-modifier-accent)", borderRadius: 12, padding: 14, display: "grid", gap: 6 }}>
                <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{gift.title}</div>
                {gift.description ? <div style={{ color: "var(--text-normal)", fontSize: 13 }}>{gift.description}</div> : null}
                <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                  Claimed {gift.claimed_at ? new Date(gift.claimed_at).toLocaleString() : "earlier"}
                  {gift.theme ? ` · Theme: ${gift.theme}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const AuthorizedAppsPane: React.FC<{ oauthEnabled: boolean }> = ({ oauthEnabled }) => {
  const [authorizedApps, setAuthorizedApps] = useState<api.OAuthAuthorizedAppRead[]>([]);
  const [applications, setApplications] = useState<api.OAuthApplicationRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<{ name: string; description: string; redirect_uri: string; scopes: string } | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [scopes, setScopes] = useState("identify");

  const load = useCallback(async () => {
    if (!oauthEnabled) return;
    setLoading(true);
    try {
      const [authorized, apps] = await Promise.all([
        api.listAuthorizedApps(),
        api.listOAuthApplications(),
      ]);
      setAuthorizedApps(authorized);
      setApplications(apps);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load OAuth settings", duration: 2 });
    } finally {
      setLoading(false);
    }
  }, [oauthEnabled]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || !redirectUri.trim()) {
      Toast.warning({ content: "Name and redirect URI are required", duration: 2 });
      return;
    }
    setCreating(true);
    try {
      const created = await api.createOAuthApplication({
        name: name.trim(),
        description: description.trim() || null,
        redirect_uri: redirectUri.trim(),
        scopes: scopes.split(",").map((entry) => entry.trim()).filter(Boolean),
      });
      setApplications((prev) => [created, ...prev]);
      setName("");
      setDescription("");
      setRedirectUri("");
      setScopes("identify");
      Toast.success({
        content: created.client_secret
          ? `App created. Save the client secret now: ${created.client_secret}`
          : "OAuth application created",
        duration: 4,
      });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to create OAuth application", duration: 2 });
    } finally {
      setCreating(false);
    }
  }, [description, name, redirectUri, scopes]);

  const beginEditingApplication = useCallback((application: api.OAuthApplicationRead) => {
    setEditingAppId(application.id);
    setEditingDraft({
      name: application.name,
      description: application.description || "",
      redirect_uri: application.redirect_uri,
      scopes: application.scopes.join(", "),
    });
  }, []);

  const cancelEditingApplication = useCallback(() => {
    setEditingAppId(null);
    setEditingDraft(null);
  }, []);

  const handleSaveApplication = useCallback(async (applicationId: string) => {
    if (!editingDraft) return;
    try {
      await api.updateOAuthApplication(applicationId, {
        name: editingDraft.name.trim(),
        description: editingDraft.description.trim() || null,
        redirect_uri: editingDraft.redirect_uri.trim(),
        scopes: editingDraft.scopes.split(",").map((entry) => entry.trim()).filter(Boolean),
      });
      cancelEditingApplication();
      await load();
      Toast.success({ content: "OAuth application updated", duration: 1.5 });
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to update OAuth application", duration: 2 });
    }
  }, [cancelEditingApplication, editingDraft, load]);

  const copyText = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      Toast.success({ content: `${label} copied`, duration: 1.5 });
    } catch {
      Toast.warning({ content: value, duration: 3 });
    }
  }, []);

  if (!oauthEnabled) {
    return <PlaceholderPane title="Authorized Apps" description="OAuth is not enabled on this Bergamot instance yet." />;
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Authorized Apps</h3>
        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading authorized apps...</p>
        ) : authorizedApps.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No applications have access to your account.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {authorizedApps.map((grant) => (
              <div
                key={grant.id}
                style={{
                  border: "1px solid var(--background-modifier-accent)",
                  borderRadius: 12,
                  padding: 14,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{grant.application_name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{grant.scopes.join(", ") || "No scopes"}</div>
                  <div style={{ color: "var(--interactive-muted)", fontSize: 12 }}>
                    Last used {grant.last_used_at ? new Date(grant.last_used_at).toLocaleString() : "not yet"}
                  </div>
                </div>
                <Button
                  size="small"
                  theme="borderless"
                  type="danger"
                  onClick={() => {
                    void api.revokeAuthorizedApp(grant.id)
                      .then(load)
                      .then(() => Toast.success({ content: "Authorized app revoked", duration: 1.5 }))
                      .catch((err: any) => Toast.error({ content: err.message || "Failed to revoke app", duration: 2 }));
                  }}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card" style={{ padding: 24, display: "grid", gap: 12 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Developer Applications</h3>
        <Input value={name} onChange={setName} placeholder="Application name" />
        <Input value={description} onChange={setDescription} placeholder="Description (optional)" />
        <Input value={redirectUri} onChange={setRedirectUri} placeholder="https://example.com/oauth/callback" />
        <Input value={scopes} onChange={setScopes} placeholder="identify, messages.read" />
        <Button
          theme="solid"
          loading={creating}
          style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
          onClick={() => { void handleCreate(); }}
        >
          Create OAuth Application
        </Button>

        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          {applications.map((application) => (
            <div
              key={application.id}
              style={{
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 12,
                padding: 14,
                display: "grid",
                gap: 6,
              }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ color: "var(--header-primary)", fontWeight: 600 }}>{application.name}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      size="small"
                      theme="light"
                      onClick={() => beginEditingApplication(application)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      theme="light"
                      onClick={() => {
                        void api.rotateOAuthApplicationSecret(application.id)
                          .then((result) => Toast.success({ content: `New client secret: ${result.client_secret}`, duration: 4 }))
                          .catch((err: any) => Toast.error({ content: err.message || "Failed to rotate secret", duration: 2 }));
                      }}
                    >
                      Rotate Secret
                    </Button>
                    <Button
                      size="small"
                      theme="light"
                      onClick={() => {
                        void api.provisionOAuthBot(application.id)
                          .then((result) => {
                            Toast.success({ content: `Bot token: ${result.token}`, duration: 4 });
                            return load();
                          })
                          .catch((err: any) => Toast.error({ content: err.message || "Failed to provision bot", duration: 2 }));
                      }}
                    >
                      {application.has_bot ? "Regenerate Bot Token" : "Create Bot"}
                    </Button>
                    <Button
                      size="small"
                      theme="borderless"
                      type="danger"
                      onClick={() => {
                        void api.deleteOAuthApplication(application.id)
                          .then(load)
                          .then(() => Toast.success({ content: "OAuth application deleted", duration: 1.5 }))
                          .catch((err: any) => Toast.error({ content: err.message || "Failed to delete app", duration: 2 }));
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                {application.description ? (
                  <div style={{ color: "var(--text-normal)", fontSize: 13 }}>{application.description}</div>
                ) : null}
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: "var(--text-muted)", fontSize: 12 }}>
                  <span>Client ID: {application.client_id}</span>
                  <Button size="small" theme="borderless" onClick={() => { void copyText(application.client_id, "Client ID"); }}>Copy</Button>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", color: "var(--text-muted)", fontSize: 12 }}>
                  <span>Redirect URI: {application.redirect_uri}</span>
                  <Button size="small" theme="borderless" onClick={() => { void copyText(application.redirect_uri, "Redirect URI"); }}>Copy</Button>
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Scopes: {application.scopes.join(", ") || "None"}</div>
                {application.bot_username ? (
                  <div style={{ color: "var(--brand-experiment)", fontSize: 12 }}>
                    Bot User: @{application.bot_username}
                  </div>
                ) : null}
              {application.client_secret ? (
                <div style={{ color: "var(--brand-experiment)", fontSize: 12 }}>
                  Client Secret: {application.client_secret}
                </div>
              ) : null}
              {editingAppId === application.id && editingDraft ? (
                <div
                  style={{
                    borderTop: "1px solid var(--background-modifier-accent)",
                    marginTop: 8,
                    paddingTop: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <Input
                    value={editingDraft.name}
                    onChange={(value) => setEditingDraft((prev) => (prev ? { ...prev, name: value } : prev))}
                    placeholder="Application name"
                  />
                  <Input
                    value={editingDraft.description}
                    onChange={(value) => setEditingDraft((prev) => (prev ? { ...prev, description: value } : prev))}
                    placeholder="Description"
                  />
                  <Input
                    value={editingDraft.redirect_uri}
                    onChange={(value) => setEditingDraft((prev) => (prev ? { ...prev, redirect_uri: value } : prev))}
                    placeholder="Redirect URI"
                  />
                  <Input
                    value={editingDraft.scopes}
                    onChange={(value) => setEditingDraft((prev) => (prev ? { ...prev, scopes: value } : prev))}
                    placeholder="identify, messages.read"
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      size="small"
                      theme="solid"
                      style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                      onClick={() => { void handleSaveApplication(application.id); }}
                    >
                      Save Changes
                    </Button>
                    <Button size="small" theme="light" onClick={cancelEditingApplication}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const PlaceholderPane: React.FC<{ title: string; description?: string }> = ({ title, description }) => (
  <div className="settings-card" style={{ padding: 24 }}>
    <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>{title}</h3>
    <p style={{ color: "var(--text-muted)" }}>{description || "This section is under construction."}</p>
  </div>
);
