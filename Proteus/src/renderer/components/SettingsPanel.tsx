import React, { useState, useRef, useCallback } from "react";
import { Avatar, Button, Switch, Toast, Input } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { UserRead, UserUpdate } from "../services/api";
import * as api from "../services/api";
import { getConfiguredServerUrl, setServerUrl } from "../services/api";

// ── Settings navigation structure ──

interface SettingsSection {
  label: string;
  items: { key: string; label: string }[];
}

const SECTIONS: SettingsSection[] = [
  {
    label: "User Settings",
    items: [
      { key: "account", label: "My Account" },
      { key: "profile", label: "User Profile" },
      { key: "privacy", label: "Privacy & Safety" },
      { key: "connections", label: "Connections" },
    ],
  },
  {
    label: "App Settings",
    items: [
      { key: "appearance", label: "Appearance" },
      { key: "connection", label: "Connection" },
      { key: "notifications", label: "Notifications" },
      { key: "keybinds", label: "Keybinds" },
      { key: "language", label: "Language" },
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
                {item.label}
              </div>
            ))}
          </div>
        ))}
        <div className="settings-nav__divider" />
        <div
          className="settings-nav__item settings-nav__item--danger"
          onClick={onLogout}
        >
          Log Out
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
          {activeKey === "account" && (
            <AccountSettings currentUser={currentUser} />
          )}
          {activeKey === "profile" && (
            <ProfileSettings currentUser={currentUser} onUserUpdated={onUserUpdated} />
          )}
          {activeKey === "appearance" && <AppearanceSettings />}
          {activeKey === "connection" && <ConnectionSettings />}
          {activeKey === "notifications" && <NotificationSettings />}
          {activeKey === "privacy" && <PlaceholderPane title="Privacy & Safety" />}
          {activeKey === "connections" && <ConnectionsPane />}
          {activeKey === "keybinds" && <PlaceholderPane title="Keybinds" />}
          {activeKey === "language" && <PlaceholderPane title="Language" />}
        </div>
      </div>
    </div>
  );
};

// ── Sub-panes ──

function resolveUrl(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("/") ? `${getConfiguredServerUrl()}${url}` : url;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: "Online", color: "#23a55a" },
  idle: { label: "Idle", color: "#f0b232" },
  dnd: { label: "Do Not Disturb", color: "#f23f43" },
  offline: { label: "Invisible", color: "#80848e" },
};

const AccountSettings: React.FC<{ currentUser: UserRead }> = ({ currentUser }) => {
  const bannerUrl = resolveUrl(currentUser.banner_url);
  const avatarUrl = resolveUrl(currentUser.avatar_url);

  return (
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
            <Avatar size="large" style={{ backgroundColor: "#3d5d42", color: "#e0e1e5", width: 56, height: 56, fontSize: 22 }}>
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
                <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: STATUS_LABELS[currentUser.status]?.color || "#23a55a", display: "inline-block" }} />
                {STATUS_LABELS[currentUser.status]?.label || "Online"}
                {currentUser.status_message && (
                  <span style={{ color: "#80848e", marginLeft: 4 }}>— {currentUser.status_message}</span>
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

  return (
    <div>
      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
      <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleBannerUpload} />

      {/* Banner section */}
      <div className="settings-card profile-banner-card">
        <div
          className="profile-banner"
          style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="profile-banner__overlay">
            <Button
              icon={<PhIcon name="camera" />}
              theme="borderless"
              style={{ color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 20 }}
              onClick={() => bannerInputRef.current?.click()}
            >
              Change Banner
            </Button>
            {(currentUser.banner_url || bannerPreview) && (
              <Button
                theme="borderless"
                style={{ color: "#fff", background: "rgba(0,0,0,0.5)", borderRadius: 20 }}
                onClick={handleRemoveBanner}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Avatar + name area */}
        <div className="profile-avatar-area">
          <div className="profile-avatar-wrapper" onClick={() => avatarInputRef.current?.click()}>
            {avatarUrl ? (
              <Avatar src={avatarUrl} style={{ width: 80, height: 80 }} />
            ) : (
              <Avatar style={{ backgroundColor: "#3d5d42", color: "#e0e1e5", width: 80, height: 80, fontSize: 32 }}>
                {currentUser.username[0].toUpperCase()}
              </Avatar>
            )}
            <div className="profile-avatar-wrapper__overlay">
              <PhIcon name="camera" size={20} />
            </div>
          </div>
          <div className="profile-avatar-actions">
            <Button
              size="small"
              style={{ background: "#6b9362", borderColor: "#6b9362", color: "#fff" }}
              onClick={() => avatarInputRef.current?.click()}
            >
              Change Avatar
            </Button>
            {(currentUser.avatar_url || avatarPreview) && (
              <Button size="small" theme="borderless" style={{ color: "#f23f43" }} onClick={handleRemoveAvatar}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Display Name */}
      <div className="settings-card" style={{ padding: 24 }}>
        <div className="settings-card__label" style={{ marginBottom: 8 }}>Display Name</div>
        {editingName ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Input
              value={displayName}
              onChange={setDisplayName}
              style={{ flex: 1, backgroundColor: "#1e1f22", borderColor: "#3f4147", color: "#e0e1e5" }}
              maxLength={64}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSaveDisplayName()}
            />
            <Button
              size="small"
              style={{ background: "#6b9362", borderColor: "#6b9362", color: "#fff" }}
              loading={saving}
              onClick={handleSaveDisplayName}
            >
              Save
            </Button>
            <Button size="small" theme="borderless" style={{ color: "#b5bac1" }} onClick={() => { setEditingName(false); setDisplayName(currentUser.display_name || ""); }}>
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
              style={{ backgroundColor: "#1e1f22", borderColor: "#3f4147", color: "#e0e1e5" }}
            />
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Button
            style={{ background: "#6b9362", borderColor: "#6b9362", color: "#fff" }}
            loading={saving}
            onClick={handleSaveStatus}
          >
            Save Status
          </Button>
        </div>
      </div>
    </div>
  );
};

/** Inject or remove custom theme CSS in the document head. */
function applyThemeCss(css: string | null) {
  const id = "bergamot-custom-theme";
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!css) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

const THEME_NAME_KEY = "bergamot_selected_theme";
const THEME_CSS_KEY = "bergamot_theme_css";
const BASE_THEME_KEY = "bergamot_base_theme";

type BaseTheme = "dark" | "light";

/** Apply a base theme class to <html> and <body> for BD theme `:is(.theme-dark, ...)` selectors. */
function applyBaseTheme(theme: BaseTheme) {
  const classes = ["theme-dark", "theme-light"];
  const root = document.documentElement;
  const body = document.body;
  classes.forEach((c) => {
    root.classList.remove(c);
    body.classList.remove(c);
  });
  root.classList.add(`theme-${theme}`);
  body.classList.add(`theme-${theme}`);
  localStorage.setItem(BASE_THEME_KEY, theme);
}

function getBaseTheme(): BaseTheme {
  return (localStorage.getItem(BASE_THEME_KEY) as BaseTheme) || "dark";
}

/** Whether the Electron preload bridge is available (false in pure browser dev). */
const hasBridge = typeof window.bergamot?.getAvailableThemes === "function";

const AppearanceSettings: React.FC = () => {
  const [themes, setThemes] = useState<string[]>([]);
  const [activeTheme, setActiveTheme] = useState<string | null>(
    localStorage.getItem(THEME_NAME_KEY)
  );
  const [baseTheme, setBaseThemeState] = useState<BaseTheme>(getBaseTheme);
  const [loading, setLoading] = useState(true);
  const [themesPath, setThemesPath] = useState(hasBridge ? "Loading path..." : "Not available outside Electron");

  // Apply base theme class on mount & when changed
  React.useEffect(() => {
    applyBaseTheme(baseTheme);
  }, [baseTheme]);

  const handleBaseTheme = useCallback((t: BaseTheme) => {
    setBaseThemeState(t);
    applyBaseTheme(t);
  }, []);

  const fetchThemes = useCallback(async () => {
    if (!hasBridge) { setLoading(false); return; }
    setLoading(true);
    try {
      const list = await window.bergamot.getAvailableThemes();
      setThemes(list);
    } catch {
      setThemes([]);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchThemes();
    if (hasBridge) {
      window.bergamot.getThemesPath().then(setThemesPath).catch(() => {});
    }
  }, [fetchThemes]);

  const selectTheme = useCallback(async (filename: string | null) => {
    if (!filename) {
      applyThemeCss(null);
      localStorage.removeItem(THEME_NAME_KEY);
      localStorage.removeItem(THEME_CSS_KEY);
      setActiveTheme(null);
      return;
    }
    if (!hasBridge) return;
    try {
      const css = await window.bergamot.getThemeCss(filename);
      applyThemeCss(css);
      localStorage.setItem(THEME_NAME_KEY, filename);
      localStorage.setItem(THEME_CSS_KEY, css);
      setActiveTheme(filename);
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to load theme", duration: 2 });
    }
  }, []);

  const handleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    selectTheme(value === "" ? null : value);
  }, [selectTheme]);

  return (
    <div>
      {/* Base theme selector */}
      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 16 }}>Base Theme</h3>
        <div style={{ display: "flex", gap: 12 }}>
          {(["dark", "light"] as const).map((t) => (
            <div
              key={t}
              className={`base-theme-btn ${baseTheme === t ? "base-theme-btn--active" : ""} base-theme-btn--${t}`}
              onClick={() => handleBaseTheme(t)}
            >
              <PhIcon name={t === "dark" ? "moon" : "sun"} weight="fill" size={16} style={{ marginRight: 8 }} />
              {t === "dark" ? "Dark" : "Light"}
            </div>
          ))}
        </div>
      </div>

      {/* BetterDiscord theme selector */}
      <div className="settings-card" style={{ padding: 24 }}>
        <h3 style={{ color: "var(--header-primary)", marginBottom: 16 }}>BetterDiscord Themes</h3>

        {!hasBridge ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Custom BetterDiscord themes are only available in the Bergamot desktop app.
          </p>
        ) : (
          <>
            <div className="settings-card__label" style={{ marginBottom: 8 }}>Select Theme</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <select
                className="theme-select"
                value={activeTheme || ""}
                onChange={handleSelectChange}
                disabled={loading}
              >
                <option value="">Default (None)</option>
                {themes.map((filename) => (
                  <option key={filename} value={filename}>
                    {filename.replace(/\.css$/, "")}
                  </option>
                ))}
              </select>
              <Button size="small" theme="borderless" style={{ color: "var(--text-normal)" }} onClick={fetchThemes}>
                Refresh
              </Button>
            </div>

            {themes.length === 0 && !loading && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 12 }}>
                No themes found. Place <code>.css</code> files in your themes folder to get started.
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Button
                size="small"
                style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                onClick={() => window.bergamot.openThemesFolder()}
              >
                Open Themes Folder
              </Button>
            </div>

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
        <h3 style={{ color: "#e0e1e5", marginBottom: 8 }}>Server Connection</h3>
        <p style={{ color: "#80848e", fontSize: 13, marginBottom: 16 }}>
          Configure which Bergamot backend server to connect to. The app will reload after changing.
        </p>

        <div className="settings-card__label" style={{ marginBottom: 8 }}>Server URL</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Input
            value={serverUrl}
            onChange={(v) => { setUrl(v); setSaved(false); }}
            placeholder="http://localhost:8000"
            style={{ flex: 1, backgroundColor: "#1e1f22", borderColor: "#3f4147", color: "#e0e1e5" }}
            onKeyDown={(e) => e.key === "Enter" && isDirty && handleSave()}
          />
          <Button
            size="small"
            style={isDirty ? { background: "#6b9362", borderColor: "#6b9362", color: "#fff" } : {}}
            disabled={!isDirty}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <Button size="small" theme="borderless" style={{ color: "#b5bac1" }} onClick={handleReset}>
            Reset to Default (localhost:8000)
          </Button>
        </div>

        <p style={{ color: "#5c5e66", fontSize: 12, marginTop: 16 }}>
          API endpoint: <code style={{ color: "#80848e" }}>{currentUrl}/api/v1</code>
          <br />
          WebSocket: <code style={{ color: "#80848e" }}>ws://{(() => { try { return new URL(currentUrl).hostname; } catch { return "localhost"; } })()}:4000/socket</code>
        </p>
      </div>
    </div>
  );
};

const NotificationSettings: React.FC = () => (
  <div>
    <div className="settings-card" style={{ padding: 24 }}>
      <h3 style={{ color: "#e0e1e5", marginBottom: 16 }}>Notification Preferences</h3>
      {[
        { label: "Enable Desktop Notifications", defaultChecked: true },
        { label: "Enable Message Sounds", defaultChecked: true },
        { label: "Show Unread Message Badge", defaultChecked: true },
        { label: "Notify on Mentions Only", defaultChecked: false },
      ].map((opt) => (
        <div key={opt.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #35373c" }}>
          <span style={{ color: "#b5bac1" }}>{opt.label}</span>
          <Switch defaultChecked={opt.defaultChecked} />
        </div>
      ))}
    </div>
  </div>
);

const ConnectionsPane: React.FC = () => (
  <div>
    <div className="settings-card" style={{ padding: 24 }}>
      <h3 style={{ color: "#e0e1e5", marginBottom: 8 }}>Connect Your Accounts</h3>
      <p style={{ color: "#80848e", marginBottom: 20 }}>Connect these accounts to enable integrations.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {["GitHub", "GitLab", "Spotify", "Steam", "Twitch"].map((svc) => (
          <Button
            key={svc}
            theme="light"
            style={{ borderColor: "#3f4147" }}
          >
            {svc}
          </Button>
        ))}
      </div>
    </div>
  </div>
);

const PlaceholderPane: React.FC<{ title: string }> = ({ title }) => (
  <div className="settings-card" style={{ padding: 24 }}>
    <h3 style={{ color: "#e0e1e5", marginBottom: 8 }}>{title}</h3>
    <p style={{ color: "#80848e" }}>This section is under construction.</p>
  </div>
);
