import React, { useState, useRef, useCallback } from "react";
import { Avatar, Button, Switch, Toast, Input } from "@douyinfe/semi-ui";
import { PhIcon } from "./PhIcon";
import type { UserRead, UserUpdate } from "../services/api";
import * as api from "../services/api";
import { getConfiguredServerUrl, setServerUrl } from "../services/api";
import {
  getAvailableThemes as getRuntimeThemes,
  getStoredBaseTheme,
  getThemeRuntimeState,
  getThemePreviewTokens,
  hasThemeBridge,
  initializeThemeRuntime,
  refreshThemeCatalog,
  selectTheme as selectRuntimeTheme,
  setBaseTheme as setRuntimeBaseTheme,
  subscribeThemeCatalog,
  subscribeThemeState,
} from "../theme/runtime";
import type { BaseTheme, ProteusTokenRecord } from "../theme/runtime";

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
      { key: "connections", label: "Connections", icon: "link" },
    ],
  },
  {
    label: "App Settings",
    items: [
      { key: "appearance", label: "Appearance", icon: "paint-brush" },
      { key: "connection", label: "Connection", icon: "network" },
      { key: "notifications", label: "Notifications", icon: "bell" },
      { key: "keybinds", label: "Keybinds", icon: "keyboard" },
      { key: "language", label: "Language", icon: "translate" },
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
  online: { label: "Online", color: "var(--status-positive)" },
  idle: { label: "Idle", color: "var(--status-warning)" },
  dnd: { label: "Do Not Disturb", color: "var(--status-danger)" },
  offline: { label: "Invisible", color: "var(--text-muted)" },
};

interface ThemePreviewOption {
  filename: string | null;
  label: string;
  tokens: ProteusTokenRecord;
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

function buildThemePreviewStyle(tokens: ProteusTokenRecord): React.CSSProperties {
  return {
    ["--theme-preview-bg-0" as "--theme-preview-bg-0"]: tokens["bg-0"],
    ["--theme-preview-bg-1" as "--theme-preview-bg-1"]: tokens["bg-1"],
    ["--theme-preview-bg-2" as "--theme-preview-bg-2"]: tokens["bg-2"],
    ["--theme-preview-bg-3" as "--theme-preview-bg-3"]: tokens["bg-3"],
    ["--theme-preview-accent" as "--theme-preview-accent"]: tokens.accent,
    ["--theme-preview-accent-soft" as "--theme-preview-accent-soft"]: tokens["accent-subtle"],
    ["--theme-preview-text" as "--theme-preview-text"]: tokens["text-0"],
    ["--theme-preview-muted" as "--theme-preview-muted"]: tokens["text-2"],
    ["--theme-preview-border" as "--theme-preview-border"]: tokens.border,
    ["--theme-preview-selected" as "--theme-preview-selected"]: tokens.selected,
  } as React.CSSProperties;
}

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
                  <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>— {currentUser.status_message}</span>
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
                style={{ flex: 1, backgroundColor: "var(--proteus-settings-surface-strong)", borderColor: "var(--proteus-settings-border)", color: "var(--header-primary)" }}
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
                style={{ backgroundColor: "var(--proteus-settings-surface-strong)", borderColor: "var(--proteus-settings-border)", color: "var(--header-primary)" }}
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
      window.bergamot.getThemesPath().then(setThemesPath).catch(() => {});
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
        const fallbackTokens = await getThemePreviewTokens(null, baseTheme);
        const previewEntries = await Promise.all(
          [null, ...themes].map(async (filename) => {
            try {
              const tokens = await getThemePreviewTokens(filename, baseTheme);
              return {
                filename,
                label: formatThemeLabel(filename),
                tokens,
              };
            } catch {
              return {
                filename,
                label: formatThemeLabel(filename),
                tokens: fallbackTokens,
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

      {/* BetterDiscord theme selector */}
      <div className="settings-card" style={{ padding: 24 }}>
        <div className="theme-gallery__header">
          <div>
            <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>BetterDiscord Themes</h3>
            <p className="theme-gallery__description">
              Pick a theme from its palette preview. Proteus will hot reload if the selected file changes.
            </p>
          </div>
          {hasThemeBridge() && (
            <div className="theme-gallery__actions">
              <Button size="small" theme="borderless" style={{ color: "var(--text-normal)" }} onClick={fetchThemes}>
                Refresh
              </Button>
              <Button
                size="small"
                style={{ background: "var(--brand-experiment)", borderColor: "var(--brand-experiment)", color: "#fff" }}
                onClick={() => window.bergamot.openThemesFolder()}
              >
                Open Themes Folder
              </Button>
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
                      style={buildThemePreviewStyle(preview.tokens)}
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
            style={{ flex: 1, backgroundColor: "var(--proteus-settings-surface-strong)", borderColor: "var(--proteus-settings-border)", color: "var(--header-primary)" }}
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

const NotificationSettings: React.FC = () => (
  <div>
    <div className="settings-card" style={{ padding: 24 }}>
      <h3 style={{ color: "var(--header-primary)", marginBottom: 16 }}>Notification Preferences</h3>
      {[
        { label: "Enable Desktop Notifications", defaultChecked: true },
        { label: "Enable Message Sounds", defaultChecked: true },
        { label: "Show Unread Message Badge", defaultChecked: true },
        { label: "Notify on Mentions Only", defaultChecked: false },
      ].map((opt) => (
        <div key={opt.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--background-modifier-accent)" }}>
          <span style={{ color: "var(--text-normal)" }}>{opt.label}</span>
          <Switch defaultChecked={opt.defaultChecked} />
        </div>
      ))}
    </div>
  </div>
);

const ConnectionsPane: React.FC = () => (
  <div>
    <div className="settings-card" style={{ padding: 24 }}>
      <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>Connect Your Accounts</h3>
      <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>Connect these accounts to enable integrations.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {["GitHub", "GitLab", "Spotify", "Steam", "Twitch"].map((svc) => (
          <Button
            key={svc}
            theme="light"
            style={{ borderColor: "var(--background-modifier-accent)" }}
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
    <h3 style={{ color: "var(--header-primary)", marginBottom: 8 }}>{title}</h3>
    <p style={{ color: "var(--text-muted)" }}>This section is under construction.</p>
  </div>
);
